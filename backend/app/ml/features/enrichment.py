import argparse
import json
import logging
import sys
import time
from pathlib import Path
from typing import Sequence

import numpy as np

from app.ml.features.engagement import compute_engagement_features
from app.ml.features.entities import extract_social_entities
from app.ml.features.models import (
    EnrichedTopicCandidate,
    TopicEnrichmentResult,
)
from app.ml.features.propagation import compute_propagation_features
from app.ml.features.temporal import compute_temporal_features
from app.ml.topics.discovery import discover_topics
from app.ml.topics.embeddings import SentenceEmbeddingAdapter
from app.ml.topics.models import TopicDiscoveryResult
from app.schemas import CanonicalMessage

logger = logging.getLogger("traject.ml.features.enrichment")


def enrich_topics(
    messages: Sequence[CanonicalMessage],
    topic_result: TopicDiscoveryResult,
    embedder: SentenceEmbeddingAdapter | None = None,
    syndication_similarity_threshold: float = 0.92,
    dataset_source: str = "unknown",
    total_pipeline_latency_seconds: float | None = None,
) -> TopicEnrichmentResult:
    """Enrich discovered semantic topic clusters with deterministic contextual feature vectors.
    
    Processing Steps:
    1. Indexes CanonicalMessages by canonical_id.
    2. For each TopicRecord in topic_result:
       - Extracts social/gazetteer entities (hashtags, handles, domains, geo/org terms).
       - Computes static engagement totals, ratios, and emoji polarity heuristic.
       - Compiles observed platform forwarding relationships and uncredited syndication.
       - Computes temporal timespan, cadence, peak window, and burstiness index.
    3. Bundles EnrichedTopicCandidates into a typed TopicEnrichmentResult report.
    """
    t_start = time.perf_counter()

    msg_map = {m.canonical_id: m for m in messages}
    enriched_topics: list[EnrichedTopicCandidate] = []

    for topic_record in topic_result.topic_records:
        # Resolve messages belonging to this cluster
        cluster_messages = [
            msg_map[mid] for mid in topic_record.sample_message_ids
            if mid in msg_map
        ]

        if not cluster_messages:
            continue

        # Extract embeddings for syndication check if embedder provided
        cluster_embeddings = None
        if embedder is not None and len(cluster_messages) >= 2:
            texts = [m.text_content for m in cluster_messages]
            cluster_embeddings = embedder.encode(texts, normalize_embeddings=True)

        # 1. Entities
        entities = extract_social_entities(cluster_messages)

        # 2. Engagement
        engagement = compute_engagement_features(cluster_messages)

        # 3. Propagation
        propagation = compute_propagation_features(
            cluster_messages,
            embeddings=cluster_embeddings,
            syndication_similarity_threshold=syndication_similarity_threshold,
        )

        # 4. Temporal
        temporal = compute_temporal_features(cluster_messages)

        candidate = EnrichedTopicCandidate(
            topic_id=topic_record.topic_id,
            message_count=topic_record.message_count,
            percentage_of_dataset=topic_record.percentage_of_dataset,
            representative_keywords=[k.keyword for k in topic_record.representative_keywords],
            entities=entities,
            engagement=engagement,
            propagation=propagation,
            temporal=temporal,
        )
        enriched_topics.append(candidate)

    total_enrichment_time = round(time.perf_counter() - t_start, 4)

    disc_embed_time = getattr(topic_result, "embedding_time_seconds", None)
    disc_cluster_time = getattr(topic_result, "clustering_time_seconds", None)

    total_pipe_time = None
    if total_pipeline_latency_seconds is not None:
        total_pipe_time = round(total_pipeline_latency_seconds, 4)
    elif disc_embed_time is not None and disc_cluster_time is not None:
        disc_total = getattr(topic_result, "total_time_seconds", (disc_embed_time + disc_cluster_time))
        total_pipe_time = round(disc_total + total_enrichment_time, 4)

    return TopicEnrichmentResult(
        dataset_source=dataset_source,
        total_messages_analyzed=len(messages),
        total_topics_enriched=len(enriched_topics),
        enriched_topics=enriched_topics,
        unassigned_noise_count=topic_result.noise_messages,
        syndication_similarity_threshold=syndication_similarity_threshold,
        enrichment_latency_seconds=total_enrichment_time,
        topic_discovery_latency_seconds=disc_embed_time,
        clustering_latency_seconds=disc_cluster_time,
        total_pipeline_latency_seconds=total_pipe_time,
        execution_time_seconds=total_enrichment_time,
    )


