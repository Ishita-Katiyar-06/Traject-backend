"""CLI entrypoint for running incremental Telegram collection and manifest generation."""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.collectors.telegram.incremental_runner import (
    IncrementalRunConfig,
    TelegramIncrementalRunner,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("traject.scripts.incremental_collection")


async def main() -> None:
    parser = argparse.ArgumentParser(
        description="TRAJECT Incremental Telegram Collection Runner"
    )
    parser.add_argument(
        "--sources",
        "-s",
        type=str,
        default=None,
        help="Optional comma-delimited channel list (e.g. '@warmonitors, @clashreport')",
    )
    parser.add_argument(
        "--limit",
        "-l",
        type=int,
        default=100,
        help="Maximum new messages to fetch per source",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate run without writing to Parquet or updating checkpoints",
    )
    parser.add_argument(
        "--dataset-name",
        type=str,
        default="telegram_messages",
        help="Name of target Parquet dataset",
    )

    args = parser.parse_args()

    config = IncrementalRunConfig(
        per_source_limit=args.limit,
        sources=[s.strip() for s in args.sources.split(",")] if args.sources else None,
        dry_run=args.dry_run,
        dataset_name=args.dataset_name,
    )

    runner = TelegramIncrementalRunner(config=config)
    try:
        manifest = await runner.run()
        print("\n" + "=" * 60)
        print("INCREMENTAL RUN COMPLETE")
        print(f"Run ID:                 {manifest.run_id}")
        print(f"Sources Attempted:      {manifest.sources_attempted}")
        print(f"Sources Succeeded:      {manifest.sources_succeeded}")
        print(f"Sources Failed:         {manifest.sources_failed}")
        print(f"Total Raw Fetched:      {manifest.total_raw_fetched}")
        print(f"Total New Canonical:    {manifest.total_new_canonical_persisted}")
        print(f"Total Duplicates:       {manifest.total_duplicates_discarded}")
        print(f"Cumulative Corpus Count:{manifest.cumulative_corpus_count}")
        print(f"Corpus Snapshot ID:     {manifest.corpus_snapshot_id}")
        print("=" * 60)
    finally:
        await runner.collector.close()


if __name__ == "__main__":
    asyncio.run(main())
