import argparse
import json
import logging
import sys
import time
from pathlib import Path
from typing import Any, Sequence

from app.ml.dataset import load_canonical_dataset, prepare_language_aware_records
from app.ml.topics.clustering import cluster_embeddings
from app.ml.topics.embeddings import SentenceEmbeddingAdapter
from app.ml.topics.models import ClusteringConfig, TopicDiscoveryResult
from app.ml.topics.representation import build_topic_records
from app.schemas import CanonicalMessage


logger = logging.getLogger("traject.ml.topics.discovery")


def discover_topics(
    records: Sequence[Any],
    embedder: SentenceEmbeddingAdapter | None = None,
    config: ClusteringConfig | None = None,
    batch_size: int = 32,
    top_keywords: int = 5,
    top_representative_messages: int = 3,
) -> TopicDiscoveryResult:
    """Discover semantic topic clusters from normalized social media records.
    
    Processing Steps:
    1. Prepares language-aware text records (excluding media-only messages).
    2. Encodes normalized text into dense L2-normalized multilingual sentence embeddings.
    3. Executes HDBSCAN density clustering over embedding vectors.
    4. Computes c-TF-IDF keywords and centroid-proximal representative messages for each cluster.
    5. Assembles complete TopicDiscoveryResult diagnostic report.
    
    Args:
        records: Sequence of CanonicalMessage, MLTextRecord, or dicts with 'canonical_id' and 'text'.
        embedder: Optional initialized SentenceEmbeddingAdapter.
        config: Clustering hyperparameters.
        batch_size: Inference batch size for encoding.
        top_keywords: Max representative keywords to extract per topic.
        top_representative_messages: Max centroid message IDs to select per topic.
        
    Returns:
        TopicDiscoveryResult: Structured discovery report.
    """
    t_start = time.perf_counter()

    # Step 1: Normalize input representations
    canonical_ids: list[str] = []
    texts: list[str] = []

    if not records:
        return TopicDiscoveryResult(
            model_id="none",
            embedding_dimension=384,
            total_input_messages=0,
            clustered_messages=0,
            noise_messages=0,
            number_of_topics=0,
            topic_records=[],
            noise_message_ids=[],
            clustering_config=config or ClusteringConfig(),
            total_time_seconds=0.0,
        )

    first = records[0]
    if isinstance(first, CanonicalMessage):
        ml_records = prepare_language_aware_records(records)
        canonical_ids = [r.canonical_id for r in ml_records]
        texts = [r.normalized_text for r in ml_records]
    elif hasattr(first, "canonical_id") and hasattr(first, "normalized_text"):
        canonical_ids = [r.canonical_id for r in records]
        texts = [r.normalized_text for r in records]
    elif isinstance(first, dict):
        canonical_ids = [r.get("canonical_id", r.get("id", f"msg_{i:04d}")) for i, r in enumerate(records)]
        texts = [r.get("normalized_text", r.get("text", "")) for r in records]
    else:
        raise ValueError(f"Unsupported record type: {type(first)}")

    total_input = len(canonical_ids)
    if total_input == 0:
        return TopicDiscoveryResult(
            model_id="none",
            embedding_dimension=384,
            total_input_messages=0,
            clustered_messages=0,
            noise_messages=0,
            number_of_topics=0,
            topic_records=[],
            noise_message_ids=[],
            clustering_config=config or ClusteringConfig(),
            total_time_seconds=0.0,
        )

    # Step 2: Initialize embedder if needed
    t0 = time.perf_counter()
    load_time = 0.0
    if embedder is None:
        embedder = SentenceEmbeddingAdapter()
        load_time = time.perf_counter() - t0

    # Step 3: Compute dense sentence embeddings
    t0 = time.perf_counter()
    embeddings = embedder.encode(texts, batch_size=batch_size, normalize_embeddings=True)
    embed_time = time.perf_counter() - t0

    # Step 4: Run HDBSCAN clustering
    cfg = config or ClusteringConfig()
    t0 = time.perf_counter()
    labels, sil_score = cluster_embeddings(embeddings, config=cfg)
    cluster_time = time.perf_counter() - t0

    # Step 5: Build topic representations
    topic_records, noise_ids = build_topic_records(
        canonical_ids=canonical_ids,
        texts=texts,
        embeddings=embeddings,
        labels=labels,
        top_keywords=top_keywords,
        top_representative_messages=top_representative_messages,
    )

    clustered_count = total_input - len(noise_ids)
    total_time = round(time.perf_counter() - t_start, 4)

    return TopicDiscoveryResult(
        model_id=embedder.model_id,
        embedding_dimension=embedder.embedding_dimension,
        total_input_messages=total_input,
        clustered_messages=clustered_count,
        noise_messages=len(noise_ids),
        number_of_topics=len(topic_records),
        topic_records=topic_records,
        noise_message_ids=noise_ids,
        clustering_config=cfg,
        load_time_seconds=round(load_time, 4),
        embedding_time_seconds=round(embed_time, 4),
        clustering_time_seconds=round(cluster_time, 4),
        total_time_seconds=total_time,
        silhouette_score=sil_score,
    )


