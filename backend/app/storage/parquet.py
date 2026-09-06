import argparse
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import pyarrow as pa
import pyarrow.parquet as pq

from app.quality.validation import QualityReport, QualitySeverity, process_quality
from app.replay.telegram_jsonl import TelegramJSONLReplayer
from app.schemas.canonical_message import AuthorType, CanonicalMessage, Platform

logger = logging.getLogger("traject.storage.parquet")

# ------------------------------------------------------------------------------
# Stable CanonicalMessage Apache Arrow Schema
# ------------------------------------------------------------------------------

CANONICAL_MESSAGE_ARROW_SCHEMA = pa.schema([
    # 1. Identity
    pa.field("canonical_id", pa.string(), nullable=False),
    pa.field("platform", pa.string(), nullable=False),
    pa.field("native_id", pa.string(), nullable=False),

    # 2. Author / Source
    pa.field("author_id", pa.string(), nullable=False),
    pa.field("author_username", pa.string(), nullable=True),
    pa.field("author_type", pa.string(), nullable=False),
    pa.field("channel_title", pa.string(), nullable=True),
    pa.field("subscriber_count", pa.int64(), nullable=True),

    # 3. Temporal (strictly timezone-aware UTC)
    pa.field("published_at", pa.timestamp("us", tz="UTC"), nullable=False),
    pa.field("collected_at", pa.timestamp("us", tz="UTC"), nullable=False),

    # 4. Content
    pa.field("text_content", pa.string(), nullable=False),
    pa.field("language", pa.string(), nullable=True),
    pa.field("media_types", pa.list_(pa.string()), nullable=False),
    pa.field("has_media", pa.bool_(), nullable=False),

    # 5. Topology / Lineage
    pa.field("is_forward", pa.bool_(), nullable=False),
    pa.field("is_repost", pa.bool_(), nullable=False),
    pa.field("origin_source_id", pa.string(), nullable=True),
    pa.field("reply_to_id", pa.string(), nullable=True),
    pa.field("thread_id", pa.string(), nullable=True),

    # 6. Engagement
    pa.field("views_count", pa.int64(), nullable=True),
    pa.field("forwards_count", pa.int64(), nullable=True),
    pa.field("replies_count", pa.int64(), nullable=True),
    pa.field("reactions", pa.map_(pa.string(), pa.int64()), nullable=False),

    # 7. Extracted Entities
    pa.field("urls", pa.list_(pa.string()), nullable=False),
    pa.field("hashtags", pa.list_(pa.string()), nullable=False),
    pa.field("mentions", pa.list_(pa.string()), nullable=False),

    # 8. Provenance
    pa.field("raw_reference", pa.string(), nullable=True),
])


@dataclass
class ProcessedDatasetSummary:
    """Summary of a raw-to-Parquet conversion run."""
    source_path: str
    output_path: str
    files_processed: int = 0
    records_read: int = 0
    records_normalized: int = 0
    records_failed: int = 0
    records_invalid: int = 0
    duplicates_detected: int = 0
    records_written: int = 0
    quality_report_path: str = ""
    failures: list[dict[str, Any]] = field(default_factory=list)



