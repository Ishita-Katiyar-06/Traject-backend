import argparse
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
import sys
import time
from typing import Mapping, Sequence

from app.ml.features.enrichment import enrich_topics
from app.ml.features.models import TopicEnrichmentResult
from app.ml.narratives.framing import (
    compute_data_coverage,
    extract_representative_excerpts,
    synthesize_headline_claim,
)
from app.ml.narratives.models import (
    NarrativeAssessmentReport,
    NarrativeCandidate,
    NarrativeSubScores,
    PriorityTier,
)
from app.ml.narratives.scoring import (
    DEFAULT_SCORING_WEIGHTS,
    assign_priority_tier,
    compute_coordination_score,
    compute_friction_score,
    compute_priority_signal_score,
    compute_reach_score,
    compute_spread_score,
)
from app.ml.narratives.sentiment_fusion import (
    evaluate_cluster_sentiment,
    load_shared_sentiment_adapter,
)
from app.ml.narratives.signals import (
    extract_potential_coordination_signals,
    generate_signal_audit_notes,
)
from app.ml.sentiment.inference import SentimentModelAdapter
from app.ml.topics.discovery import discover_topics
from app.ml.topics.models import ClusteringConfig
from app.schemas import CanonicalMessage

logger = logging.getLogger("traject.ml.narratives.detector")


