"""CLI runner for TRAJECT Milestone 6C Real-World Narrative Quality & Cross-Source Validation."""

import argparse
import json
import logging
from pathlib import Path
import sys

from app.analytics.narrative_validation import CorpusQualityValidator
from app.ml.pipeline.orchestrator import MLPipelineResult
from app.storage.parquet import read_canonical_messages

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("traject.analytics.validate_narratives")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="TRAJECT Milestone 6C: Real-World Narrative Quality & Cross-Source Validation Runner"
    )
    parser.add_argument(
        "--parquet",
        type=str,
        default="data/processed/telegram/telegram_messages.parquet",
        help="Path to processed canonical Parquet dataset",
    )
    parser.add_argument(
        "--analytics",
        type=str,
        default="data/processed/telegram/telegram-analytics-artifact.json",
        help="Path to precomputed ML analytics artifact",
    )
    parser.add_argument(
        "--output-report",
        type=str,
        default="data/reports/narrative_validation_report.json",
        help="Path to output validation report JSON",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent.parent.parent

    parquet_path = Path(args.parquet)
    if not parquet_path.is_absolute():
        parquet_path = repo_root / parquet_path

    analytics_path = Path(args.analytics)
    if not analytics_path.is_absolute():
        analytics_path = repo_root / analytics_path

    # Fallback to telegram_messages-analytics-artifact.json if not found
    if not analytics_path.is_file():
        alt_path = analytics_path.parent / "telegram_messages-analytics-artifact.json"
        if alt_path.is_file():
            analytics_path = alt_path

    output_path = Path(args.output_report)
    if not output_path.is_absolute():
        output_path = repo_root / output_path

    if not parquet_path.is_file():
        logger.error("Parquet dataset not found at %s", parquet_path)
        sys.exit(1)

    if not analytics_path.is_file():
        logger.error("Analytics artifact not found at %s", analytics_path)
        sys.exit(1)

    logger.info("Loading Parquet dataset from %s...", parquet_path)
    messages = read_canonical_messages(parquet_path)
    logger.info("Loaded %d canonical messages.", len(messages))

    logger.info("Loading ML analytics artifact from %s...", analytics_path)
    with open(analytics_path, "r", encoding="utf-8") as f:
        artifact_dict = json.load(f)
    ml_result = MLPipelineResult.model_validate(artifact_dict)
    logger.info("Loaded ML analytics with %d topics, %d narratives.",
                len(ml_result.topics.topic_records),
                len(ml_result.narrative_report.narrative_candidates))

    validator = CorpusQualityValidator()
    report = validator.validate_corpus(messages, ml_result)

    # Save report
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(report.model_dump_json(indent=2))
    logger.info("Validation report saved to %s", output_path)

    # Print executive summary
    print("\n" + "=" * 78)
    print("TRAJECT MILESTONE 6C — NARRATIVE QUALITY & CROSS-SOURCE VALIDATION REPORT")
    print("=" * 78)
    print(f"Total Canonical Messages:    {report.total_messages_analyzed}")
    print(f"Total Discovered Topics:     {report.total_topics_discovered}")
    print(f"Total Promoted Narratives:   {report.total_narratives_promoted}")
    print(f"Topic-to-Narrative Ratio:    {report.topic_to_narrative_ratio} (Strict 1:1 Promotion)")
    print(f"Single-Source Narratives:    {report.overlap_analysis.single_source_narratives}")
    print(f"Multi-Source Narratives:     {report.overlap_analysis.multi_source_narratives} (>=2 channels)")
    print(f"Multi-Domain Narratives:     {report.overlap_analysis.multi_domain_narratives} (>=2 strategic domains)")

    print("\n--- Observational Evidence Quality Distribution ---")
    for q, count in report.overlap_analysis.quality_classification_counts.items():
        pct = (count / report.total_narratives_promoted) * 100
        print(f"  {q:<22}: {count:>4} ({pct:>5.1f}%)")

    print("\n--- Top Source-Pair Overlaps (Shared Co-occurring Narratives) ---")
    for pair, count in list(report.overlap_analysis.source_pair_overlaps.items())[:10]:
        print(f"  {pair:<36}: {count} shared narratives")

    print("\n--- Domain-Pair Overlaps ---")
    for pair, count in list(report.overlap_analysis.domain_pair_overlaps.items())[:10]:
        print(f"  {pair:<36}: {count} shared narratives")

    print("\n--- Top 10 Narratives by Frozen 4G Priority Signal Score ---")
    for i, n in enumerate(report.top_narratives_by_priority[:10], start=1):
        print(f"\n#{i:02d} [{n.narrative_id}] Priority Signal Score: {n.priority_signal_score:.4f} ({n.priority_tier.upper()})")
        print(f"    Topic ID:         {n.topic_id}")
        print(f"    Headline Claim:   {n.headline_claim}")
        print(f"    Sub-Scores:       Spread: {n.sub_scores['spread_score']:.3f} | Coord: {n.sub_scores['coordination_score']:.3f} | Reach: {n.sub_scores['reach_score']:.3f} | Friction: {n.sub_scores['friction_score']:.3f}")
        print(f"    Evidence Density: {n.quality_classification.value.upper()} ({n.message_count} msgs, {n.distinct_sources_count} sources: {', '.join(n.sources_represented[:3])})")
        print(f"    Domains:          {', '.join(n.domains_represented)}")

    print("\n" + "=" * 78)


if __name__ == "__main__":
    main()