def canonical_messages_to_arrow_table(
    messages: Iterable[CanonicalMessage],
    metadata: dict[str, str] | None = None,
) -> pa.Table:
    """Convert an iterable of CanonicalMessage instances into a PyArrow Table.
    
    Args:
        messages: Iterable of validated CanonicalMessage domain models.
        metadata: Optional custom key-value metadata to attach to the Parquet schema.
        
    Returns:
        pa.Table conforming to CANONICAL_MESSAGE_ARROW_SCHEMA.
    """
    rows: list[dict[str, Any]] = []

    for msg in messages:
        if not isinstance(msg, CanonicalMessage):
            raise TypeError(
                f"Expected CanonicalMessage instance, got {type(msg).__name__} ({msg!r})"
            )

        # Convert dict reactions into list of (key, value) pairs for Arrow map_
        reaction_items = (
            [(str(k), int(v)) for k, v in msg.reactions.items()]
            if msg.reactions
            else []
        )

        row = {
            "canonical_id": msg.canonical_id,
            "platform": msg.platform.value if isinstance(msg.platform, Platform) else str(msg.platform),
            "native_id": msg.native_id,
            "author_id": msg.author_id,
            "author_username": msg.author_username,
            "author_type": msg.author_type.value if isinstance(msg.author_type, AuthorType) else str(msg.author_type),
            "channel_title": msg.channel_title,
            "subscriber_count": msg.subscriber_count,
            "published_at": msg.published_at,
            "collected_at": msg.collected_at,
            "text_content": msg.text_content,
            "language": msg.language,
            "media_types": list(msg.media_types) if msg.media_types else [],
            "has_media": bool(msg.has_media),
            "is_forward": bool(msg.is_forward),
            "is_repost": bool(msg.is_repost),
            "origin_source_id": msg.origin_source_id,
            "reply_to_id": msg.reply_to_id,
            "thread_id": msg.thread_id,
            "views_count": msg.views_count,
            "forwards_count": msg.forwards_count,
            "replies_count": msg.replies_count,
            "reactions": reaction_items,
            "urls": list(msg.urls) if msg.urls else [],
            "hashtags": list(msg.hashtags) if msg.hashtags else [],
            "mentions": list(msg.mentions) if msg.mentions else [],
            "raw_reference": msg.raw_reference,
        }
        rows.append(row)

    if not rows:
        raise ValueError("Cannot write empty CanonicalMessage collection to Parquet.")

    # Prepare schema with metadata
    schema = CANONICAL_MESSAGE_ARROW_SCHEMA
    if metadata:
        existing_meta = schema.metadata or {}
        encoded_meta = {
            (k.encode("utf-8") if isinstance(k, str) else k): (v.encode("utf-8") if isinstance(v, str) else v)
            for k, v in metadata.items()
        }
        schema = schema.with_metadata({**existing_meta, **encoded_meta})

    return pa.Table.from_pylist(rows, schema=schema)


def write_canonical_messages(
    messages: Iterable[CanonicalMessage],
    output_path: Path | str,
    metadata: dict[str, str] | None = None,
    overwrite: bool = False,
) -> int:
    """Write an iterable of CanonicalMessage instances to a Snappy-compressed Parquet file.
    
    Args:
        messages: Iterable of validated CanonicalMessage instances.
        output_path: Target .parquet destination file.
        metadata: Optional custom provenance and schema metadata.
        overwrite: When False, raises FileExistsError if destination exists.
        
    Returns:
        int: Number of rows written to the Parquet dataset.
    """
    path = Path(output_path).resolve()

    if path.exists() and not overwrite:
        raise FileExistsError(
            f"Destination Parquet file already exists: {path}\n"
            "Use overwrite=True or specify a different output path to replace."
        )

    # Ensure parent directory exists
    path.parent.mkdir(parents=True, exist_ok=True)

    table = canonical_messages_to_arrow_table(messages, metadata=metadata)

    pq.write_table(
        table,
        path,
        compression="SNAPPY",
        flavor=None,
    )

    return table.num_rows


def read_parquet_metadata(file_path: Path | str) -> dict[str, str]:
    """Read custom key-value schema metadata from a Parquet file footer.
    
    Args:
        file_path: Path to the Parquet file.
        
    Returns:
        dict[str, str]: Decoded custom metadata key-value pairs.
    """
    path = Path(file_path).resolve()
    if not path.is_file():
        raise FileNotFoundError(f"Parquet file not found: {path}")

    parquet_file = pq.ParquetFile(path)
    raw_meta = parquet_file.schema_arrow.metadata or {}

    decoded_meta: dict[str, str] = {}
    for k, v in raw_meta.items():
        key_str = k.decode("utf-8") if isinstance(k, bytes) else str(k)
        val_str = v.decode("utf-8") if isinstance(v, bytes) else str(v)
        decoded_meta[key_str] = val_str

    return decoded_meta