def promote_narratives(
    messages: Sequence[CanonicalMessage],
    enrichment_result: TopicEnrichmentResult,
    sentiment_adapter: SentimentModelAdapter | None = None,
    scoring_weights: Mapping[str, float] | None = None,
    dataset_source: str = "unknown",
    enrichment_time_seconds: float = 0.0,
    total_pipeline_time_seconds: float | None = None,
) -> NarrativeAssessmentReport:
    """Promote enriched topic clusters into prioritized, explainable Narrative Candidates.
    
    P0 Scope & Guarantees:
    1. Executes 1 initial NarrativeCandidate promotion per EnrichedTopicCandidate.
    2. Runs batched sentiment inference over ALL text-bearing messages using a shared adapter.
    3. Evaluates four bounded sub-scores: Spread, Coordination, Observed Reach, Friction.
    4. Computes explainable Priority/Narrative Signal Score strictly in [0.0, 1.0].
    5. Flags potential coordination/anomaly signals without claiming inauthenticity.
    6. Grades observational evidence density (HIGH, MODERATE, SPARSE) without claiming confidence.
    """
    t_start = time.perf_counter()

    # Index messages by canonical_id
    msg_map = {m.canonical_id: m for m in messages}
    candidates: list[NarrativeCandidate] = []
    total_sentiment_time = 0.0

    for idx, enriched_topic in enumerate(enrichment_result.enriched_topics):
        narrative_id = f"narrative_{idx:03d}"

        # Resolve constituent messages
        cluster_msgs = [
            msg_map[mid] for mid in enriched_topic.representative_keywords
            if mid in msg_map
        ]
        # If representative IDs were keywords, match by cluster messages from original set
        # Using sample entities/author matching fallback
        if not cluster_msgs:
            # Match cluster messages by topic membership if possible or author overlap
            cluster_msgs = [m for m in messages if m.canonical_id in msg_map]

        # Filter messages specific to this topic cluster
        # In 4F, candidate does not store all IDs, so we resolve messages matching origin/authors/entities
        topic_matched_msgs: list[CanonicalMessage] = []
        topic_entities = {e.text.lower() for e in enriched_topic.entities}

        for m in messages:
            # Check text overlap with representative keywords or entities
            text_lower = m.text_content.lower()
            has_kw = any(kw.lower() in text_lower for kw in enriched_topic.representative_keywords[:3])
            has_ent = any(ent in text_lower for ent in topic_entities)
            if has_kw or has_ent or m.author_id in enriched_topic.propagation.unique_origin_channels:
                topic_matched_msgs.append(m)

        if not topic_matched_msgs:
            topic_matched_msgs = list(messages[:enriched_topic.message_count])

        # 1. Batched Sentiment Synthesis over all text messages
        t_sent_start = time.perf_counter()
        sentiment_profile = evaluate_cluster_sentiment(
            messages=topic_matched_msgs,
            adapter=sentiment_adapter,
            emoji_polarity_score=enriched_topic.engagement.emoji_polarity_score,
        )
        total_sentiment_time += (time.perf_counter() - t_sent_start)

        # 2. Four Sub-Scores in [0.0, 1.0]
        s_spread = compute_spread_score(enriched_topic)
        s_coord = compute_coordination_score(enriched_topic)
        s_reach = compute_reach_score(enriched_topic)
        s_friction = compute_friction_score(enriched_topic, sentiment_profile)

        sub_scores = NarrativeSubScores(
            spread_score=s_spread,
            coordination_score=s_coord,
            reach_score=s_reach,
            friction_score=s_friction,
        )

        # 3. Composite Priority / Narrative Signal Score
        priority_score = compute_priority_signal_score(sub_scores, weights=scoring_weights)
        tier = assign_priority_tier(priority_score)

        # 4. Potential Coordination & Anomaly Signals
        coord_signals = extract_potential_coordination_signals(enriched_topic)
        signal_notes = generate_signal_audit_notes(enriched_topic, coord_signals)

        # 5. Evidence Coverage & Deterministic Framing
        data_coverage = compute_data_coverage(enriched_topic, topic_matched_msgs)
        headline = synthesize_headline_claim(enriched_topic)
        excerpts = extract_representative_excerpts(topic_matched_msgs)

        # 6. Audit Attribution
        audit_rationale: list[str] = [
            f"Priority/Narrative Signal Score: {priority_score:.4f} ({tier.value.upper()}) | "
            f"Component attribution: Spread {s_spread:.2f} (w={DEFAULT_SCORING_WEIGHTS['spread']}), "
            f"Coordination {s_coord:.2f} (w={DEFAULT_SCORING_WEIGHTS['coordination']}), "
            f"Observed Reach {s_reach:.2f} (w={DEFAULT_SCORING_WEIGHTS['reach']}), "
            f"Friction {s_friction:.2f} (w={DEFAULT_SCORING_WEIGHTS['friction']})."
        ]
        audit_rationale.extend(signal_notes)

        # Format entities and channels
        top_entities = [f"{e.category.value}:{e.text}" for e in enriched_topic.entities[:8]]
        broadcasters = sorted(list(set(enriched_topic.propagation.unique_amplifying_channels)))
        origins = sorted(list(set(enriched_topic.propagation.unique_origin_channels)))

        candidate = NarrativeCandidate(
            narrative_id=narrative_id,
            promoted_from_topic_id=enriched_topic.topic_id,
            headline_claim=headline,
            priority_signal_score=priority_score,
            priority_tier=tier,
            sub_scores=sub_scores,
            coordination_signals=coord_signals,
            data_coverage=data_coverage,
            sentiment_profile=sentiment_profile,
            key_entities=top_entities,
            broadcasting_channels=broadcasters,
            origin_channels=origins,
            representative_message_excerpts=excerpts,
            first_observed_at=enriched_topic.temporal.first_published_at,
            last_observed_at=enriched_topic.temporal.last_published_at,
            audit_rationale=audit_rationale,
        )
        candidates.append(candidate)

    # Rank candidates by priority signal score descending (highest priority triage first)
    candidates.sort(key=lambda c: c.priority_signal_score, reverse=True)

    tier_counts = {
        PriorityTier.CRITICAL.value: sum(1 for c in candidates if c.priority_tier == PriorityTier.CRITICAL),
        PriorityTier.HIGH.value: sum(1 for c in candidates if c.priority_tier == PriorityTier.HIGH),
        PriorityTier.ELEVATED.value: sum(1 for c in candidates if c.priority_tier == PriorityTier.ELEVATED),
        PriorityTier.ROUTINE.value: sum(1 for c in candidates if c.priority_tier == PriorityTier.ROUTINE),
    }

    effective_weights = dict(DEFAULT_SCORING_WEIGHTS)
    if scoring_weights:
        effective_weights.update(scoring_weights)

    total_pipeline_time = total_pipeline_time_seconds
    if total_pipeline_time is None:
        total_pipeline_time = round(enrichment_time_seconds + (time.perf_counter() - t_start), 4)

    return NarrativeAssessmentReport(
        dataset_source=dataset_source,
        total_messages_analyzed=len(messages),
        total_narrative_candidates=len(candidates),
        candidates_by_tier=tier_counts,
        narrative_candidates=candidates,
        unassigned_noise_count=enrichment_result.unassigned_noise_count,
        scoring_weights=effective_weights,
        enrichment_time_seconds=round(enrichment_time_seconds, 4),
        sentiment_inference_seconds=round(total_sentiment_time, 4),
        total_pipeline_time_seconds=round(total_pipeline_time, 4),
    )


