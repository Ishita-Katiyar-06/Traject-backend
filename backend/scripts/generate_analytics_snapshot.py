"""CLI tool to execute the frozen 4A-4H analytics pipeline and persist an immutable timestamped snapshot."""

import argparse
from datetime import datetime, timezone
import logging
import sys
import time
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.config import find_repo_root
from app.ml.pipeline.orchestrator import run_ml_pipeline
from app.storage.parquet import read_canonical_messages

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("traject.scripts.generate_analytics_snapshot")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="TRAJECT Analytics Snapshot Generator CLI"
    )
    parser.add_argument(
        "--input-parquet",
        "-i",
        default=None,
        help="Optional path to input .parquet file. Defaults to data/processed/telegram/telegram_messages.parquet",
    )
    parser.add_argument(
        "--output-artifact",
        "-o",
        default=None,
        help="Optional destination path for analytics snapshot artifact JSON",
    )
    parser.add_argument(
        "--snapshot-id",
        "-s",
        default=None,
        help="Optional custom snapshot identifier",
    )
    parser.add_argument(
        "--limit",
        "-l",
        type=int,
        default=None,
        help="Optional limit on records to process (for bounded testing)",
    )

    args = parser.parse_args()

    repo_root = find_repo_root()
    parquet_path = Path(args.input_parquet).resolve() if args.input_parquet else (
        repo_root / "data" / "processed" / "telegram" / "telegram_messages.parquet"
    )

    if not parquet_path.is_file():
        logger.error("Input Parquet dataset not found at %s", parquet_path)
        sys.exit(1)

    logger.info("Reading canonical messages from %s...", parquet_path)
    messages = read_canonical_messages(parquet_path)
    if args.limit and args.limit > 0:
        messages = messages[:args.limit]
        logger.info("Bounded run: limited to %d canonical messages.", len(messages))
    else:
        logger.info("Loaded %d canonical messages.", len(messages))

    timestamp_slug = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    snap_id = args.snapshot_id or f"snapshot_{timestamp_slug}"

    start_time = time.time()
    logger.info("Executing frozen 4A-4H analytics pipeline on %d messages...", len(messages))
    result = run_ml_pipeline(messages)
    elapsed = time.time() - start_time
    logger.info("Analytics pipeline completed in %.2f seconds.", elapsed)

    if args.output_artifact:
        out_path = Path(args.output_artifact).resolve()
    else:
        out_path = (
            repo_root
            / "data"
            / "processed"
            / "telegram"
            / f"telegram_messages_{timestamp_slug}-analytics-artifact.json"
        )

    result.save_analytics_artifact(out_path, overwrite=True)
    logger.info("Saved analytics snapshot artifact to %s", out_path)

    print("\n" + "=" * 60)
    print("ANALYTICS SNAPSHOT GENERATION COMPLETE")
    print(f"Snapshot ID:            {snap_id}")
    print(f"Messages Analyzed:      {len(messages)}")
    print(f"Topics Discovered:      {len(result.topics.topic_records)}")
    print(f"Promoted Narratives:    {len(result.narrative_report.narrative_candidates)}")
    print(f"Artifact Location:      {out_path}")
    print(f"Execution Duration:     {elapsed:.2f}s")
    print("=" * 60)


if __name__ == "__main__":
    main()
