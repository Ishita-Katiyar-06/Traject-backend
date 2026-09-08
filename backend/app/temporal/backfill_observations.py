"""Backfill utility for historical raw Telegram engagement observations (Milestone 7B).

Scans raw JSONL files in data/raw/telegram/ and data/raw/telegram/incremental/,
reconstructing point-in-time EngagementObservation records using each message's
actual collected_at timestamp as observed_at. Strictly preserves factual historical
data without fabrication or interpolation.
"""

from dataclasses import dataclass
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
from typing import Any

from app.core.config import find_repo_root
from app.normalizers.telegram import TelegramNormalizer
from app.schemas.engagement_observation import EngagementObservation
from app.storage.engagement_observations import (
    append_engagement_observations,
    read_engagement_observations,
)

logger = logging.getLogger("traject.temporal.backfill")


@dataclass
class BackfillResult:
    """Summary of historical raw observation backfill execution."""

    total_files_scanned: int
    total_records_read: int
    total_observations_extracted: int
    total_unique_canonical_messages: int
    messages_with_multiple_observations: int
    new_observations_persisted: int
    duplicate_observations_skipped: int
    total_observations_in_store: int
    output_parquet_path: str


def backfill_raw_observations(
    raw_dirs: list[Path | str] | None = None,
    output_parquet: Path | str | None = None,
    repo_root: Path | None = None,
) -> BackfillResult:
    """Execute a controlled, idempotent backfill of raw Telegram observations into Parquet.
    
    Args:
        raw_dirs: List of directories containing raw JSONL files.
        output_parquet: Destination Parquet path for engagement observations.
        repo_root: Repository root path.
        
    Returns:
        BackfillResult: Verification and audit metrics.
    """
    root = repo_root or find_repo_root()
    if raw_dirs is None:
        raw_dirs = [
            root / "data" / "raw" / "telegram",
            root / "data" / "raw" / "telegram" / "incremental",
        ]

    if output_parquet is None:
        target_parquet = root / "data" / "processed" / "telegram" / "telegram_engagement_observations.parquet"
    else:
        target_parquet = Path(output_parquet).resolve()

    extracted_observations: list[EngagementObservation] = []
    canonical_id_observation_counts: dict[str, int] = {}
    files_scanned = 0
    records_read = 0

    for raw_dir_spec in raw_dirs:
        raw_dir = Path(raw_dir_spec).resolve()
        if not raw_dir.is_dir():
            logger.warning("Raw directory does not exist: %s", raw_dir)
            continue

        for jsonl_file in sorted(raw_dir.glob("*.jsonl")):
            files_scanned += 1
            logger.debug("Scanning raw file for observations: %s", jsonl_file.name)
            try:
                with open(jsonl_file, "r", encoding="utf-8") as f:
                    for line_idx, line in enumerate(f, 1):
                        line_str = line.strip()
                        if not line_str:
                            continue
                        records_read += 1
                        try:
                            rec: dict[str, Any] = json.loads(line_str)
                            raw_ref = f"{jsonl_file.name}:{line_idx}"

                            # Determine observed_at from raw record's collected_at
                            raw_coll = rec.get("collected_at")
                            if raw_coll:
                                if isinstance(raw_coll, str):
                                    obs_time = datetime.fromisoformat(raw_coll)
                                elif isinstance(raw_coll, (int, float)):
                                    obs_time = datetime.fromtimestamp(raw_coll, tz=timezone.utc)
                                elif isinstance(raw_coll, datetime):
                                    obs_time = raw_coll
                                else:
                                    continue
                            else:
                                # If missing in JSON, do not guess: skip record
                                continue

                            if obs_time.tzinfo is None:
                                obs_time = obs_time.replace(tzinfo=timezone.utc)
                            else:
                                obs_time = obs_time.astimezone(timezone.utc)

                            # Normalize to establish authoritative canonical_id and fields
                            canonical = TelegramNormalizer.normalize(
                                rec,
                                collected_at=obs_time,
                                raw_reference=raw_ref,
                            )

                            obs = EngagementObservation.from_canonical_message(
                                canonical,
                                observed_at=obs_time,
                                raw_reference=raw_ref,
                            )
                            extracted_observations.append(obs)
                            canonical_id_observation_counts[obs.canonical_id] = (
                                canonical_id_observation_counts.get(obs.canonical_id, 0) + 1
                            )

                        except Exception as parse_err:
                            logger.debug("Failed extracting observation at %s:%d: %s", jsonl_file.name, line_idx, parse_err)
                            continue
            except Exception as file_err:
                logger.warning("Error reading JSONL file %s: %s", jsonl_file, file_err)
                continue

    total_extracted = len(extracted_observations)
    unique_canons = len(canonical_id_observation_counts)
    multi_obs_count = sum(1 for cnt in canonical_id_observation_counts.values() if cnt > 1)

    logger.info(
        "Extracted %d observations across %d files (%d unique messages, %d with multiple observations).",
        total_extracted,
        files_scanned,
        unique_canons,
        multi_obs_count,
    )

    # Persist idempotently into Parquet
    appended_count, total_after = append_engagement_observations(
        target_parquet,
        extracted_observations,
        metadata={"backfill_source": "raw_jsonl_import", "files_scanned": str(files_scanned)},
    )

    skipped = total_extracted - appended_count

    return BackfillResult(
        total_files_scanned=files_scanned,
        total_records_read=records_read,
        total_observations_extracted=total_extracted,
        total_unique_canonical_messages=unique_canons,
        messages_with_multiple_observations=multi_obs_count,
        new_observations_persisted=appended_count,
        duplicate_observations_skipped=skipped,
        total_observations_in_store=total_after,
        output_parquet_path=str(target_parquet),
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    res = backfill_raw_observations()
    print("=== Engagement Observation Backfill Result ===")
    print(f"Files scanned: {res.total_files_scanned}")
    print(f"Records read: {res.total_records_read}")
    print(f"Observations extracted: {res.total_observations_extracted}")
    print(f"Unique canonical messages: {res.total_unique_canonical_messages}")
    print(f"Messages with multiple observations: {res.messages_with_multiple_observations}")
    print(f"New observations persisted: {res.new_observations_persisted}")
    print(f"Duplicates skipped: {res.duplicate_observations_skipped}")
    print(f"Total observations in store: {res.total_observations_in_store}")
    print(f"Target file: {res.output_parquet_path}")
