import argparse
import asyncio
import json
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import getpass
from telethon import TelegramClient
from telethon.errors import (
    AuthKeyUnregisteredError,
    ChannelPrivateError,
    FloodWaitError,
    RPCError,
    UsernameInvalidError,
    UsernameNotOccupiedError,
)


from app.collectors.telegram.client import TelegramClientFactory, TelegramCredentials
from app.collectors.telegram.serializer import TelethonMessageSerializer
from app.normalizers.telegram import TelegramNormalizer
from app.schemas.canonical_message import CanonicalMessage

logger = logging.getLogger("traject.collectors.telegram")


@dataclass
class CollectionResult:
    """Summary result of a Telegram channel collection run."""
    channel: str
    target_entity_id: str | int | None
    requested_limit: int
    raw_messages_count: int
    canonical_messages_count: int
    raw_file_path: str
    canonical_messages: list[CanonicalMessage] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


class TelegramCollector:
    """Historical and batch message collector for Telegram channels using Telethon.
    
    Persists immutable raw payloads to JSONL before normalizing into CanonicalMessage contracts.
    """

    def __init__(
        self,
        credentials: TelegramCredentials | None = None,
        client: TelegramClient | None = None,
        raw_storage_dir: str | Path | None = None,
    ):
        self.credentials = credentials
        self._external_client = client
        if raw_storage_dir is not None:
            p = Path(raw_storage_dir)
            if p.is_absolute():
                self.raw_storage_dir = p
            else:
                from app.core.config import find_repo_root
                self.raw_storage_dir = (find_repo_root() / p).resolve()
        else:
            from app.core.config import find_repo_root
            self.raw_storage_dir = (find_repo_root() / "data" / "raw" / "telegram").resolve()


    def _get_or_create_client(self) -> TelegramClient:
        """Obtain active or new TelegramClient instance."""
        if self._external_client is not None:
            return self._external_client

        if self.credentials is None:
            self.credentials = TelegramCredentials.from_env()

        return TelegramClientFactory.create_client(self.credentials)

    @staticmethod
    def _sanitize_filename(name: str) -> str:
        """Sanitize channel identifiers for safe filesystem paths."""
        return re.sub(r"[^\w\-.]", "_", name.lstrip("@")).strip("_")

    async def ensure_authorized(self, client: TelegramClient) -> bool:
        """Ensure the Telethon client is authorized, executing the interactive sign-in flow if needed.
        
        Handles:
        - Already-authorized sessions (bypasses prompt, logs success).
        - Unauthorized sessions (interactive sign-in via terminal using configured phone).
        - 2FA-protected accounts (cloud password prompt via getpass).
        - AuthKeyUnregisteredError (clear recovery instructions without opaque tracebacks).
        """
        # 1. Connect if not yet connected
        if not client.is_connected():
            await client.connect()

        session_name = getattr(self.credentials, "session", "traject_collector_session")

        # 2. Check existing authorization
        try:
            is_authorized = await client.is_user_authorized()
        except AuthKeyUnregisteredError as e:
            logger.error(
                "Telegram session auth key is unregistered or was invalidated by Telegram: %s",
                session_name,
            )
            raise RuntimeError(
                f"Telegram session '{session_name}' has an unregistered auth key on Telegram servers.\n"
                f"Recovery: The session key was revoked, expired, or corrupted. Please delete or rename "
                f"'{session_name}.session' in the backend directory and re-run to authenticate a fresh session."
            ) from e

        if is_authorized:
            logger.info("Telegram session '%s' is authorized and active.", session_name)
            return True

        # 3. Interactive Authorization Flow
        logger.info(
            "Telegram session '%s' is not authorized. Starting interactive authentication...",
            session_name,
        )

        configured_phone = getattr(self.credentials, "phone", None)

        def phone_resolver() -> str:
            if configured_phone and not configured_phone.startswith("+91000000"):
                return configured_phone
            return input("Please enter your Telegram phone number (e.g. +919876543210): ").strip()

        def code_callback() -> str:
            return input("Please enter the Telegram login code you received: ").strip()

        def password_callback() -> str:
            return getpass.getpass("Please enter your Telegram 2FA cloud password: ")

        try:
            await client.start(
                phone=phone_resolver,
                password=password_callback,
                code_callback=code_callback,
                max_attempts=3,
            )
            logger.info("Telegram authentication successful! Session credentials saved.")
            return True
        except AuthKeyUnregisteredError as e:
            logger.error(
                "Telegram rejected the session key during authentication: %s", session_name
            )
            raise RuntimeError(
                f"Telegram session '{session_name}' auth key was rejected by Telegram.\n"
                f"Recovery: Please delete or rename '{session_name}.session' and re-run to create a fresh session."
            ) from e
        except Exception as e:
            logger.error("Interactive Telegram authentication failed: %s", type(e).__name__)
            raise

    async def collect_channel(
        self,
        channel: str,
        limit: int = 100,
    ) -> CollectionResult:
        """Fetch a bounded batch of recent messages from a target public channel.
        
        Args:
            channel: Username, link, or ID of the public Telegram channel (e.g. '@channel').
            limit: Maximum number of recent messages to collect (bounded).
            
        Returns:
            CollectionResult: Ingestion outcome with raw paths and validated CanonicalMessages.
        """
        if not channel or not channel.strip():
            raise ValueError("Channel identifier must not be empty.")

        if limit <= 0:
            raise ValueError(f"Collection limit must be a positive integer, got {limit}.")

        channel_clean = channel.strip()
        client = self._get_or_create_client()

        # Connect and ensure client is authorized before making API requests
        await self.ensure_authorized(client)

        # Resolve target channel entity
        try:
            entity = await client.get_entity(channel_clean)
        except (UsernameNotOccupiedError, UsernameInvalidError) as e:
            logger.error("Telegram channel username does not exist: %s", channel_clean)
            raise ValueError(f"Invalid or non-existent Telegram channel: '{channel_clean}'") from e
        except ChannelPrivateError as e:
            logger.error("Telegram channel is private or inaccessible: %s", channel_clean)
            raise PermissionError(f"Channel is private or inaccessible: '{channel_clean}'") from e
        except FloodWaitError as e:
            logger.warning("Telegram flood wait triggered. Must wait %s seconds.", e.seconds)
            raise
        except AuthKeyUnregisteredError as e:
            session_name = getattr(self.credentials, "session", "traject_collector_session")
            logger.error(
                "Telegram rejected request with AuthKeyUnregisteredError on session '%s'",
                session_name,
            )
            raise RuntimeError(
                f"Telegram session '{session_name}' has an unregistered auth key.\n"
                f"Recovery: Please delete or rename '{session_name}.session' and re-run to authenticate a fresh session."
            ) from e
        except RPCError as e:
            logger.error("Telegram RPC error resolving channel '%s': %s", channel_clean, e.__class__.__name__)
            raise


        entity_id = getattr(entity, "id", "unknown")
        sanitized_target = self._sanitize_filename(channel_clean)
        timestamp_slug = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        
        self.raw_storage_dir.mkdir(parents=True, exist_ok=True)
        raw_file = self.raw_storage_dir / f"{sanitized_target}_{timestamp_slug}.jsonl"

        raw_records: list[dict[str, Any]] = []
        canonical_messages: list[CanonicalMessage] = []
        errors: list[str] = []

        logger.info(
            "Starting collection for channel '%s' (limit: %d, output: %s)",
            channel_clean,
            limit,
            raw_file,
        )

        try:
            line_idx = 0
            async for message in client.iter_messages(entity, limit=limit):
                try:
                    # 1. Deliberate primitive serialization
                    raw_dict = TelethonMessageSerializer.serialize(
                        message,
                        chat_entity=entity,
                    )
                    line_idx += 1
                    raw_dict["raw_reference"] = f"{raw_file.name}:{line_idx}"

                    # 2. Append to raw JSONL immediately
                    with open(raw_file, "a", encoding="utf-8") as f:
                        f.write(json.dumps(raw_dict, ensure_ascii=False) + "\n")

                    raw_records.append(raw_dict)

                    # 3. Pass through TelegramNormalizer
                    canonical = TelegramNormalizer.normalize(
                        raw_dict,
                        raw_reference=raw_dict["raw_reference"],
                    )
                    canonical_messages.append(canonical)

                except Exception as e:
                    msg_id = getattr(message, "id", "unknown")
                    err_msg = f"Failed processing message {msg_id}: {type(e).__name__} - {str(e)}"
                    logger.warning(err_msg)
                    errors.append(err_msg)

        except FloodWaitError as e:
            logger.warning("FloodWaitError encountered during iteration (%d seconds remaining).", e.seconds)
            errors.append(f"FloodWait: {e.seconds}s required.")
        except Exception as e:
            logger.error("Error during message retrieval for '%s': %s", channel_clean, str(e))
            raise

        logger.info(
            "Completed collection for '%s': %d raw records saved, %d normalized.",
            channel_clean,
            len(raw_records),
            len(canonical_messages),
        )

        return CollectionResult(
            channel=channel_clean,
            target_entity_id=entity_id,
            requested_limit=limit,
            raw_messages_count=len(raw_records),
            canonical_messages_count=len(canonical_messages),
            raw_file_path=str(raw_file),
            canonical_messages=canonical_messages,
            errors=errors,
        )


async def _main():
    """CLI entrypoint for testing Telegram collection."""
    from app.core.config import load_project_env
    load_project_env()

    parser = argparse.ArgumentParser(description="TRAJECT Telegram Historical Channel Collector")
    parser.add_argument("--channel", required=True, help="Telegram channel username (e.g. @durov)")
    parser.add_argument("--limit", type=int, default=10, help="Number of recent messages to collect (default: 10)")
    parser.add_argument("--raw-dir", default=None, help="Output directory for raw JSONL (default: <repo_root>/data/raw/telegram)")

    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

    collector = TelegramCollector(raw_storage_dir=args.raw_dir)
    result = await collector.collect_channel(channel=args.channel, limit=args.limit)

    print(f"\nCollection Summary:")
    print(f"Channel: {result.channel} (ID: {result.target_entity_id})")
    print(f"Raw file: {result.raw_file_path}")
    print(f"Messages Collected: {result.raw_messages_count}")
    print(f"Messages Normalized: {result.canonical_messages_count}")
    if result.errors:
        print(f"Errors encountered: {len(result.errors)}")


if __name__ == "__main__":
    asyncio.run(_main())