def _format_cli_narrative_report(report: NarrativeAssessmentReport) -> str:
    """Format narrative assessment report for terminal display."""
    lines = [
        "================================================================================",
        "TRAJECT Narrative Candidate Assessment Report (Milestone 4G)",
        "================================================================================",
        f"Dataset Source:             {report.dataset_source}",
        f"Total Messages Analyzed:    {report.total_messages_analyzed}",
        f"Narrative Candidates:       {report.total_narrative_candidates}",
        f"Unassigned Outlier Noise:   {report.unassigned_noise_count}",
        f"Candidates by Priority Tier: CRITICAL: {report.candidates_by_tier.get('critical', 0)} | "
        f"HIGH: {report.candidates_by_tier.get('high', 0)} | "
        f"ELEVATED: {report.candidates_by_tier.get('elevated', 0)} | "
        f"ROUTINE: {report.candidates_by_tier.get('routine', 0)}",
        "",
        "TIMING BREAKDOWN:",
        f"  Feature Enrichment Latency:  {report.enrichment_time_seconds:.3f} s",
        f"  Sentiment Inference Latency: {report.sentiment_inference_seconds:.3f} s",
        f"  Total Pipeline Latency:      {report.total_pipeline_time_seconds:.3f} s",
        "",
        "PRIORITIZED NARRATIVE CANDIDATES (Ranked by Priority Signal Score):",
    ]

    if not report.narrative_candidates:
        lines.append("  (No narrative candidates formed; dataset contains insufficient topic clusters)")
    else:
        for c in report.narrative_candidates:
            lines.extend([
                "--------------------------------------------------------------------------------",
                f"[{c.narrative_id}] {c.headline_claim}",
                f"  Priority Signal Score: {c.priority_signal_score:.4f} [{c.priority_tier.value.upper()}] | "
                f"Promoted from: {c.promoted_from_topic_id} | Density: {c.data_coverage.evidence_density.value.upper()}",
                "  1. Explainable Sub-Scores:",
                f"     Spread: {c.sub_scores.spread_score:.4f} | Coordination: {c.sub_scores.coordination_score:.4f} | "
                f"Observed Reach: {c.sub_scores.reach_score:.4f} | Friction: {c.sub_scores.friction_score:.4f}",
                "  2. Potential Coordination / Anomaly Signals:",
                f"     Syndication Spike: {'YES' if c.coordination_signals.potential_syndication_spike else 'NO'} | "
                f"Temporal Burst: {'YES' if c.coordination_signals.potential_temporal_burst else 'NO'} | "
                f"Rapid Velocity: {'YES' if c.coordination_signals.potential_rapid_channel_entry else 'NO'} | "
                f"Cross Cascade: {'YES' if c.coordination_signals.potential_cross_channel_cascade else 'NO'}",
                "  3. Sentiment & Polarization Profile:",
            ])

            if c.sentiment_profile.is_available and c.sentiment_profile.text_negative_ratio is not None:
                lines.append(
                    f"     Text Sentiment ({c.sentiment_profile.total_text_messages_evaluated} msgs): "
                    f"Pos {c.sentiment_profile.text_positive_ratio * 100:.1f}% | "
                    f"Neu {c.sentiment_profile.text_neutral_ratio * 100:.1f}% | "
                    f"Neg {c.sentiment_profile.text_negative_ratio * 100:.1f}% | "
                    f"Emoji Polarity: {c.sentiment_profile.emoji_polarity_score:+.4f}"
                )
            else:
                lines.append(
                    f"     Text Sentiment: UNAVAILABLE | "
                    f"Emoji Polarity: {c.sentiment_profile.emoji_polarity_score:+.4f} (Friction renormalized)"
                )

            lines.extend([
                "  4. Observation Breadth & Channels:",
                f"     Channels: {', '.join(c.broadcasting_channels[:4]) or 'None verified'} | "
                f"Origins: {', '.join(c.origin_channels[:3]) or 'None'}",
                "  5. Audit Rationale:",
            ])
            for r in c.audit_rationale:
                lines.append(f"     - {r}")

            if c.representative_message_excerpts:
                lines.append("  6. Representative Excerpts:")
                for ex in c.representative_message_excerpts[:2]:
                    lines.append(f'     "{ex}"')

    lines.append("================================================================================")
    return "\n".join(lines)


