import argparse
import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterator

from app.normalizers.telegram import TelegramNormalizer
from app.schemas.canonical_message import CanonicalMessage

logger = logging.getLogger("traject.replay.telegram_jsonl")


@dataclass
class ReplayRecord:
    """Outcome of replaying a single raw Telegram record."""
    source_file: str
    line_number: int
    raw_record: dict[str, Any] | None
    canonical_message: CanonicalMessage | None = None
    error: str | None = None

    @property
    def is_success(self) -> bool:
        """True if the record normalized into a valid CanonicalMessage."""
        return self.canonical_message is not None and self.error is None


@dataclass
class ReplaySummary:
    """Aggregated statistics and results of an offline replay run."""
    files_processed: int = 0
    records_read: int = 0
    records_normalized: int = 0
    records_failed: int = 0
    failures: list[dict[str, Any]] = field(default_factory=list)
    results: list[ReplayRecord] = field(default_factory=list)


def iter_raw_telegram_jsonl(
    file_path: Path | str,
) -> Iterator[tuple[int, dict[str, Any] | None, str | None]]:
    """Incrementally stream and parse a raw Telegram JSONL file line-by-line.
    
    Args:
        file_path: Absolute or relative path to the raw JSONL file.
        
    Yields:
        tuple[int, dict[str, Any] | None, str | None]:
            (line_number, parsed_json_dict, error_message)
    """
    path = Path(file_path)
    if not path.is_file():
        raise FileNotFoundError(f"Raw JSONL file not found: {path}")

    # Raw files are treated as immutable and opened strictly read-only
    with open(path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, start=1):
            clean_line = line.strip()
            # Ignore intentional empty/blank lines without error
            if not clean_line:
                continue

            try:
                parsed = json.loads(clean_line)
            except json.JSONDecodeError as e:
                yield line_num, None, f"Malformed JSON: {e.msg} (col {e.colno})"
                continue

            if not isinstance(parsed, dict):
                yield line_num, None, f"Expected JSON object (dict), got {type(parsed).__name__}"
                continue

            yield line_num, parsed, None


def validate_raw_telegram_record(raw: dict[str, Any]) -> tuple[bool, str | None]:
    """Lightweight pre-validation ensuring raw records have structural fields needed by the normalizer.
    
    Validates:
    - Message ID ('id' or 'message_id')
    - Author/Chat identifier ('peer_id', 'chat.id', 'from.id', or 'from_id')
    - Timestamp ('date' or 'timestamp')
    
    Returns:
        tuple[bool, str | None]: (is_valid, descriptive_error_or_none)
    """
    # 1. Message ID
    msg_id = raw.get("id") or raw.get("message_id")
    if msg_id is None or str(msg_id).strip() == "":
        return False, "Missing Telegram message identifier ('id' or 'message_id')"

    # 2. Author / Peer / Chat ID
    chat = raw.get("chat") if isinstance(raw.get("chat"), dict) else {}
    sender = raw.get("from") if isinstance(raw.get("from"), dict) else {}
    author_id = (
        raw.get("peer_id")
        or chat.get("id")
        or sender.get("id")
        or raw.get("from_id")
    )
    if author_id is None or str(author_id).strip() == "":
        return False, "Unable to determine chat or author identifier ('peer_id', 'chat.id', or 'from.id' missing)"

    # 3. Timestamp
    raw_date = raw.get("date") or raw.get("timestamp")
    if raw_date is None or (isinstance(raw_date, str) and not raw_date.strip()):
        return False, "Missing Telegram timestamp ('date' or 'timestamp')"

    return True, None


def replay_telegram_record(
    raw: dict[str, Any],
    source_file: str,
    line_number: int,
) -> ReplayRecord:
    """Validate and normalize a single raw Telegram record into a CanonicalMessage.
    
    Preserves exact provenance (source file and line number) and retains the original
    `collected_at` timestamp from the raw payload.
    """
    # 1. Pre-validate required structure
    is_valid, val_err = validate_raw_telegram_record(raw)
    if not is_valid:
        return ReplayRecord(
            source_file=source_file,
            line_number=line_number,
            raw_record=raw,
            canonical_message=None,
            error=val_err,
        )

    # 2. Resolve provenance reference
    # Retain stored raw_reference if present, or anchor to source_file:line_number
    filename = Path(source_file).name
    raw_reference = raw.get("raw_reference") or f"{filename}:{line_number}"

    # 3. Replay through the existing TelegramNormalizer
    try:
        canonical = TelegramNormalizer.normalize(
            raw,
            raw_reference=raw_reference,
        )
        return ReplayRecord(
            source_file=source_file,
            line_number=line_number,
            raw_record=raw,
            canonical_message=canonical,
            error=None,
        )
    except Exception as e:
        return ReplayRecord(
            source_file=source_file,
            line_number=line_number,
            raw_record=raw,
            canonical_message=None,
            error=f"Normalization failed: {type(e).__name__} — {str(e)}",
        )


