"""CLI tool to execute deterministic cross-snapshot narrative comparison and update lineage state."""

import argparse
import json
import logging
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.config import find_repo_root
from app.ml.pipeline.orchestrator import MLPipelineResult
from app.temporal.tracker import TemporalLineageTracker

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("traject.scripts.update_temporal_lineage")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="TRAJECT Temporal Narrative Lineage Update CLI"
    )
    parser.add_argument(
        "--current-artifact",
        "-c",
        required=True,
        help="Path to current analytics artifact JSON",
    )
    parser.add_argument(
        "--current-snapshot-id",
        required=True,
        help="Unique identifier for the current analytics snapshot",
    )
    parser.add_argument(
        "--previous-artifact",
        "-p",
        default=None,
        help="Optional path to previous analytics artifact JSON",
    )
    parser.add_argument(
        "--previous-snapshot-id",
        default=None,
        help="Optional unique identifier for previous analytics snapshot",
    )

    args = parser.parse_args()

    curr_path = Path(args.current_artifact).resolve()
    if not curr_path.is_file():
        logger.error("Current artifact file not found: %s", curr_path)
        sys.exit(1)

    logger.info("Loading current analytics artifact from %s...", curr_path)
    with open(curr_path, "r", encoding="utf-8") as f:
        curr_data = json.load(f)
    curr_result = MLPipelineResult.model_validate(curr_data)

    prev_result = None
    if args.previous_artifact:
        prev_path = Path(args.previous_artifact).resolve()
        if not prev_path.is_file():
            logger.error("Previous artifact file not found: %s", prev_path)
            sys.exit(1)
        logger.info("Loading previous analytics artifact from %s...", prev_path)
        with open(prev_path, "r", encoding="utf-8") as f:
            prev_data = json.load(f)
        prev_result = MLPipelineResult.model_validate(prev_data)

    tracker = TemporalLineageTracker()
    report = tracker.process_snapshot(
        current_result=curr_result,
        current_snapshot_id=args.current_snapshot_id,
        previous_result=prev_result,
        previous_snapshot_id=args.previous_snapshot_id,
    )

    print("\n" + "=" * 60)
    print("TEMPORAL LINEAGE COMPARISON COMPLETE")
    print(f"From Snapshot:          {report.from_snapshot_id}")
    print(f"To Snapshot:            {report.to_snapshot_id}")
    print(f"New Lineages:           {report.new_count}")
    print(f"Continuing Lineages:    {report.continuing_count}")
    print(f"Weakened Lineages:      {report.weakened_count}")
    print(f"Disappeared Lineages:   {report.disappeared_count}")
    print(f"Reappeared Lineages:    {report.reappeared_count}")
    print(f"Total Lineages Tracked: {report.total_lineages_tracked}")
    print("=" * 60)


if __name__ == "__main__":
    main()
