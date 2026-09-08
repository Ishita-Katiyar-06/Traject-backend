"""Parquet persistence and append-only idempotent storage for Engagement Observations.

Implements Milestone 7B temporal engagement observation storage in Parquet format,
supporting repeated point-in-time measurements of the same canonical message.
"""

from datetime import datetime, timezone
import logging
import os
from pathlib import Path
from typing import Any, Iterable

import pyarrow as pa
import pyarrow.parquet as pq

from app.schemas.canonical_message import Platform
from app.schemas.engagement_observation import EngagementObservation

logger = logging.getLogger("traject.storage.engagement_observations")

# ------------------------------------------------------------------------------
# Stable EngagementObservation Apache Arrow Schema
# ------------------------------------------------------------------------------

ENGAGEMENT_OBSERVATION_ARROW_SCHEMA = pa.schema([
    # 1. Observation Identity
    pa.field("observation_id", pa.string(), nullable=False),
    pa.field("canonical_id", pa.string(), nullable=False),
    pa.field("platform", pa.string(), nullable=False),
    pa.field("native_id", pa.string(), nullable=True),
    pa.field("channel_id", pa.string(), nullable=True),

    # 2. Observation Timing (strictly UTC)
    pa.field("observed_at", pa.timestamp("us", tz="UTC"), nullable=False),

    # 3. Dynamic Engagement Metrics
    pa.field("views_count", pa.int64(), nullable=True),
    pa.field("forwards_count", pa.int64(), nullable=True),
    pa.field("replies_count", pa.int64(), nullable=True),
    pa.field("reactions", pa.map_(pa.string(), pa.int64()), nullable=False),

    # 4. Provenance
    pa.field("raw_reference", pa.string(), nullable=True),
])


def observations_to_arrow_table(
    observations: Iterable[EngagementObservation],
    metadata: dict[str, str] | None = None,
) -> pa.Table:
    """Convert an iterable of EngagementObservation instances into a PyArrow Table."""
    rows: list[dict[str, Any]] = []

    for obs in observations:
        reactions_list: list[tuple[str, int]] = []
        if obs.reactions:
            reactions_list = [(str(k), int(v)) for k, v in obs.reactions.items()]

        rows.append({
            "observation_id": obs.observation_id,
            "canonical_id": obs.canonical_id,
            "platform": obs.platform.value if hasattr(obs.platform, "value") else str(obs.platform),
            "native_id": obs.native_id,
            "channel_id": obs.channel_id,
            "observed_at": obs.observed_at,
            "views_count": obs.views_count,
            "forwards_count": obs.forwards_count,
            "replies_count": obs.replies_count,
            "reactions": reactions_list,
            "raw_reference": obs.raw_reference,
        })

    if not rows:
        table = pa.Table.from_batches([], schema=ENGAGEMENT_OBSERVATION_ARROW_SCHEMA)
    else:
        table = pa.Table.from_pylist(rows, schema=ENGAGEMENT_OBSERVATION_ARROW_SCHEMA)

    meta_dict: dict[bytes, bytes] = {}
    if table.schema.metadata:
        meta_dict.update(table.schema.metadata)
    if metadata:
        for k, v in metadata.items():
            meta_dict[k.encode("utf-8")] = str(v).encode("utf-8")

    meta_dict[b"traject_schema"] = b"engagement_observation"
    meta_dict[b"traject_schema_version"] = b"1.0"
    meta_dict[b"created_at_utc"] = datetime.now(timezone.utc).isoformat().encode("utf-8")

    return table.replace_schema_metadata(meta_dict)


def arrow_table_to_observations(table: pa.Table) -> list[EngagementObservation]:
    """Reconstruct domain EngagementObservation models from a PyArrow Table."""
    observations: list[EngagementObservation] = []
    pylist = table.to_pylist()

    for item in pylist:
        reactions_raw = item.get("reactions") or []
        reactions_dict: dict[str, int] = {}
        if isinstance(reactions_raw, list):
            for entry in reactions_raw:
                if isinstance(entry, (tuple, list)) and len(entry) == 2:
                    reactions_dict[str(entry[0])] = int(entry[1])
                elif isinstance(entry, dict) and "key" in entry and "value" in entry:
                    reactions_dict[str(entry["key"])] = int(entry["value"])
        elif isinstance(reactions_raw, dict):
            reactions_dict = {str(k): int(v) for k, v in reactions_raw.items()}

        raw_platform = item["platform"]
        try:
            platform_enum = Platform(raw_platform)
        except ValueError:
            platform_enum = Platform.TELEGRAM

        obs_at = item["observed_at"]
        if isinstance(obs_at, datetime):
            if obs_at.tzinfo is None:
                obs_at = obs_at.replace(tzinfo=timezone.utc)
            else:
                obs_at = obs_at.astimezone(timezone.utc)

        obs = EngagementObservation(
            observation_id=item["observation_id"],
            canonical_id=item["canonical_id"],
            platform=platform_enum,
            native_id=item.get("native_id"),
            channel_id=item.get("channel_id"),
            observed_at=obs_at,
            views_count=item.get("views_count"),
            forwards_count=item.get("forwards_count"),
            replies_count=item.get("replies_count"),
            reactions=reactions_dict,
            raw_reference=item.get("raw_reference"),
        )
        observations.append(obs)

    return observations