def read_canonical_messages(file_path: Path | str) -> list[CanonicalMessage]:
    """Read a Parquet file and reconstruct validated CanonicalMessage domain models.
    
    Args:
        file_path: Path to the Parquet file.
        
    Returns:
        list[CanonicalMessage]: Reconstructed, validated domain models.
    """
    path = Path(file_path).resolve()
    if not path.is_file():
        raise FileNotFoundError(f"Parquet file not found: {path}")

    table = pq.read_table(path)
    raw_rows = table.to_pylist()

    messages: list[CanonicalMessage] = []
    for row in raw_rows:
        # Convert reaction pairs back to dict[str, int]
        reactions_raw = row.get("reactions")
        if isinstance(reactions_raw, list):
            reactions_dict = {k: v for k, v in reactions_raw}
        elif isinstance(reactions_raw, dict):
            reactions_dict = reactions_raw
        else:
            reactions_dict = {}
        row["reactions"] = reactions_dict

        # Ensure published_at and collected_at are timezone-aware UTC
        for ts_field in ("published_at", "collected_at"):
            val = row.get(ts_field)
            if isinstance(val, datetime):
                if val.tzinfo is None:
                    row[ts_field] = val.replace(tzinfo=timezone.utc)
                else:
                    row[ts_field] = val.astimezone(timezone.utc)

        messages.append(CanonicalMessage(**row))

    return messages


def append_canonical_messages(
    parquet_path: Path | str,
    new_messages: Iterable[CanonicalMessage],
    metadata: dict[str, str] | None = None,
) -> tuple[int, int]:
    """Safely append new CanonicalMessage domain records to an existing Parquet dataset.
    
    Guarantees:
    - Idempotency: Excludes any incoming records whose canonical_id already exists in the dataset.
    - Preserves existing schema and existing rows without data loss.
    - Atomic write: writes combined dataset to a temporary file, then replaces destination.
    - Returns (records_appended, total_cumulative_records).
    
    Args:
        parquet_path: Path to the target Parquet file.
        new_messages: Iterable of incoming CanonicalMessage objects.
        metadata: Optional metadata updates to store in Parquet footer.
        
    Returns:
        tuple[int, int]: (newly_appended_count, total_count_after_append).
    """
    path = Path(parquet_path).resolve()
    new_list = list(new_messages)

    if not path.exists():
        if not new_list:
            return 0, 0
        written = write_canonical_messages(new_list, path, metadata=metadata, overwrite=True)
        return written, written

    existing_messages = read_canonical_messages(path)
    existing_ids = {m.canonical_id for m in existing_messages}

    # Strict deduplication against existing canonical records
    distinct_new = [m for m in new_list if m.canonical_id not in existing_ids]

    if not distinct_new:
        logger.info(
            "No new distinct canonical records to append to %s (all %d incoming records already present).",
            path,
            len(new_list),
        )
        return 0, len(existing_messages)

    # Combine existing + new records
    combined = existing_messages + distinct_new

    # Merge metadata
    combined_meta = read_parquet_metadata(path)
    if metadata:
        combined_meta.update(metadata)
    combined_meta["last_appended_at"] = datetime.now(timezone.utc).isoformat()
    combined_meta["appended_records_count"] = str(len(distinct_new))
    combined_meta["total_records_count"] = str(len(combined))

    # Atomic write to temporary file in same directory
    temp_path = path.with_suffix(".tmp.parquet")
    try:
        write_canonical_messages(combined, temp_path, metadata=combined_meta, overwrite=True)
        os.replace(temp_path, path)
        logger.info(
            "Successfully appended %d new records to %s (new total: %d records).",
            len(distinct_new),
            path,
            len(combined),
        )
        return len(distinct_new), len(combined)
    except Exception as e:
        logger.error("Failed to safely append to Parquet file %s: %s", path, e)
        if temp_path.exists():
            try:
                temp_path.unlink()
            except OSError:
                pass
        raise