def replay_file(file_path: Path | str) -> Iterator[ReplayRecord]:
    """Stream and replay all records in a single raw Telegram JSONL file.
    
    Args:
        file_path: Path to the .jsonl file.
        
    Yields:
        ReplayRecord for every line in the file.
    """
    path = Path(file_path).resolve()
    for line_num, raw_dict, parse_err in iter_raw_telegram_jsonl(path):
        if parse_err is not None:
            yield ReplayRecord(
                source_file=str(path),
                line_number=line_num,
                raw_record=None,
                canonical_message=None,
                error=parse_err,
            )
            continue

        yield replay_telegram_record(
            raw=raw_dict,  # type: ignore[arg-type]
            source_file=str(path),
            line_number=line_num,
        )


def replay_directory(dir_path: Path | str) -> Iterator[ReplayRecord]:
    """Discover and replay all .jsonl files in a directory in deterministic order.
    
    Args:
        dir_path: Path to directory containing raw JSONL files.
        
    Yields:
        ReplayRecord for every line across all discovered files.
    """
    path = Path(dir_path).resolve()
    if not path.is_dir():
        raise NotADirectoryError(f"Target is not a directory: {path}")

    # Stable alphabetical sort on filenames ensures deterministic replay
    jsonl_files = sorted(path.glob("*.jsonl"), key=lambda p: p.name)
    for f in jsonl_files:
        yield from replay_file(f)


class TelegramJSONLReplayer:
    """High-level runner that executes offline replay over files or directories."""

    @classmethod
    def run(cls, input_path: Path | str) -> ReplaySummary:
        """Replay a single .jsonl file or directory of .jsonl files and aggregate summary.
        
        Args:
            input_path: Path to file or directory.
            
        Returns:
            ReplaySummary with overall metrics and failure details.
        """
        path = Path(input_path).resolve()
        if not path.exists():
            raise FileNotFoundError(f"Input path does not exist: {path}")

        summary = ReplaySummary()

        if path.is_file():
            summary.files_processed = 1
            records_iter = replay_file(path)
        elif path.is_dir():
            files = sorted(path.glob("*.jsonl"), key=lambda p: p.name)
            summary.files_processed = len(files)
            records_iter = replay_directory(path)
        else:
            raise ValueError(f"Unsupported path type: {path}")

        for record in records_iter:
            summary.records_read += 1
            summary.results.append(record)

            if record.is_success:
                summary.records_normalized += 1
            else:
                summary.records_failed += 1
                summary.failures.append({
                    "source_file": Path(record.source_file).name,
                    "line_number": record.line_number,
                    "error": record.error,
                })

        return summary


def _format_summary(summary: ReplaySummary) -> str:
    """Format replay summary for console output."""
    lines = [
        "Telegram replay complete",
        "",
        f"Files processed: {summary.files_processed}",
        f"Records read: {summary.records_read}",
        f"Records normalized: {summary.records_normalized}",
        f"Records failed: {summary.records_failed}",
    ]

    if summary.failures:
        lines.append("")
        lines.append("Failures:")
        for fail in summary.failures:
            lines.append(f"  {fail['source_file']}:{fail['line_number']} — {fail['error']}")

    return "\n".join(lines)


def _main() -> None:
    """CLI entrypoint for running Telegram JSONL replay."""
    parser = argparse.ArgumentParser(
        description="TRAJECT Offline Telegram Raw JSONL Replay and Validation"
    )
    parser.add_argument(
        "--input",
        "-i",
        required=True,
        help="Path to a single raw .jsonl file or directory containing .jsonl files",
    )
    args = parser.parse_args()

    summary = TelegramJSONLReplayer.run(args.input)
    print(_format_summary(summary))


if __name__ == "__main__":
    _main()
