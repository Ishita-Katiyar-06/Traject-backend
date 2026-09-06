from pathlib import Path
import numpy as np
import pytest

from app.ml.pipeline.benchmark import load_benchmark_texts, run_benchmark
from app.ml.pipeline.cache import InferenceCache
from app.ml.pipeline.lifecycle import ModelLifecycleManager
from app.ml.pipeline.orchestrator import PipelineConfig, run_ml_pipeline
from app.schemas import CanonicalMessage

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "features" / "synthetic_enrichment_fixture.jsonl"


def load_fixture_messages() -> list[CanonicalMessage]:
    messages: list[CanonicalMessage] = []
    with open(FIXTURE_PATH, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                messages.append(CanonicalMessage.model_validate_json(line))
    return messages


def test_model_lifecycle_manager_reuse():
    """1. Verify ModelLifecycleManager loads each model once and returns the exact same object."""
    mgr = ModelLifecycleManager()

    # Initial state
    assert not mgr.is_sentiment_loaded()
    assert not mgr.is_embedding_loaded()
    assert len(mgr.get_load_times()) == 0

    # First access loads model
    sent1 = mgr.get_sentiment_adapter()
    assert mgr.is_sentiment_loaded()
    load_times = mgr.get_load_times()
    assert any("sentiment" in k for k in load_times)

    # Second access reuses the identical adapter instance without reloading
    sent2 = mgr.get_sentiment_adapter()
    assert sent1 is sent2

    # Embedding adapter reuse
    emb1 = mgr.get_embedding_adapter()
    assert mgr.is_embedding_loaded()
    emb2 = mgr.get_embedding_adapter()
    assert emb1 is emb2

    mgr.clear()
    assert not mgr.is_sentiment_loaded()
    assert not mgr.is_embedding_loaded()


def test_batch_sizes_prediction_consistency():
    """2. Verify that different batch sizes (8, 16, 32) produce numerically identical predictions."""
    texts = load_benchmark_texts(FIXTURE_PATH, target_count=32)

    mgr = ModelLifecycleManager()
    sent_adapter = mgr.get_sentiment_adapter()
    emb_adapter = mgr.get_embedding_adapter()

    # Sentiment consistency across batch size 8 vs 32
    preds_b8 = sent_adapter.predict_batch(texts, batch_size=8)
    preds_b32 = sent_adapter.predict_batch(texts, batch_size=32)

    assert len(preds_b8) == len(preds_b32) == 32
    for p8, p32 in zip(preds_b8, preds_b32):
        assert p8.label == p32.label
        assert p8.confidence == p32.confidence
        for k in p8.scores:
            assert p8.scores[k] == p32.scores[k]

    # Embedding consistency across batch size 8 vs 32
    emb_b8 = emb_adapter.encode(texts, batch_size=8, normalize_embeddings=True)
    emb_b32 = emb_adapter.encode(texts, batch_size=32, normalize_embeddings=True)

    assert emb_b8.shape == emb_b32.shape == (32, 384)
    # Vectors must match within float precision tolerance (1e-5)
    assert np.allclose(emb_b8, emb_b32, atol=1e-5)


def test_benchmark_runner_execution():
    """3. Verify benchmark runner separates cold-start from warm inference and returns structured data."""
    texts = load_benchmark_texts(FIXTURE_PATH, target_count=16)

    results = run_benchmark(
        texts=texts,
        batch_sizes=(8, 16),
        device="cpu",
    )

    assert results["benchmark_dataset_size"] == 16
    assert results["device"] == "cpu"
    assert "sentiment" in results
    assert "embeddings" in results

    # Cold start load time must be positive
    assert results["sentiment"]["cold_start_load_seconds"] >= 0.0
    assert results["embeddings"]["cold_start_load_seconds"] >= 0.0

    # Batch benchmarks verification
    sent_batches = results["sentiment"]["batch_benchmarks"]
    assert len(sent_batches) == 2
    assert sent_batches[0]["batch_size"] == 8
    assert sent_batches[0]["throughput_samples_per_sec"] > 0.0
    assert sent_batches[0]["peak_memory_mb"] >= 0.0

    emb_batches = results["embeddings"]["batch_benchmarks"]
    assert len(emb_batches) == 2
    assert emb_batches[1]["batch_size"] == 16
    assert emb_batches[1]["throughput_samples_per_sec"] > 0.0


def test_cache_vs_nocache_result_exact_parity():
    """4. Verify pipeline outputs with caching enabled match non-cached execution exactly."""
    messages = load_fixture_messages()

    lifecycle = ModelLifecycleManager()

    # Run without cache
    cfg_nocache = PipelineConfig(enable_cache=False, min_cluster_size=2)
    res_nocache = run_ml_pipeline(messages=messages, config=cfg_nocache, lifecycle_manager=lifecycle)

    # Run with cache
    cache = InferenceCache(":memory:")
    cfg_cache = PipelineConfig(enable_cache=True, min_cluster_size=2)
    res_cache = run_ml_pipeline(messages=messages, config=cfg_cache, lifecycle_manager=lifecycle, cache=cache)

    # Parity checks
    assert res_nocache.topics.number_of_topics == res_cache.topics.number_of_topics
    assert res_nocache.topics.clustered_messages == res_cache.topics.clustered_messages
    assert res_nocache.topics.noise_messages == res_cache.topics.noise_messages

    cands_no = res_nocache.narrative_report.narrative_candidates
    cands_ca = res_cache.narrative_report.narrative_candidates
    assert len(cands_no) == len(cands_ca)

    for c1, c2 in zip(cands_no, cands_ca):
        assert c1.narrative_id == c2.narrative_id
        assert c1.headline_claim == c2.headline_claim
        assert c1.priority_signal_score == c2.priority_signal_score
        assert c1.priority_tier == c2.priority_tier
        assert c1.sub_scores.spread_score == c2.sub_scores.spread_score
        assert c1.sub_scores.coordination_score == c2.sub_scores.coordination_score
        assert c1.sub_scores.reach_score == c2.sub_scores.reach_score
        assert c1.sub_scores.friction_score == c2.sub_scores.friction_score