def _format_cli_topics(result: TopicDiscoveryResult) -> str:
    """Format topic discovery result for console output."""
    lines = [
        "================================================================================",
        "TRAJECT Topic Discovery Baseline Report (Milestone 4E)",
        "================================================================================",
        f"Embedding Model:     {result.model_id}",
        f"Embedding Dimension: {result.embedding_dimension}",
        f"Clustering Engine:   {result.clustering_config.algorithm} (min_cluster_size={result.clustering_config.min_cluster_size}, min_samples={result.clustering_config.min_samples})",
        "",
        "1. DATASET BREAKDOWN:",
        f"  Total Input Messages:   {result.total_input_messages}",
        f"  Clustered Messages:     {result.clustered_messages} ({(result.clustered_messages / result.total_input_messages * 100) if result.total_input_messages else 0:.1f}%)",
        f"  Noise Messages:         {result.noise_messages} ({(result.noise_messages / result.total_input_messages * 100) if result.total_input_messages else 0:.1f}%)",
        f"  Discovered Topics:      {result.number_of_topics}",
    ]
    if result.silhouette_score is not None:
        lines.append(f"  Silhouette Score:       {result.silhouette_score:.4f}")

    lines.extend([
        "",
        "2. PERFORMANCE & TIMING:",
        f"  Embedding Inference:    {result.embedding_time_seconds:.3f} s ({(result.total_input_messages / result.embedding_time_seconds) if result.embedding_time_seconds > 0 else 0:.1f} msg/sec)",
        f"  Clustering Runtime:     {result.clustering_time_seconds:.3f} s",
        f"  Total Pipeline Time:    {result.total_time_seconds:.3f} s",
        "",
        "3. DISCOVERED TOPIC CANDIDATES:",
    ])

    if not result.topic_records:
        lines.append("  (No dense topics discovered; all samples classified as noise/outliers)")
    else:
        for t in result.topic_records:
            kw_str = ", ".join(f"{k.keyword} ({k.score:.2f})" for k in t.representative_keywords)
            lines.append(f"  [{t.topic_id}] {t.message_count} messages ({t.percentage_of_dataset:.1f}%)")
            lines.append(f"    Keywords:        {kw_str}")
            lines.append(f"    Representative:  {', '.join(t.representative_message_ids[:3])}")
            lines.append("")

    if result.noise_message_ids:
        lines.append(f"4. NOISE / OUTLIER MESSAGES ({len(result.noise_message_ids)}):")
        sample_noise = ", ".join(result.noise_message_ids[:5])
        suffix = "..." if len(result.noise_message_ids) > 5 else ""
        lines.append(f"  IDs: {sample_noise}{suffix}")

    lines.append("================================================================================")
    return "\n".join(lines)


def _main() -> None:
    """CLI runner for Topic Discovery Baseline."""
    parser = argparse.ArgumentParser(
        description="Discover semantic topic clusters from social media text.",
    )
    parser.add_argument(
        "--parquet",
        default=None,
        help="Path to processed canonical Parquet dataset.",
    )
    parser.add_argument(
        "--fixture",
        default=None,
        help="Path to JSONL fixture dataset with 'text' and 'id' fields.",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Path to save JSON discovery report.",
    )
    parser.add_argument(
        "--min-cluster-size",
        type=int,
        default=2,
        help="Minimum cluster size for HDBSCAN (default: 2).",
    )
    parser.add_argument(
        "--min-samples",
        type=int,
        default=1,
        help="Minimum samples for HDBSCAN core distance (default: 1).",
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

    records: list[Any] = []
    if args.parquet:
        in_path = Path(args.parquet).resolve()
        if not in_path.is_file():
            print(f"Error: Parquet file not found: {in_path}", file=sys.stderr)
            sys.exit(1)
        print(f"Loading Canonical dataset from {in_path.name}...")
        records = load_canonical_dataset(in_path)

    elif args.fixture:
        in_path = Path(args.fixture).resolve()
        if not in_path.is_file():
            print(f"Error: Fixture file not found: {in_path}", file=sys.stderr)
            sys.exit(1)
        print(f"Loading fixture records from {in_path.name}...")
        with open(in_path, encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    records.append(json.loads(line))

    cfg = ClusteringConfig(
        min_cluster_size=args.min_cluster_size,
        min_samples=args.min_samples,
    )

    print(f"Running topic discovery pipeline on {len(records)} records...")
    result = discover_topics(records, config=cfg)

    print()
    print(_format_cli_topics(result))

    if args.output:
        out_path = Path(args.output).resolve()
        try:
            result.save_json(out_path, overwrite=args.overwrite)
            print(f"\nTopic discovery report saved to:\n  {out_path}")
        except FileExistsError as err:
            print(f"\nError: {err}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    _main()
