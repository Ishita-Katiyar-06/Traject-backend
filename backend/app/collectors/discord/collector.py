import argparse
import asyncio
import json
import logging
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.collectors.discord.client import DiscordClient, DiscordCredentials
from app.collectors.discord.serializer import DiscordMessageSerializer
from app.schemas.canonical_message import CanonicalMessage

logger = logging.getLogger("traject.collectors.discord")


@dataclass
class DiscordCollectionResult:
    """Summary of a Discord channel collection run."""
    channel_id: str
    channel_name: str | None
    requested_limit: int
    raw_messages_count: int
    canonical_messages_count: int
    raw_file_path: str
    canonical_messages: list[CanonicalMessage] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


class DiscordCollector:
    """Historical and batch message collector for Discord channels via REST API."""

    def __init__(
        self,
        credentials: DiscordCredentials | None = None,
        client: DiscordClient | None = None,
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
            self.raw_storage_dir = (find_repo_root() / "data" / "raw" / "discord").resolve()

    def _get_or_create_client(self) -> DiscordClient:
        """Obtain active or new DiscordClient instance."""
        if self._external_client is not None:
            return self._external_client
        if self.credentials is None:
            self.credentials = DiscordCredentials.from_env()
        return DiscordClient(credentials=self.credentials)

    @staticmethod
    def _sanitize_filename(name: str) -> str:
        """Sanitize channel identifiers for safe filesystem paths."""
        return re.sub(r"[^\w\-.]", "_", str(name)).strip("_")

    async def collect_channel(
        self,
        channel_id: str | int,
        limit: int = 50,
        normalize: bool = True,
    ) -> DiscordCollectionResult:
        """Collect messages from a Discord channel, persisting raw JSONL.
        
        Args:
            channel_id: Target Discord channel snowflake ID.
            limit: Maximum messages to retrieve.
            normalize: Whether to also normalize into CanonicalMessage instances.
        """
        client = self._get_or_create_client()
        channel_id_str = str(channel_id).strip()
        collected_at = datetime.now(timezone.utc)
        timestamp_str = collected_at.strftime("%Y%m%d_%H%M%S")

        logger.info("Collecting up to %d messages from Discord channel '%s'...", limit, channel_id_str)

        # 1. Fetch channel metadata (graceful fallback if unavailable)
        channel_info: dict[str, Any] = {}
        try:
            channel_info = await client.get_channel_info(channel_id_str)
        except Exception as e:
            logger.warning("Could not fetch channel metadata for '%s': %s", channel_id_str, e)

        channel_name = channel_info.get("name")

        # 2. Fetch messages from Discord REST API
        raw_api_messages = await client.get_channel_messages(channel_id_str, limit=limit)
        logger.info("Retrieved %d raw messages from Discord API.", len(raw_api_messages))

        # 3. Serialize into standard primitive dictionaries
        serialized_records: list[dict[str, Any]] = []
        for raw_msg in raw_api_messages:
            serialized = DiscordMessageSerializer.serialize(
                raw_msg, channel_info=channel_info, collected_at=collected_at
            )
            serialized_records.append(serialized)

        # 4. Persist to immutable raw JSONL storage
        self.raw_storage_dir.mkdir(parents=True, exist_ok=True)
        safe_name = self._sanitize_filename(channel_name or channel_id_str)
        raw_filename = f"{safe_name}_{timestamp_str}.jsonl"
        raw_file_path = self.raw_storage_dir / raw_filename

        with open(raw_file_path, "w", encoding="utf-8") as f:
            for rec in serialized_records:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")

        logger.info("Saved %d raw Discord records to %s", len(serialized_records), raw_file_path)

        # 5. Optional Normalization to CanonicalMessage
        canonical_messages: list[CanonicalMessage] = []
        errors: list[str] = []

        if normalize and serialized_records:
            from app.normalizers.discord import DiscordNormalizer

            for idx, rec in enumerate(serialized_records, start=1):
                raw_ref = f"{raw_filename}:line_{idx}"
                try:
                    cmsg = DiscordNormalizer.normalize(
                        rec,
                        collected_at=collected_at,
                        raw_reference=raw_ref,
                    )
                    canonical_messages.append(cmsg)
                except Exception as e:
                    err_msg = f"Failed to normalize Discord message {rec.get('id')}: {e}"
                    logger.error(err_msg)
                    errors.append(err_msg)

        return DiscordCollectionResult(
            channel_id=channel_id_str,
            channel_name=channel_name,
            requested_limit=limit,
            raw_messages_count=len(serialized_records),
            canonical_messages_count=len(canonical_messages),
            raw_file_path=str(raw_file_path),
            canonical_messages=canonical_messages,
            errors=errors,
        )

    async def collect_guild(
        self,
        guild_id: str | int,
        limit: int = 50,
        normalize: bool = True,
    ) -> list[DiscordCollectionResult]:
        """Collect messages from all accessible text channels in a Discord server/guild."""
        client = self._get_or_create_client()
        guild_id_str = str(guild_id).strip()
        logger.info("Discovering channels in Discord guild '%s'...", guild_id_str)

        all_channels = await client.get_guild_channels(guild_id_str)
        # Type 0 = GUILD_TEXT, Type 5 = GUILD_ANNOUNCEMENT
        text_channels = [c for c in all_channels if c.get("type") in (0, 5, None)]
        logger.info("Found %d text channels in guild '%s'.", len(text_channels), guild_id_str)

        results: list[DiscordCollectionResult] = []
        for ch in text_channels:
            ch_id = str(ch.get("id"))
            ch_name = ch.get("name", ch_id)
            logger.info("Processing channel #%s (%s)...", ch_name, ch_id)
            try:
                res = await self.collect_channel(ch_id, limit=limit, normalize=normalize)
                results.append(res)
            except PermissionError as e:
                logger.warning("Skipping channel #%s: No read permissions (%s)", ch_name, e)
            except Exception as e:
                logger.error("Error collecting channel #%s: %s", ch_name, e)

        return results

    async def collect_all(
        self,
        limit: int = 50,
        normalize: bool = True,
    ) -> list[DiscordCollectionResult]:
        """Discover all servers the bot is in and collect from all accessible text channels."""
        client = self._get_or_create_client()
        guilds = await client.get_bot_guilds()
        logger.info("Bot is in %d Discord server(s).", len(guilds))

        all_results: list[DiscordCollectionResult] = []
        for guild in guilds:
            g_id = str(guild.get("id"))
            g_name = guild.get("name", g_id)
            logger.info("Collecting from server '%s' (%s)...", g_name, g_id)
            results = await self.collect_guild(g_id, limit=limit, normalize=normalize)
            all_results.extend(results)

        return all_results


def main():
    """CLI entrypoint for Discord channel collection."""
    from app.core.config import load_project_env
    load_project_env()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    )

    parser = argparse.ArgumentParser(description="TRAJECT Discord Message Collector")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--channel", help="Target Discord channel snowflake ID")
    group.add_argument("--guild", help="Target Discord server/guild ID (collects all text channels)")
    group.add_argument("--all", action="store_true", help="Collect all text channels from all joined servers")

    parser.add_argument("--limit", type=int, default=50, help="Maximum messages per channel (default: 50)")
    parser.add_argument("--raw-dir", default=None, help="Custom raw storage directory")

    args = parser.parse_args()

    collector = DiscordCollector(raw_storage_dir=args.raw_dir)

    if args.channel:
        res = asyncio.run(collector.collect_channel(args.channel, limit=args.limit))
        results = [res]
    elif args.guild:
        results = asyncio.run(collector.collect_guild(args.guild, limit=args.limit))
    elif args.all:
        results = asyncio.run(collector.collect_all(limit=args.limit))
    else:
        parser.error("Must specify --channel, --guild, or --all")

    print("\n" + "=" * 60)
    print("TRAJECT Discord Ingestion Summary")
    print("=" * 60)
    total_raw = sum(r.raw_messages_count for r in results)
    total_canonical = sum(r.canonical_messages_count for r in results)
    print(f"Channels Processed:  {len(results)}")
    print(f"Total Raw Messages:  {total_raw}")
    print(f"Total Normalized:    {total_canonical}")
    for r in results:
        status = f"{r.canonical_messages_count} msgs" if not r.errors else f"ERR: {len(r.errors)}"
        print(f"  - #{r.channel_name or r.channel_id} ({r.channel_id}): {status}")
    print("=" * 60)


if __name__ == "__main__":
    main()
