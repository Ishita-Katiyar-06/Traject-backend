import argparse
import json
import logging
import statistics
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence

from pydantic import BaseModel, ConfigDict, Field

from app.ml.dataset import load_canonical_dataset
from app.schemas.canonical_message import CanonicalMessage

logger = logging.getLogger("traject.ml.inspection")


class NumericDistribution(BaseModel):
    """Summary distribution for continuous or discrete numeric measures."""
    model_config = ConfigDict(extra="forbid", frozen=True)

    min: int | float = 0
    max: int | float = 0
    mean: float = 0.0
    median: float = 0.0


def compute_numeric_distribution(values: Sequence[int | float]) -> NumericDistribution:
    """Compute min, max, mean, and median with division-by-zero protection."""
    if not values:
        return NumericDistribution()

    return NumericDistribution(
        min=min(values),
        max=max(values),
        mean=round(float(statistics.mean(values)), 2),
        median=round(float(statistics.median(values)), 2),
    )


class MLDatasetInspection(BaseModel):
    """Comprehensive, deterministic data-science baseline inspection report."""
    model_config = ConfigDict(extra="forbid")

    dataset_path: str
    generated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    # 1. Dataset-level partition metrics
    total_records: int = 0
    text_records: int = 0
    media_only_records: int = 0
    empty_body_records: int = 0
    usable_text_percentage: float = 0.0
    media_only_percentage: float = 0.0

    # 2. Language distribution (alphabetically ordered)
    language_counts: dict[str, int] = Field(default_factory=dict)
    language_percentages: dict[str, float] = Field(default_factory=dict)

    # 3. Text length characteristics
    text_characters: NumericDistribution = Field(default_factory=NumericDistribution)
    text_words: NumericDistribution = Field(default_factory=NumericDistribution)

    # 4. Social & Topological features
    url_records: int = 0
    url_percentage: float = 0.0
    hashtag_records: int = 0
    hashtag_percentage: float = 0.0
    mention_records: int = 0
    mention_percentage: float = 0.0
    forward_records: int = 0
    forward_percentage: float = 0.0
    media_records: int = 0
    media_percentage: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        """Serialize inspection report to standard dictionary."""
        return self.model_dump()

    def save_json(self, output_path: Path | str, overwrite: bool = False, indent: int = 2) -> None:
        """Write inspection report to formatted JSON with overwrite guard.
        
        Args:
            output_path: Target destination path.
            overwrite: Whether to overwrite existing file.
            indent: Indentation for formatting.
            
        Raises:
            FileExistsError: If output exists and overwrite is False.
        """
        path = Path(output_path).resolve()
        if path.exists() and not overwrite:
            raise FileExistsError(
                f"Inspection report destination already exists: {path}\n"
                "Use overwrite=True or --overwrite to replace existing file."
            )

        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=indent)


def inspect_canonical_dataset(
    messages: Iterable[CanonicalMessage],
    dataset_path: str = "",
) -> MLDatasetInspection:
    """Execute deterministic ML-oriented dataset inspection over CanonicalMessage records.
    
    Invariants:
    - Independent of wall-clock time in calculations.
    - Zero division safety on empty datasets.
    - Alphabetically sorted language keys.
    - Media-only messages (text == "" and has_media == True) identified separately.
    - Missing or empty language mapped to 'unknown'.
    - Deterministic whitespace word splitting.
    
    Args:
        messages: Iterable of CanonicalMessage domain records.
        dataset_path: Origin identifier or path for provenance.
        
    Returns:
        MLDatasetInspection: Computed baseline metrics.
    """
    msg_list = list(messages)
    total_records = len(msg_list)

    if total_records == 0:
        return MLDatasetInspection(dataset_path=str(dataset_path))

    def pct(count: int) -> float:
        return round((count / total_records) * 100, 2)

    text_records = 0
    media_only_records = 0
    empty_body_records = 0

    char_counts: list[int] = []
    word_counts: list[int] = []

    raw_lang_counts: dict[str, int] = {}

    url_records = 0
    hashtag_records = 0
    mention_records = 0
    forward_records = 0
    media_records = 0

    for msg in msg_list:
        has_text = bool(msg.text_content and msg.text_content.strip())
        has_media = bool(msg.has_media or msg.media_types)

        if has_text:
            text_records += 1
            char_counts.append(len(msg.text_content))
            word_counts.append(len(msg.text_content.split()))
        elif has_media:
            media_only_records += 1
        else:
            empty_body_records += 1

        # Language tracking (map None / whitespace to 'unknown')
        lang = msg.language.strip() if (msg.language and msg.language.strip()) else "unknown"
        raw_lang_counts[lang] = raw_lang_counts.get(lang, 0) + 1

        # Social and topological features
        if msg.urls:
            url_records += 1
        if msg.hashtags:
            hashtag_records += 1
        if msg.mentions:
            mention_records += 1
        if msg.is_forward or msg.is_repost:
            forward_records += 1
        if has_media:
            media_records += 1

    # Deterministic alphabetical ordering of language keys
    sorted_langs = sorted(raw_lang_counts.keys())
    language_counts = {k: raw_lang_counts[k] for k in sorted_langs}
    language_percentages = {k: pct(raw_lang_counts[k]) for k in sorted_langs}

    return MLDatasetInspection(
        dataset_path=str(dataset_path),
        total_records=total_records,
        text_records=text_records,
        media_only_records=media_only_records,
        empty_body_records=empty_body_records,
        usable_text_percentage=pct(text_records),
        media_only_percentage=pct(media_only_records),
        language_counts=language_counts,
        language_percentages=language_percentages,
        text_characters=compute_numeric_distribution(char_counts),
        text_words=compute_numeric_distribution(word_counts),
        url_records=url_records,
        url_percentage=pct(url_records),
        hashtag_records=hashtag_records,
        hashtag_percentage=pct(hashtag_records),
        mention_records=mention_records,
        mention_percentage=pct(mention_records),
        forward_records=forward_records,
        forward_percentage=pct(forward_records),
        media_records=media_records,
        media_percentage=pct(media_records),
    )