def write_engagement_observations(
    observations: Iterable[EngagementObservation],
    output_path: Path | str,
    metadata: dict[str, str] | None = None,
    overwrite: bool = False,
) -> int:
    """Serialize EngagementObservation models to a Parquet file."""
    path = Path(output_path).resolve()
    if path.exists() and not overwrite:
        raise FileExistsError(f"Target Parquet file already exists: {path}")

    path.parent.mkdir(parents=True, exist_ok=True)
    obs_list = list(observations)
    table = observations_to_arrow_table(obs_list, metadata=metadata)

    pq.write_table(
        table,
        path,
        compression="SNAPPY",
        flavor=None,
    )
    logger.info("Saved %d engagement observations to %s", len(obs_list), path)
    return len(obs_list)


def read_engagement_observations(
    parquet_path: Path | str,
    canonical_id: str | None = None,
) -> list[EngagementObservation]:
    """Read EngagementObservation records from Parquet, optionally filtered by canonical_id."""
    path = Path(parquet_path).resolve()
    if not path.exists():
        return []

    filters = None
    if canonical_id is not None:
        filters = [("canonical_id", "=", canonical_id)]

    table = pq.read_table(path, filters=filters)
    return arrow_table_to_observations(table)


def read_observation_parquet_metadata(parquet_path: Path | str) -> dict[str, str]:
    """Read custom application metadata from Parquet file footer."""
    path = Path(parquet_path).resolve()
    if not path.exists():
        return {}

    schema = pq.read_schema(path)
    if not schema.metadata:
        return {}

    return {
        k.decode("utf-8", errors="ignore"): v.decode("utf-8", errors="ignore")
        for k, v in schema.metadata.items()
    }


def append_engagement_observations(
    parquet_path: Path | str,
    incoming: Iterable[EngagementObservation],
    metadata: dict[str, str] | None = None,
) -> tuple[int, int]:
    """Append incoming engagement observations to Parquet idempotently.
    
    Deduplication Key:
        `observation_id` (derived from canonical_id + observed_at).
        Multiple observations for the SAME canonical_id are permitted and preserved,
        provided their observation_ids / observed_at timestamps differ.
        
    Returns:
        tuple[int, int]: (newly_appended_count, total_count_after_append).
    """
    path = Path(parquet_path).resolve()
    new_list = list(incoming)
    if not new_list:
        if path.exists():
            existing = read_engagement_observations(path)
            return 0, len(existing)
        return 0, 0

    if not path.exists():
        # Deduplicate incoming batch among itself by observation_id
        seen_ids: set[str] = set()
        deduped_initial: list[EngagementObservation] = []
        for obs in new_list:
            if obs.observation_id not in seen_ids:
                seen_ids.add(obs.observation_id)
                deduped_initial.append(obs)
        written = write_engagement_observations(deduped_initial, path, metadata=metadata, overwrite=True)
        return written, written

    existing_observations = read_engagement_observations(path)
    existing_obs_ids = {obs.observation_id for obs in existing_observations}

    # Strict idempotency against observation identity
    distinct_new: list[EngagementObservation] = []
    seen_in_batch: set[str] = set()
    for obs in new_list:
        if obs.observation_id not in existing_obs_ids and obs.observation_id not in seen_in_batch:
            seen_in_batch.add(obs.observation_id)
            distinct_new.append(obs)

    if not distinct_new:
        logger.info(
            "No new distinct engagement observations to append to %s (all %d already present).",
            path,
            len(new_list),
        )
        return 0, len(existing_observations)

    # Combine existing + new records
    combined = existing_observations + distinct_new

    # Merge metadata
    combined_meta = read_observation_parquet_metadata(path)
    if metadata:
        combined_meta.update(metadata)
    combined_meta["last_appended_at"] = datetime.now(timezone.utc).isoformat()
    combined_meta["appended_observations_count"] = str(len(distinct_new))
    combined_meta["total_observations_count"] = str(len(combined))

    # Atomic write to temporary file in same directory
    temp_path = path.with_suffix(".tmp.parquet")
    try:
        write_engagement_observations(combined, temp_path, metadata=combined_meta, overwrite=True)
        os.replace(temp_path, path)
        logger.info(
            "Successfully appended %d new engagement observations to %s (new total: %d).",
            len(distinct_new),
            path,
            len(combined),
        )
        return len(distinct_new), len(combined)
    except Exception as e:
        logger.error("Failed to safely append engagement observations to %s: %s", path, e)
        if temp_path.exists():
            try:
                temp_path.unlink()
            except OSError:
                pass
        raise
