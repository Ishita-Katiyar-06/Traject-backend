import asyncio
import json
import logging
import os
import shutil
import sys
import time
from pathlib import Path

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("traject.seed_collector")

from app.collectors.telegram.client import TelegramCredentials
from app.collectors.telegram.collector import TelegramCollector
from app.collectors.telegram.registry import load_telegram_source_registry
from app.core.config import find_repo_root, load_project_env
from app.schemas.canonical_message import CanonicalMessage
from app.storage.parquet import append_canonical_messages, read_canonical_messages

async def run_seed_collection(limit_per_channel: int = 100, max_channels: int | None = None):
    load_project_env()
    repo_root = find_repo_root()
    
    # Session isolation: copy session file to avoid SQLite lock contention with running uvicorn dev server
    src_session = repo_root / "backend" / "traject_collector_session.session"
    if not src_session.is_file():
        src_session = repo_root / "traject_collector_session.session"
    
    batch_session_name = "traject_batch_session"
    batch_session_file = repo_root / "backend" / f"{batch_session_name}.session"
    
    if src_session.is_file():
        shutil.copyfile(src_session, batch_session_file)
        logger.info("Created isolated batch session file: %s", batch_session_file)
    else:
        logger.error("No base session file found at %s", src_session)
        return

    # Load credentials with isolated session
    base_creds = TelegramCredentials.from_env()
    batch_creds = TelegramCredentials(
        api_id=base_creds.api_id,
        api_hash=base_creds.api_hash,
        session=batch_session_name,
        phone=base_creds.phone,
    )

    registry = load_telegram_source_registry()
    enabled_sources = registry.get_enabled_sources()
    if max_channels:
        enabled_sources = enabled_sources[:max_channels]

    total_channels = len(enabled_sources)
    logger.info("Loaded %d enabled channels from registry for collection (limit=%d/channel)", total_channels, limit_per_channel)

    collector = TelegramCollector(credentials=batch_creds)
    client = collector._get_or_create_client()
    await client.connect()
    
    if not await client.is_user_authorized():
        logger.error("Telegram client is not authorized. Aborting collection.")
        await collector.close()
        return

    me = await client.get_me()
    logger.info("Connected to Telegram MTProto as user: %s (%s)", me.first_name, getattr(me, "phone", "N/A"))

    parquet_path = repo_root / "data" / "processed" / "telegram" / "telegram_messages.parquet"
    existing_messages = read_canonical_messages(parquet_path) if parquet_path.is_file() else []
    initial_count = len(existing_messages)
    logger.info("Current dataset message count in %s: %d", parquet_path.name, initial_count)

    collected_canonical: list[CanonicalMessage] = []
    successful_channels = 0
    failed_channels = 0
    skipped_private = 0

    start_time = time.perf_counter()

    for idx, source in enumerate(enabled_sources, 1):
        username = source.username
        logger.info("[%d/%d] Fetching from %s (%s)...", idx, total_channels, username, source.display_name or source.domain)
        try:
            res = await collector.collect_channel(username, limit=limit_per_channel)
            n_msgs = len(res.canonical_messages)
            if n_msgs > 0:
                collected_canonical.extend(res.canonical_messages)
                successful_channels += 1
                logger.info("  -> Success: collected %d messages from %s (raw file: %s)", n_msgs, username, Path(res.raw_file_path).name if res.raw_file_path else "None")
            else:
                logger.info("  -> Channel returned 0 messages (empty or restricted).")
                successful_channels += 1
        except PermissionError:
            skipped_private += 1
            logger.warning("  -> Skipped: Channel %s is private or restricted.", username)
        except Exception as e:
            failed_channels += 1
            logger.warning("  -> Warning on %s: %s (%s)", username, type(e).__name__, str(e)[:100])

        # Polite rate-limiting between channels to prevent FloodWait
        await asyncio.sleep(1.2)

    await collector.close()

    elapsed = time.perf_counter() - start_time
    logger.info(
        "Collection pass complete in %.1fs: %d total messages fetched across %d/%d channels (%d skipped/private, %d failed).",
        elapsed,
        len(collected_canonical),
        successful_channels,
        total_channels,
        skipped_private,
        failed_channels,
    )

    if collected_canonical:
        logger.info("Appending and deduplicating new messages into %s...", parquet_path)
        appended, total_after = append_canonical_messages(parquet_path, collected_canonical)
        logger.info("Dataset updated successfully: +%d new distinct messages (Total corpus: %d messages)", appended, total_after)
    else:
        logger.info("No messages to append.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=50, help="Messages per channel")
    parser.add_argument("--max-channels", type=int, default=None, help="Max channels to process")
    args = parser.parse_args()

    asyncio.run(run_seed_collection(limit_per_channel=args.limit, max_channels=args.max_channels))
