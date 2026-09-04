import argparse
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
import sys
import time
import tracemalloc
from typing import Any, Sequence

from app.ml.pipeline.lifecycle import (
    DEFAULT_EMBEDDING_MODEL,
    DEFAULT_ENGLISH_SENTIMENT_MODEL,
    ModelLifecycleManager,
)
from app.ml.pipeline.metrics import get_process_peak_rss_mb
from app.schemas import CanonicalMessage

logger = logging.getLogger("traject.ml.pipeline.benchmark")


def load_benchmark_texts(fixture_path: Path | str, target_count: int = 128) -> list[str]:
    """Build a deterministic repeated benchmark corpus from the 16-record fixture."""
    path = Path(fixture_path).resolve()
    base_texts: list[str] = []

    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                msg = CanonicalMessage.model_validate_json(line)
                if msg.text_content and msg.text_content.strip():
                    base_texts.append(msg.text_content)

    if not base_texts:
        raise ValueError(f"No text records found in fixture {path}")

    # Replicate deterministically to reach target_count
    repeated_texts: list[str] = []
    idx = 0
    while len(repeated_texts) < target_count:
        repeated_texts.append(f"[{idx}] {base_texts[idx % len(base_texts)]}")
        idx += 1

    return repeated_texts


def run_benchmark(
    texts: Sequence[str],
    batch_sizes: Sequence[int] = (8, 16, 32, 64),
    sentiment_model_id: str = DEFAULT_ENGLISH_SENTIMENT_MODEL,
    embedding_model_id: str = DEFAULT_EMBEDDING_MODEL,
    device: str = "cpu",
) -> dict[str, Any]:
    """Execute reproducible batch-size benchmarks for sentiment and embedding inference.
    
    Guarantees:
    - Explicitly separates model loading (cold-start) from actual inference (warm).
    - Measures throughput (samples/sec), per-batch latency (ms), process Peak RSS (MB),
      and Peak Python allocation heap (MB).
    - Preserves deterministic ordering and CPU compatibility.
    """
    results: dict[str, Any] = {
        "benchmark_dataset_size": len(texts),
        "device": device,
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "sentiment": {},
        "embeddings": {},
    }

    # =========================================================================
    # 1. Sentiment Inference Benchmark
    # =========================================================================
    print(f"\nBenchmarking Sentiment Model: {sentiment_model_id}...")
    sent_mgr = ModelLifecycleManager()

    t_cold_start = time.perf_counter()
    sent_adapter = sent_mgr.get_sentiment_adapter(model_id=sentiment_model_id, device=device)
    sent_cold_time = time.perf_counter() - t_cold_start

    results["sentiment"]["model_id"] = sentiment_model_id
    results["sentiment"]["cold_start_load_seconds"] = round(sent_cold_time, 4)
    results["sentiment"]["batch_benchmarks"] = []

    # Warmup
    sent_adapter.predict_batch(texts[:4], batch_size=4)

    for bs in batch_sizes:
        tracemalloc.start()
        tracemalloc.reset_peak()

        t_infer_start = time.perf_counter()
        preds = sent_adapter.predict_batch(texts, batch_size=bs)
        infer_time = time.perf_counter() - t_infer_start

        current_mem, peak_mem = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        peak_rss = get_process_peak_rss_mb()
        peak_heap = round(peak_mem / (1024 * 1024), 2)
        num_batches = (len(texts) + bs - 1) // bs
        throughput = round(len(texts) / max(infer_time, 1e-6), 2)
        per_batch_ms = round((infer_time / max(num_batches, 1)) * 1000.0, 2)

        results["sentiment"]["batch_benchmarks"].append({
            "batch_size": bs,
            "total_samples": len(texts),
            "num_batches": num_batches,
            "inference_time_seconds": round(infer_time, 4),
            "throughput_samples_per_sec": throughput,
            "per_batch_latency_ms": per_batch_ms,
            "peak_rss_mb": peak_rss,
            "peak_python_heap_mb": peak_heap,
            "peak_memory_mb": peak_rss,
        })
        print(f"  Sentiment [Batch {bs:2d}]: {infer_time:.3f} s | {throughput:6.1f} samples/s | {per_batch_ms:5.1f} ms/batch | RSS: {peak_rss:.1f} MB | Heap: {peak_heap:.1f} MB")

    # =========================================================================
    # 2. Sentence Embedding Benchmark
    # =========================================================================
    print(f"\nBenchmarking Sentence Embedding Model: {embedding_model_id}...")
    emb_mgr = ModelLifecycleManager()

    t_cold_start = time.perf_counter()
    emb_adapter = emb_mgr.get_embedding_adapter(model_id=embedding_model_id, device=device)
    emb_cold_time = time.perf_counter() - t_cold_start

    results["embeddings"]["model_id"] = embedding_model_id
    results["embeddings"]["cold_start_load_seconds"] = round(emb_cold_time, 4)
    results["embeddings"]["batch_benchmarks"] = []

    # Warmup
    emb_adapter.encode(texts[:4], batch_size=4)

    for bs in batch_sizes:
        tracemalloc.start()
        tracemalloc.reset_peak()

        t_infer_start = time.perf_counter()
        vectors = emb_adapter.encode(texts, batch_size=bs, normalize_embeddings=True)
        infer_time = time.perf_counter() - t_infer_start

        current_mem, peak_mem = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        peak_rss = get_process_peak_rss_mb()
        peak_heap = round(peak_mem / (1024 * 1024), 2)
        num_batches = (len(texts) + bs - 1) // bs
        throughput = round(len(texts) / max(infer_time, 1e-6), 2)
        per_batch_ms = round((infer_time / max(num_batches, 1)) * 1000.0, 2)

        results["embeddings"]["batch_benchmarks"].append({
            "batch_size": bs,
            "total_samples": len(texts),
            "num_batches": num_batches,
            "inference_time_seconds": round(infer_time, 4),
            "throughput_samples_per_sec": throughput,
            "per_batch_latency_ms": per_batch_ms,
            "peak_rss_mb": peak_rss,
            "peak_python_heap_mb": peak_heap,
            "peak_memory_mb": peak_rss,
        })
        print(f"  Embedding [Batch {bs:2d}]: {infer_time:.3f} s | {throughput:6.1f} samples/s | {per_batch_ms:5.1f} ms/batch | RSS: {peak_rss:.1f} MB | Heap: {peak_heap:.1f} MB")

    return results


