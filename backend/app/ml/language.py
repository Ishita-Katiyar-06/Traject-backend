import argparse
import json
import logging
import statistics
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Sequence

from langdetect import DetectorFactory, detect_langs
from langdetect.lang_detect_exception import LangDetectException
from pydantic import BaseModel, ConfigDict, Field

from app.ml.dataset import load_canonical_dataset, prepare_language_aware_records
from app.ml.inspection import NumericDistribution, compute_numeric_distribution
from app.schemas.canonical_message import CanonicalMessage

logger = logging.getLogger("traject.ml.language")

# Strictly enforce deterministic language classification across all runs
DetectorFactory.seed = 0

DETECTOR_VERSION = "langdetect:1.0.9"
DEFAULT_CONFIDENCE_THRESHOLD = 0.70
MIN_DETECTION_TEXT_LENGTH = 10


class LanguageDetectionResult(BaseModel):
    """Result of language identification with confidence scoring."""
    model_config = ConfigDict(extra="forbid", frozen=True)

    language: str
    confidence: float
    detector: str = DETECTOR_VERSION


def identify_language(
    text: str,
    confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
    min_text_length: int = MIN_DETECTION_TEXT_LENGTH,
) -> LanguageDetectionResult:
    """Identify the primary language of a text string with conservative fallback to 'unknown'.
    
    Conservative Detection Rules:
    1. Empty Text: Blank, whitespace-only, or None text produces language='unknown', confidence=0.0.
    2. Short Text: Text shorter than min_text_length characters is considered too short for
       reliable statistical n-gram classification, producing language='unknown', confidence=0.0.
    3. Unclassifiable Content: If the detector raises an exception (e.g. only numbers or symbols),
       produces language='unknown', confidence=0.0 without aborting.
    4. Ambiguous / Low Confidence: If the top predicted language probability is below
       confidence_threshold, it is conservatively classified as language='unknown'.
       
    Args:
        text: Normalized or raw text string.
        confidence_threshold: Minimum probability required to accept a language label (default: 0.70).
        min_text_length: Minimum character length to attempt classification (default: 10).
        
    Returns:
        LanguageDetectionResult: Model containing language code and confidence score.
    """
    if not text or not text.strip():
        return LanguageDetectionResult(language="unknown", confidence=0.0)

    clean = text.strip()
    if len(clean) < min_text_length:
        return LanguageDetectionResult(language="unknown", confidence=0.0)

    try:
        predictions = detect_langs(clean)
    except LangDetectException:
        return LanguageDetectionResult(language="unknown", confidence=0.0)

    if not predictions:
        return LanguageDetectionResult(language="unknown", confidence=0.0)

    top = predictions[0]
    conf = round(float(top.prob), 4)

    if conf < confidence_threshold:
        logger.debug(
            "Language '%s' below confidence threshold (%.2f < %.2f) for text: %s",
            top.lang,
            conf,
            confidence_threshold,
            clean[:40],
        )
        return LanguageDetectionResult(language="unknown", confidence=conf)

    return LanguageDetectionResult(language=top.lang, confidence=conf)


