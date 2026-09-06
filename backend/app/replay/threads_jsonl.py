import argparse
import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterator

from app.normalizers.threads import ThreadsNormalizer
from app.schemas.canonical_message import CanonicalMessage

logger = logging.getLogger("traject.replay.threads_jsonl")


@dataclass
class ThreadsReplayRecord:
    """Outcome of replaying a single raw Threads post."""
    source_file: str
    line_number: int
    raw_record: dict[str, Any] | None
    canonical_message: CanonicalMessage | None = None
    error: str | None = None

    @property
    def is_success(self) -> bool:
        return self.canonical_message is not None and self.error is None


@dataclass
class ThreadsReplaySummary:
    """Aggregated statistics of an offline Threads replay run."""
    files_processed: int = 0
    records_read: int = 0
    records_normalized: int = 0
    records_failed: int = 0
    failures: list[dict[str, Any]] = field(default_factory=list)
    results: list[ThreadsReplayRecord] = field(default_factory=list)


def iter_raw_threads_jsonl(
    file_path: Path | str,
) -> Iterator[tuple[int, dict[str, Any] | None, str | None]]:
    """Incrementally stream and parse a raw Threads JSONL file line-by-line."""
    path = Path(file_path)
    if not path.is_file():
        raise FileNotFoundError(f"Raw Threads JSONL file not found: {path}")

    with open(path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, start=1):
            clean_line = line.strip()
            if not clean_line:
                continue

            try:
                parsed = json.loads(clean_line)
            except json.JSONDecodeError as e:
                yield line_num, None, f"Malformed JSON: {e.msg} (col {e.colno})"
                continue

            if not isinstance(parsed, dict):
                yield line_num, None, f"Expected JSON object, got {type(parsed).__name__}"
                continue

            yield line_num, parsed, None


def validate_raw_threads_record(raw: dict[str, Any]) -> tuple[bool, str | None]:
    """Lightweight structural pre-validation for raw Threads records."""
    if not isinstance(raw, dict):
        return False, "Record must be a JSON object"
    if not raw.get("id"):
        return False, "Missing post 'id'"
    if not raw.get("timestamp") and not raw.get("created_at"):
        return False, "Missing 'timestamp'"
    return True, None


class ThreadsJSONLReplayer:
    """Offline streaming replayer for raw Threads JSONL files."""

    def __init__(self):
        self.normalizer = ThreadsNormalizer()

    def replay_file(self, file_path: Path | str) -> Iterator[ThreadsReplayRecord]:
        path = Path(file_path).resolve()
        source_name = path.name

        for line_num, raw_record, parse_error in iter_raw_threads_jsonl(path):
            if parse_error or raw_record is None:
                yield ThreadsReplayRecord(
                    source_file=source_name,
                    line_number=line_num,
                    raw_record=raw_record,
                    error=parse_error or "Unknown parse error",
                )
                continue

            is_valid, validation_error = validate_raw_threads_record(raw_record)
            if not is_valid:
                yield ThreadsReplayRecord(
                    source_file=source_name,
                    line_number=line_num,
                    raw_record=raw_record,
                    error=validation_error,
                )
                continue

            raw_ref = f"{source_name}:line_{line_num}"
            try:
                canonical = self.normalizer.normalize(
                    raw_record,
                    raw_reference=raw_ref,
                )
                yield ThreadsReplayRecord(
                    source_file=source_name,
                    line_number=line_num,
                    raw_record=raw_record,
                    canonical_message=canonical,
                )
            except Exception as e:
                yield ThreadsReplayRecord(
                    source_file=source_name,
                    line_number=line_num,
                    raw_record=raw_record,
                    error=f"Normalization failed: {e}",
                )

    def replay_path(self, target_path: Path | str) -> ThreadsReplaySummary:
        path = Path(target_path).resolve()
        summary = ThreadsReplaySummary()

        if path.is_file():
            files = [path]
        elif path.is_dir():
            files = sorted(list(path.glob("*.jsonl")))
        else:
            raise FileNotFoundError(f"Target path not found: {path}")

        for f in files:
            summary.files_processed += 1
            for record in self.replay_file(f):
                summary.records_read += 1
                summary.results.append(record)
                if record.is_success:
                    summary.records_normalized += 1
                else:
                    summary.records_failed += 1
                    summary.failures.append({
                        "file": record.source_file,
                        "line": record.line_number,
                        "error": record.error,
                    })

        return summary


def main():
    """CLI runner for offline Threads replay."""
    parser = argparse.ArgumentParser(description="TRAJECT Offline Meta Threads JSONL Replay Engine")
    parser.add_argument("--input", required=True, help="Path to raw Threads JSONL file or directory")
    parser.add_argument("--output", default=None, help="Optional output path for normalized JSONL")

    args = parser.parse_args()

    replayer = ThreadsJSONLReplayer()
    summary = replayer.replay_path(args.input)

    print("\n" + "=" * 60)
    print("TRAJECT Offline Threads Replay Complete")
    print("=" * 60)
    print(f"Files Processed:      {summary.files_processed}")
    print(f"Total Records Read:   {summary.records_read}")
    print(f"Normalized Messages:  {summary.records_normalized}")
    print(f"Failed Records:       {summary.records_failed}")

    if args.output and summary.records_normalized > 0:
        out_path = Path(args.output).resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            for rec in summary.results:
                if rec.is_success and rec.canonical_message:
                    f.write(rec.canonical_message.model_dump_json() + "\n")
        print(f"Normalized Output:    {out_path}")
    print("=" * 60)


if __name__ == "__main__":
    main()