def main() -> None:
    if sys.stdout.encoding.lower() != "utf-8":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass

    parser = argparse.ArgumentParser(description="TRAJECT ML Inference Batch-Size Benchmark (Milestone 4H)")
    parser.add_argument(
        "--fixture",
        type=str,
        default="tests/fixtures/features/synthetic_enrichment_fixture.jsonl",
        help="Path to synthetic fixture dataset",
    )
    parser.add_argument("--samples", type=int, default=128, help="Target benchmark sample count")
    parser.add_argument(
        "--output",
        type=str,
        default="data/processed/benchmarks/benchmark_results.json",
        help="Destination path for benchmark results JSON",
    )
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing output file")

    args = parser.parse_args()

    print("=" * 80)
    print("TRAJECT ML Inference Performance Benchmark (Milestone 4H)")
    print("=" * 80)
    print(f"Target Samples: {args.samples}")
    print(f"Fixture Source: {args.fixture}")

    texts = load_benchmark_texts(args.fixture, target_count=args.samples)
    bench_results = run_benchmark(texts=texts, batch_sizes=(8, 16, 32, 64))

    print("\n" + "=" * 92)
    print("BENCHMARK SUMMARY TABLE:")
    print("=" * 92)
    print("Stage       | Batch Size | Cold Start | Warm Infer | Throughput    | Per-Batch Lat | Peak RSS   | Peak Heap")
    print("------------+------------+------------+------------+---------------+---------------+------------+----------")

    sent_cold = bench_results["sentiment"]["cold_start_load_seconds"]
    for row in bench_results["sentiment"]["batch_benchmarks"]:
        bs = row["batch_size"]
        w = row["inference_time_seconds"]
        tp = row["throughput_samples_per_sec"]
        lat = row["per_batch_latency_ms"]
        rss = row["peak_rss_mb"]
        heap = row["peak_python_heap_mb"]
        print(f"Sentiment   | {bs:10d} | {sent_cold:8.3f} s | {w:8.3f} s | {tp:8.1f} s/s | {lat:8.1f} ms | {rss:7.1f} MB | {heap:6.1f} MB")

    emb_cold = bench_results["embeddings"]["cold_start_load_seconds"]
    for row in bench_results["embeddings"]["batch_benchmarks"]:
        bs = row["batch_size"]
        w = row["inference_time_seconds"]
        tp = row["throughput_samples_per_sec"]
        lat = row["per_batch_latency_ms"]
        rss = row["peak_rss_mb"]
        heap = row["peak_python_heap_mb"]
        print(f"Embeddings  | {bs:10d} | {emb_cold:8.3f} s | {w:8.3f} s | {tp:8.1f} s/s | {lat:8.1f} ms | {rss:7.1f} MB | {heap:6.1f} MB")

    print("=" * 92)

    if args.output:
        out_path = Path(args.output).resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(bench_results, f, indent=2, ensure_ascii=False)
        print(f"\nMachine-readable benchmark report saved to:\n  {out_path}\n")


if __name__ == "__main__":
    main()
