import argparse
import asyncio
import json
import logging
import os
import re
from collections.abc import Awaitable
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


@dataclass
class MultiCollectionResult:
    """Summary result of a multi-source Telegram collection run."""
    total_sources_requested: int
    successful_sources: int
    failed_sources: int
    total_raw_messages: int
    total_canonical_messages: int
    channel_results: dict[str, CollectionResult] = field(default_factory=dict)
    failed_channel_errors: dict[str, str] = field(default_factory=dict)
    canonical_messages: list[CanonicalMessage] = field(default_factory=list)
    raw_file_paths: list[str] = field(default_factory=list)


def parse_telegram_sources(
    raw_sources: str | list[str] | None,
) -> list[str]:
    """Parse, normalize, and deduplicate Telegram channel identifiers.
    
    Supports:
    - Comma-separated or whitespace/newline-separated strings (e.g. "@a, @b, @c")
    - Lists or iterables of channel identifier strings
    - Usernames (@channel, channel)
    - Public t.me links (t.me/channel, https://t.me/channel)
    - Numeric Telegram chat IDs (-100123456789, 123456789)
    
    Preserves declaration ordering while discarding empty tokens and duplicates.
    """
    if raw_sources is None:
        return []

    if isinstance(raw_sources, str):
        tokens = [t.strip() for t in re.split(r"[,\s]+", raw_sources) if t.strip()]
    elif isinstance(raw_sources, (list, tuple, set)):
        tokens = [str(t).strip() for t in raw_sources if str(t).strip()]
    else:
        tokens = [str(raw_sources).strip()]

    cleaned: list[str] = []
    seen: set[str] = set()

    for token in tokens:
        # Normalize public t.me links: https://t.me/channel or t.me/channel -> @channel
        url_match = (
            re.match(r"^https?://t\.me/([a-zA-Z0-9_+]+)/?$", token)
            or re.match(r"^t\.me/([a-zA-Z0-9_+]+)/?$", token)
        )
        if url_match:
            candidate = f"@{url_match.group(1)}"
        elif token.startswith("-") and token[1:].isdigit():
            candidate = token
        elif token.isdigit():
            candidate = token
        elif not token.startswith("@"):
            candidate = f"@{token}"
        else:
            candidate = token

        dedup_key = candidate.lower()
        if dedup_key not in seen:
            seen.add(dedup_key)
            cleaned.append(candidate)

    return cleaned


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
        self._cached_client: TelegramClient | None = None
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
        """Obtain active or new TelegramClient instance (reused across sources)."""
        if self._external_client is not None:
            return self._external_client

        if self._cached_client is not None:
            return self._cached_client

        if self.credentials is None:
            self.credentials = TelegramCredentials.from_env()

        self._cached_client = TelegramClientFactory.create_client(self.credentials)
        return self._cached_client

    async def close(self) -> None:
        """Cleanly disconnect cached Telethon client if connected."""
        if self._cached_client is not None and self._cached_client.is_connected():
            await self._cached_client.disconnect()

    async def __aenter__(self) -> "TelegramCollector":
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        await self.close()

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
            start_result = client.start(
                phone=phone_resolver,
                password=password_callback,
                code_callback=code_callback,
                max_attempts=3,
            )
            if isinstance(start_result, Awaitable):
                await start_result
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
        target: str | int = channel_clean
        if channel_clean.startswith("-") and channel_clean[1:].isdigit():
            try:
                target = int(channel_clean)
            except ValueError:
                target = channel_clean
        elif channel_clean.isdigit():
            try:
                target = int(channel_clean)
            except ValueError:
                target = channel_clean

        client = self._get_or_create_client()

        # Connect and ensure client is authorized before making API requests
        await self.ensure_authorized(client)

        # Resolve target channel entity
        try:
            entity = await client.get_entity(target)
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

    async def collect_sources(
        self,
        sources: list[str] | str | None = None,
        limit: int | None = None,
        per_source_limits: dict[str, int] | None = None,
        use_registry: bool = True,
    ) -> MultiCollectionResult:
        """Fetch messages sequentially from multiple configured Telegram sources.
        
        Resolution order:
        1. Explicit `sources` argument (list or comma-separated string)
        2. Runtime environment override `TELEGRAM_SOURCES`
        3. Enabled sources from version-controlled telegram_sources.json registry
        
        Isolates source failures so that an inaccessible channel does not abort the run.
        Reuses a single authenticated Telethon client session across all channels.
        
        Args:
            sources: Optional explicit channel list or comma-delimited string.
            limit: Global maximum messages per channel.
            per_source_limits: Optional dictionary mapping source -> limit override.
            use_registry: Whether to fall back to the version-controlled source registry.
            
        Returns:
            MultiCollectionResult: Aggregated outcome across all requested sources.
        """
        target_sources: list[str] = []
        if sources is not None:
            target_sources = parse_telegram_sources(sources)
        else:
            env_sources = os.getenv("TELEGRAM_SOURCES")
            if env_sources and env_sources.strip():
                target_sources = parse_telegram_sources(env_sources)
            elif use_registry:
                from app.collectors.telegram.registry import load_telegram_source_registry
                registry = load_telegram_source_registry()
                target_sources = parse_telegram_sources(registry.get_enabled_usernames())

        if not target_sources:
            raise ValueError(
                "No Telegram sources configured. Provide explicit sources, set TELEGRAM_SOURCES, "
                "or enable sources in backend/config/telegram_sources.json."
            )

        default_limit = limit or int(os.getenv("TELEGRAM_COLLECTION_LIMIT", "100"))
        client = self._get_or_create_client()
        await self.ensure_authorized(client)

        channel_results: dict[str, CollectionResult] = {}
        failed_errors: dict[str, str] = {}
        all_canonical: list[CanonicalMessage] = []
        all_raw_paths: list[str] = []

        logger.info(
            "Starting multi-source Telegram collection across %d source(s) (default limit: %d).",
            len(target_sources),
            default_limit,
        )

        for source in target_sources:
            ch_limit = (per_source_limits or {}).get(source) or default_limit
            logger.info("Processing Telegram source '%s' (limit: %d)...", source, ch_limit)
            try:
                res = await self.collect_channel(source, limit=ch_limit)
                channel_results[source] = res
                all_canonical.extend(res.canonical_messages)
                if res.raw_file_path:
                    all_raw_paths.append(res.raw_file_path)
            except Exception as e:
                err_msg = f"{type(e).__name__}: {str(e)}"
                logger.error("Failed collection for Telegram channel '%s': %s", source, err_msg)
                failed_errors[source] = err_msg
                channel_results[source] = CollectionResult(
                    channel=source,
                    target_entity_id=None,
                    requested_limit=ch_limit,
                    raw_messages_count=0,
                    canonical_messages_count=0,
                    raw_file_path="",
                    canonical_messages=[],
                    errors=[err_msg],
                )

        successful_sources = sum(
            1 for r in channel_results.values() if r.raw_messages_count > 0 or not r.errors
        )
        failed_sources = len(failed_errors)

        logger.info(
            "Multi-source Telegram collection complete: %d/%d succeeded (%d failed), %d canonical messages.",
            successful_sources,
            len(target_sources),
            failed_sources,
            len(all_canonical),
        )

        return MultiCollectionResult(
            total_sources_requested=len(target_sources),
            successful_sources=successful_sources,
            failed_sources=failed_sources,
            total_raw_messages=sum(r.raw_messages_count for r in channel_results.values()),
            total_canonical_messages=len(all_canonical),
            channel_results=channel_results,
            failed_channel_errors=failed_errors,
            canonical_messages=all_canonical,
            raw_file_paths=all_raw_paths,
        )