def _format_cli_enrichment(result: TopicEnrichmentResult) -> str:
    """Format topic enrichment result for terminal display."""
    embed_str = f"{result.topic_discovery_latency_seconds:.3f} s" if result.topic_discovery_latency_seconds is not None else "N/A"
    clust_str = f"{result.clustering_latency_seconds:.3f} s" if result.clustering_latency_seconds is not None else "N/A"
    pipe_str = f"{result.total_pipeline_latency_seconds:.3f} s" if result.total_pipeline_latency_seconds is not None else "N/A"

    lines = [
        "================================================================================",
        "TRAJECT Topic Feature Enrichment Baseline Report (Milestone 4F)",
        "================================================================================",
        f"Dataset Source:          {result.dataset_source}",
        f"Total Messages:          {result.total_messages_analyzed}",
        f"Enriched Topics:         {result.total_topics_enriched}",
        f"Unassigned Noise Count:  {result.unassigned_noise_count}",
        f"Syndication Threshold:   {result.syndication_similarity_threshold:.2f}",
        "",
        "TIMING BREAKDOWN:",
        f"  Topic Discovery (Embeddings): {embed_str}",
        f"  Clustering (HDBSCAN):        {clust_str}",
        f"  4F Feature Enrichment:       {result.enrichment_latency_seconds:.3f} s",
        f"  Total Pipeline Latency:      {pipe_str}",
        "",
        "ENRICHED TOPIC CANDIDATES:",
    ]

    if not result.enriched_topics:
        lines.append("  (No topic clusters found to enrich; all input points classified as noise)")
    else:
        for t in result.enriched_topics:
            cadence_str = f"{t.temporal.messages_per_hour:.1f} msg/h" if t.temporal.messages_per_hour is not None else "N/A"
            burst_str = f"{t.temporal.burstiness_index:+.4f}" if t.temporal.burstiness_index is not None else "N/A"

            lines.extend([
                f"--------------------------------------------------------------------------------",
                f"[{t.topic_id}] {t.message_count} messages ({t.percentage_of_dataset:.1f}%) | Keywords: {', '.join(t.representative_keywords)}",
                f"  1. Entities Observed ({len(t.entities)}):",
            ])
            if t.entities:
                ent_str = ", ".join(f"{e.category.value}:{e.text} (x{e.frequency})" for e in t.entities[:5])
                lines.append(f"     {ent_str}")
            else:
                lines.append("     (None extracted)")

            lines.extend([
                f"  2. Engagement Metrics:",
                f"     Views: {t.engagement.total_views:,} | Forwards: {t.engagement.total_forwards:,} | Replies: {t.engagement.total_replies:,} | Reactions: {t.engagement.total_reactions:,}",
                f"     Forward/View Ratio: {t.engagement.forward_to_view_ratio:.4f} | Reply/View Ratio: {t.engagement.reply_to_view_ratio:.4f} | Emoji Polarity: {t.engagement.emoji_polarity_score:+.4f}",
                f"  3. Propagation Signals:",
                f"     Observed Forwards: {t.propagation.observed_forward_count} ({t.propagation.direct_forward_ratio * 100:.1f}%) | Cross-Channel: {t.propagation.cross_channel_observed_spread} | Uncredited Syndication: {t.propagation.uncredited_syndication_count}",
                f"     Origin Channels: {', '.join(t.propagation.unique_origin_channels[:3]) or 'None'}",
                f"  4. Temporal Profiling:",
                f"     Timespan: {t.temporal.timespan_seconds:.0f}s ({t.temporal.timespan_seconds / 3600:.1f}h) | Cadence: {cadence_str} | Burstiness Index: {burst_str}",
                f"     Peak Window (UTC): {t.temporal.peak_window_utc} ({t.temporal.peak_window_message_count} msgs)",
            ])

    lines.append("================================================================================")
    return "\n".join(lines)


def _main() -> None:
    """CLI runner for Topic Feature Enrichment."""
    import time
    from app.ml.dataset import load_canonical_dataset

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")

    overall_start = time.perf_counter()

    parser = argparse.ArgumentParser(
        description="Enrich semantic topic clusters with deterministic social, engagement, propagation, and temporal features.",
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
        help="Optional path to save JSON enrichment report.",
    )
    parser.add_argument(
        "--syndication-threshold",
        type=float,
        default=0.92,
        help="Cosine similarity threshold for uncredited near-duplicate syndication (default: 0.92).",
    )
    parser.add_argument(
        "--min-cluster-size",
        type=int,
        default=2,
        help="Minimum cluster size for HDBSCAN topic discovery (default: 2).",
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

    print("Running Milestone 4E Topic Discovery baseline...")
    from app.ml.topics.models import ClusteringConfig
    cfg = ClusteringConfig(min_cluster_size=args.min_cluster_size, min_samples=1)
    topic_result = discover_topics(messages, config=cfg)

    print(f"Discovered {topic_result.number_of_topics} topic clusters ({topic_result.noise_messages} noise points).")
    print("Running Milestone 4F Deterministic Feature Enrichment...")

    result = enrich_topics(
        messages=messages,
        topic_result=topic_result,
        syndication_similarity_threshold=args.syndication_threshold,
        dataset_source=source_name,
        total_pipeline_latency_seconds=time.perf_counter() - overall_start,
    )

    print()
    print(_format_cli_enrichment(result))

    if args.output:
        out_path = Path(args.output).resolve()
        try:
            result.save_json(out_path, overwrite=args.overwrite)
            print(f"\nTopic feature enrichment report saved to:\n  {out_path}")
        except FileExistsError as err:
            print(f"\nError: {err}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    _main()