def _main() -> None:
    """CLI runner for Milestone 4G Narrative Candidate Formation."""
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")

    overall_start = time.perf_counter()

    parser = argparse.ArgumentParser(
        description="Elevate enriched topic clusters into explainable, prioritized Narrative Candidates.",
    )
    parser.add_argument(
        "--parquet",
        default=None,
        help="Path to processed canonical Parquet dataset.",
    )
    parser.add_argument(
        "--fixture",
        default=None,
        help="Path to synthetic or test JSONL fixture containing CanonicalMessage records.",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Optional path to save JSON narrative assessment report.",
    )
    parser.add_argument(
        "--min-cluster-size",
        type=int,
        default=2,
        help="Minimum cluster size for HDBSCAN topic discovery (default: 2).",
    )
    parser.add_argument(
        "--syndication-threshold",
        type=float,
        default=0.92,
        help="Cosine similarity cutoff for uncredited near-duplicate syndication (default: 0.92).",
    )
    parser.add_argument(
        "--no-sentiment",
        action="store_true",
        help="Skip text sentiment model inference (testing unavailable sentiment behavior).",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing output report.",
    )

    args = parser.parse_args()

    if not args.parquet and not args.fixture:
        print("Error: Specify either --parquet or --fixture as input.", file=sys.stderr)
        sys.exit(1)

    from app.ml.dataset import load_canonical_dataset

    messages: list[CanonicalMessage] = []
    source_name = "unknown"

    if args.parquet:
        in_path = Path(args.parquet).resolve()
        if not in_path.is_file():
            print(f"Error: Parquet file not found: {in_path}", file=sys.stderr)
            sys.exit(1)
        source_name = in_path.name
        print(f"Loading Canonical messages from {source_name}...")
        messages = load_canonical_dataset(in_path)
    elif args.fixture:
        in_path = Path(args.fixture).resolve()
        if not in_path.is_file():
            print(f"Error: Fixture file not found: {in_path}", file=sys.stderr)
            sys.exit(1)
        source_name = in_path.name
        print(f"Loading Canonical messages from fixture {source_name}...")
        with open(in_path, encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    raw = json.loads(line)
                    messages.append(CanonicalMessage.model_validate(raw))

    # 1. Milestone 4E Topic Discovery Baseline
    print("Running Milestone 4E Topic Discovery baseline...")
    cfg = ClusteringConfig(min_cluster_size=args.min_cluster_size, min_samples=1)
    topic_result = discover_topics(messages, config=cfg)
    print(f"Discovered {topic_result.number_of_topics} topic clusters ({topic_result.noise_messages} noise points).")

    # 2. Milestone 4F Topic Feature Enrichment
    print("Running Milestone 4F Deterministic Feature Enrichment...")
    t_enrich_start = time.perf_counter()
    enrichment_result = enrich_topics(
        messages=messages,
        topic_result=topic_result,
        syndication_similarity_threshold=args.syndication_threshold,
        dataset_source=source_name,
    )
    enrichment_time = time.perf_counter() - t_enrich_start

    # 3. Sentiment Model Lifecycle (Loaded Once)
    sentiment_adapter: SentimentModelAdapter | None = None
    if not args.no_sentiment:
        print("Loading shared pretrained sentiment model adapter...")
        sentiment_adapter = load_shared_sentiment_adapter()
    else:
        print("Skipping sentiment inference (--no-sentiment specified).")

    # 4. Milestone 4G Narrative Candidate Promotion
    print("Running Milestone 4G Narrative Candidate Formation & Priority Scoring...")
    report = promote_narratives(
        messages=messages,
        enrichment_result=enrichment_result,
        sentiment_adapter=sentiment_adapter,
        dataset_source=source_name,
        enrichment_time_seconds=enrichment_time,
        total_pipeline_time_seconds=time.perf_counter() - overall_start,
    )

    print()
    print(_format_cli_narrative_report(report))

    if args.output:
        out_path = Path(args.output).resolve()
        try:
            report.save_json(out_path, overwrite=args.overwrite)
            print(f"\nNarrative assessment report saved to:\n  {out_path}")
        except FileExistsError as err:
            print(f"\nError: {err}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    _main()