class MLLanguageInspection(BaseModel):
    """Structured inspection report for ML language identification and normalization."""
    model_config = ConfigDict(extra="forbid")

    dataset_path: str
    generated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    total_records: int = 0
    text_records: int = 0
    media_only_records: int = 0

    language_counts: dict[str, int] = Field(default_factory=dict)
    language_percentages: dict[str, float] = Field(default_factory=dict)
    unknown_count: int = 0
    unknown_percentage: float = 0.0

    confidence_summary: NumericDistribution = Field(default_factory=NumericDistribution)
    normalization_summary: dict[str, int] = Field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert report to primitive dictionary."""
        return self.model_dump()

    def save_json(self, output_path: Path | str, overwrite: bool = False, indent: int = 2) -> None:
        """Write inspection report to formatted JSON with overwrite guard.
        
        Args:
            output_path: Target destination path.
            overwrite: Whether to overwrite existing file.
            indent: Indentation for JSON.
            
        Raises:
            FileExistsError: If output exists and overwrite is False.
        """
        path = Path(output_path).resolve()
        if path.exists() and not overwrite:
            raise FileExistsError(
                f"Language inspection destination already exists: {path}\n"
                "Use overwrite=True or --overwrite to replace existing file."
            )

        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=indent)


def inspect_canonical_languages(
    messages: Sequence[CanonicalMessage],
    dataset_path: str = "",
    confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
) -> MLLanguageInspection:
    """Run language identification and normalization inspection over CanonicalMessages.
    
    Args:
        messages: Collection of CanonicalMessage domain models.
        dataset_path: Identifier of dataset origin.
        confidence_threshold: Confidence threshold for language detector.
        
    Returns:
        MLLanguageInspection: Complete baseline language and normalization audit.
    """
    total = len(messages)
    text_records = 0
    media_only = 0

    lang_counts: dict[str, int] = {}
    confidences: list[float] = []

    records_processed = 0
    records_changed = 0

    records = prepare_language_aware_records(
        messages,
        confidence_threshold=confidence_threshold,
    )

    for msg in messages:
        has_text = bool(msg.text_content and msg.text_content.strip())
        has_media = bool(msg.has_media or msg.media_types)
        if has_text:
            text_records += 1
        elif has_media:
            media_only += 1

    for rec in records:
        records_processed += 1
        if rec.original_text != rec.normalized_text:
            records_changed += 1

        lang = rec.detected_language
        lang_counts[lang] = lang_counts.get(lang, 0) + 1
        confidences.append(rec.language_confidence)

    def pct(cnt: int) -> float:
        return round((cnt / text_records) * 100, 2) if text_records > 0 else 0.0

    sorted_langs = sorted(lang_counts.keys())
    ordered_counts = {k: lang_counts[k] for k in sorted_langs}
    ordered_percentages = {k: pct(lang_counts[k]) for k in sorted_langs}

    unknown_cnt = lang_counts.get("unknown", 0)

    return MLLanguageInspection(
        dataset_path=str(dataset_path),
        total_records=total,
        text_records=text_records,
        media_only_records=media_only,
        language_counts=ordered_counts,
        language_percentages=ordered_percentages,
        unknown_count=unknown_cnt,
        unknown_percentage=pct(unknown_cnt),
        confidence_summary=compute_numeric_distribution(confidences),
        normalization_summary={
            "records_processed": records_processed,
            "records_changed": records_changed,
        },
    )


def _format_cli_language_inspection(inspection: MLLanguageInspection) -> str:
    """Format the language inspection report for terminal display."""
    lines = [
        "TRAJECT ML Language Inspection",
        "",
        "Dataset:",
        f"  {inspection.dataset_path or 'In-memory dataset'}",
        "",
        f"Text-bearing records: {inspection.text_records} (of {inspection.total_records} total)",
        f"Media-only records: {inspection.media_only_records}",
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
        f"Unknown: {inspection.unknown_count} ({inspection.unknown_percentage}%)",
        "",
        "Confidence:",
        f"  Min: {inspection.confidence_summary.min}",
        f"  Max: {inspection.confidence_summary.max}",
        f"  Mean: {inspection.confidence_summary.mean}",
        f"  Median: {inspection.confidence_summary.median}",
        "",
        "Normalization:",
        f"  Records processed: {inspection.normalization_summary.get('records_processed', 0)}",
        f"  Records changed: {inspection.normalization_summary.get('records_changed', 0)}",
    ])

    return "\n".join(lines)


def _main() -> None:
    """CLI entrypoint for language inspection."""
    parser = argparse.ArgumentParser(
        description="Inspect ML-side language identification and text normalization for a TRAJECT dataset.",
    )
    parser.add_argument(
        "--input",
        required=True,
        help="Path to the processed Parquet dataset file.",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Optional path to save language inspection report as JSON.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing JSON report if it already exists.",
    )
    parser.add_argument(
        "--confidence-threshold",
        type=float,
        default=DEFAULT_CONFIDENCE_THRESHOLD,
        help=f"Minimum confidence threshold for language acceptance (default: {DEFAULT_CONFIDENCE_THRESHOLD}).",
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

    inspection = inspect_canonical_languages(
        messages,
        dataset_path=str(input_path),
        confidence_threshold=args.confidence_threshold,
    )
    print(_format_cli_language_inspection(inspection))

    if args.output:
        out_path = Path(args.output).resolve()
        try:
            inspection.save_json(out_path, overwrite=args.overwrite)
            print(f"\nLanguage inspection JSON report saved:\n  {out_path}")
        except FileExistsError as err:
            print(f"\nError: {err}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    _main()