def _format_cli_inspection(inspection: MLDatasetInspection) -> str:
    """Format the dataset inspection report for terminal display."""
    lines = [
        "TRAJECT ML Dataset Inspection",
        "",
        "Dataset:",
        f"  {inspection.dataset_path or 'In-memory dataset'}",
        "",
        "Records:",
        f"  Total: {inspection.total_records}",
        f"  Text-bearing: {inspection.text_records} ({inspection.usable_text_percentage}%)",
        f"  Media-only: {inspection.media_only_records} ({inspection.media_only_percentage}%)",
        f"  Empty-body: {inspection.empty_body_records}",
        "",
        "Languages:",
    ]

    if inspection.language_counts:
        for lang, count in inspection.language_counts.items():
            pct = inspection.language_percentages.get(lang, 0.0)
            lines.append(f"  {lang}: {count} ({pct}%)")
    else:
        lines.append("  (no records)")

    lines.extend([
        "",
        "Text:",
        "  Character count:",
        f"    Min: {inspection.text_characters.min}",
        f"    Max: {inspection.text_characters.max}",
        f"    Mean: {inspection.text_characters.mean}",
        f"    Median: {inspection.text_characters.median}",
        "",
        "  Word count:",
        f"    Min: {inspection.text_words.min}",
        f"    Max: {inspection.text_words.max}",
        f"    Mean: {inspection.text_words.mean}",
        f"    Median: {inspection.text_words.median}",
        "",
        "Content:",
        f"  URLs: {inspection.url_records} ({inspection.url_percentage}%)",
        f"  Hashtags: {inspection.hashtag_records} ({inspection.hashtag_percentage}%)",
        f"  Mentions: {inspection.mention_records} ({inspection.mention_percentage}%)",
        f"  Forwards/Reposts: {inspection.forward_records} ({inspection.forward_percentage}%)",
        f"  Media: {inspection.media_records} ({inspection.media_percentage}%)",
    ])

    return "\n".join(lines)


def _main() -> None:
    """CLI entrypoint for inspecting processed Parquet datasets."""
    parser = argparse.ArgumentParser(
        description="Inspect ML-relevant characteristics of a processed TRAJECT Parquet dataset.",
    )
    parser.add_argument(
        "--input",
        required=True,
        help="Path to the processed Parquet dataset file (e.g. data/processed/telegram/telegram_messages.parquet).",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Optional path to output the inspection report as a JSON file.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing JSON report if it already exists.",
    )

    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    if not input_path.is_file():
        print(f"Error: Input Parquet file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    try:
        messages = load_canonical_dataset(input_path)
    except Exception as exc:
        print(f"Error loading dataset: {exc}", file=sys.stderr)
        sys.exit(1)

    inspection = inspect_canonical_dataset(messages, dataset_path=str(input_path))
    print(_format_cli_inspection(inspection))

    if args.output:
        out_path = Path(args.output).resolve()
        try:
            inspection.save_json(out_path, overwrite=args.overwrite)
            print(f"\nInspection JSON report saved:\n  {out_path}")
        except FileExistsError as err:
            print(f"\nError: {err}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    _main()