async def _main():
    """CLI entrypoint for testing Telegram collection."""
    import os
    from app.core.config import load_project_env
    load_project_env()

    parser = argparse.ArgumentParser(description="TRAJECT Telegram Historical & Multi-Source Channel Collector")
    parser.add_argument("--channel", default=None, help="Single Telegram channel username (e.g. @durov, backwards-compatible)")
    parser.add_argument("--channels", "--sources", dest="channels", default=None, help="Comma-separated Telegram channels/sources to collect")
    parser.add_argument("--use-registry", action="store_true", default=False, help="Explicitly collect all enabled sources from telegram_sources.json")
    parser.add_argument("--limit", type=int, default=10, help="Number of recent messages to collect per channel (default: 10)")
    parser.add_argument("--raw-dir", default=None, help="Output directory for raw JSONL (default: <repo_root>/data/raw/telegram)")

    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

    collector = TelegramCollector(raw_storage_dir=args.raw_dir)

    try:
        if args.channel:
            # Single-channel execution (Milestone 2 backwards compatibility)
            result = await collector.collect_channel(channel=args.channel, limit=args.limit)
            print(f"\nSingle-Channel Collection Summary:")
            print(f"Channel: {result.channel} (ID: {result.target_entity_id})")
            print(f"Raw file: {result.raw_file_path}")
            print(f"Messages Collected: {result.raw_messages_count}")
            print(f"Messages Normalized: {result.canonical_messages_count}")
            if result.errors:
                print(f"Errors encountered: {len(result.errors)}")
        else:
            # Multi-source execution (explicit or registry-driven)
            multi_res = await collector.collect_sources(
                sources=args.channels,
                limit=args.limit,
                use_registry=True,
            )
            print(f"\nMulti-Source Collection Summary:")
            print(f"Sources Requested: {multi_res.total_sources_requested}")
            print(f"Sources Succeeded: {multi_res.successful_sources}")
            print(f"Sources Failed:    {multi_res.failed_sources}")
            print(f"Total Raw Msgs:    {multi_res.total_raw_messages}")
            print(f"Total Canonical:   {multi_res.total_canonical_messages}")
            print(f"\nPer-Source Results:")
            for ch, res in multi_res.channel_results.items():
                status = "SUCCESS" if res.canonical_messages_count > 0 or not res.errors else "FAILED"
                print(f"  {ch:<32} [{status}] {res.canonical_messages_count} msgs (raw: {res.raw_file_path or 'N/A'})")
            if multi_res.failed_channel_errors:
                print(f"\nFailed Channels Details:")
                for ch, err in multi_res.failed_channel_errors.items():
                    print(f"  {ch}: {err}")
    finally:
        await collector.close()


if __name__ == "__main__":
    asyncio.run(_main())