def build_processed_dataset(
    input_raw_path: Path | str,
    output_parquet_path: Path | str,
    overwrite: bool = False,
) -> ProcessedDatasetSummary:
    """End-to-end pipeline reading raw JSONL, normalizing records, applying quality & deduplication, and writing Parquet.
    
    Reuses existing TelegramJSONLReplayer, TelegramNormalizer, and process_quality.
    Generates paired <output>.parquet and <output>.quality.json artifacts.
    
    Args:
        input_raw_path: Path to raw JSONL file or directory.
        output_parquet_path: Target Parquet file destination.
        overwrite: Whether to overwrite existing Parquet and quality report files.
        
    Returns:
        ProcessedDatasetSummary: Summary metrics of the conversion.
    """
    in_path = Path(input_raw_path).resolve()
    out_path = Path(output_parquet_path).resolve()

    # Determine paired quality report path
    if out_path.suffix.lower() == ".parquet":
        quality_report_path = out_path.with_name(f"{out_path.stem}.quality.json")
    else:
        quality_report_path = out_path.with_suffix(".quality.json")

    # Overwrite guard applied atomically across both destination artifacts
    if not overwrite:
        if out_path.exists():
            raise FileExistsError(
                f"Destination Parquet file already exists: {out_path}\n"
                "Use overwrite=True or --overwrite to replace existing dataset."
            )
        if quality_report_path.exists():
            raise FileExistsError(
                f"Destination Quality Report already exists: {quality_report_path}\n"
                "Use overwrite=True or --overwrite to replace existing dataset."
            )

    # 1. Run offline replay to obtain normalized CanonicalMessages
    replay_summary = TelegramJSONLReplayer.run(in_path)

    # 2. Extract source file names for metadata provenance
    source_names = sorted({
        Path(rec.source_file).name for rec in replay_summary.results
    })

    metadata = {
        "dataset_platform": "telegram",
        "schema_version": "1.0.0",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source_type": "raw_jsonl_replay",
        "normalization_version": "1.0.0",
        "raw_sources": ",".join(source_names),
    }

    # 3. Quality Validation and Deterministic Deduplication
    clean_messages, quality_report = process_quality(
        replay_summary.results,
        dataset_platform="telegram",
        metadata=metadata,
    )

    # 4. Write Parquet if messages exist
    records_written = 0
    if clean_messages:
        records_written = write_canonical_messages(
            clean_messages,
            out_path,
            metadata=metadata,
            overwrite=overwrite,
        )
    quality_report.records_written = records_written

    # 5. Save Paired Quality Report JSON
    quality_report.save_json(quality_report_path)

    # Aggregate failure descriptors
    all_failures = list(replay_summary.failures)
    for issue in quality_report.issues:
        if issue.severity == QualitySeverity.ERROR:
            all_failures.append({
                "source_file": Path(issue.source_file).name if issue.source_file else "unknown",
                "line_number": issue.line_number or "N/A",
                "error": f"[{issue.code}] {issue.message}",
            })

    return ProcessedDatasetSummary(
        source_path=str(in_path),
        output_path=str(out_path),
        files_processed=replay_summary.files_processed,
        records_read=replay_summary.records_read,
        records_normalized=replay_summary.records_normalized,
        records_failed=replay_summary.records_failed,
        records_invalid=quality_report.records_invalid,
        duplicates_detected=quality_report.duplicates_detected,
        records_written=records_written,
        quality_report_path=str(quality_report_path),
        failures=all_failures,
    )


def _format_cli_summary(summary: ProcessedDatasetSummary) -> str:
    """Format the processing summary for terminal output."""
    lines = [
        "Telegram Parquet build complete",
        "",
        "Source:",
        f"  {summary.source_path}",
        "",
        f"Files processed: {summary.files_processed}",
        f"Records read: {summary.records_read}",
        f"Records normalized: {summary.records_normalized}",
        f"Records failed: {summary.records_failed}",
        f"Records invalid: {summary.records_invalid}",
        f"Duplicates detected: {summary.duplicates_detected}",
        f"Records written: {summary.records_written}",
        "",
        "Output:",
        f"  {summary.output_path}",
    ]

    if summary.quality_report_path:
        lines.append("")
        lines.append("Quality Report:")
        lines.append(f"  {summary.quality_report_path}")

    if summary.failures:
        lines.append("")
        lines.append("Failures:")
        for fail in summary.failures:
            lines.append(f"  {fail['source_file']}:{fail['line_number']} — {fail['error']}")

    return "\n".join(lines)



def _main() -> None:
    """CLI entrypoint for generating processed Parquet from raw JSONL."""
    parser = argparse.ArgumentParser(
        description="TRAJECT Raw JSONL to Processed Parquet Converter"
    )
    parser.add_argument(
        "--input",
        "-i",
        required=True,
        help="Path to raw JSONL file or directory containing .jsonl files",
    )
    parser.add_argument(
        "--output",
        "-o",
        required=True,
        help="Path to target .parquet destination file",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        default=False,
        help="Overwrite target Parquet file if it already exists",
    )

    args = parser.parse_args()
    summary = build_processed_dataset(
        input_raw_path=args.input,
        output_parquet_path=args.output,
        overwrite=args.overwrite,
    )
    print(_format_cli_summary(summary))


if __name__ == "__main__":
    _main()
