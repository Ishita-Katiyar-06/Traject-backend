import numpy as np
import pytest

from app.ml.pipeline.cache import (
    CachedSentenceEmbeddingAdapter,
    CachedSentimentModelAdapter,
    InferenceCache,
    compute_cache_key,
)
from app.ml.sentiment.models import SentimentLabel, SentimentPrediction


def test_cache_key_determinism_and_invalidation():
    """1. Verify cache keys are deterministic, collision-resistant, and invalidate upon version change."""
    key1 = compute_cache_key(
        namespace="sentiment",
        input_id="msg_001",
        normalized_text="hello world",
        model_id="test-model",
        model_revision="rev1",
        pipeline_version="4h.v1",
    )
    key2 = compute_cache_key(
        namespace="sentiment",
        input_id="msg_001",
        normalized_text="hello world",
        model_id="test-model",
        model_revision="rev1",
        pipeline_version="4h.v1",
    )
    assert key1 == key2

    # Different pipeline version produces distinct key (cache invalidation)
    key_v2 = compute_cache_key(
        namespace="sentiment",
        input_id="msg_001",
        normalized_text="hello world",
        model_id="test-model",
        model_revision="rev1",
        pipeline_version="4h.v2",
    )
    assert key1 != key_v2

    # Different model revision produces distinct key
    key_rev2 = compute_cache_key(
        namespace="sentiment",
        input_id="msg_001",
        normalized_text="hello world",
        model_id="test-model",
        model_revision="rev2",
        pipeline_version="4h.v1",
    )
    assert key1 != key_rev2

    # Different text produces distinct key
    key_text2 = compute_cache_key(
        namespace="sentiment",
        input_id="msg_001",
        normalized_text="hello earth",
        model_id="test-model",
        model_revision="rev1",
        pipeline_version="4h.v1",
    )
    assert key1 != key_text2


def test_inference_cache_sentiment_operations():
    """2. Verify sentiment storage, retrieval, batch lookup, and metrics."""
    cache = InferenceCache(":memory:")

    key = "sentiment:test:001"
    pred = SentimentPrediction(
        label=SentimentLabel.POSITIVE,
        confidence=0.9543,
        scores={"positive": 0.9543, "neutral": 0.0400, "negative": 0.0057},
        model_id="test-model",
    )

    # Miss
    assert cache.get_sentiment(key) is None
    assert cache.hits == 0
    assert cache.misses == 1
    assert cache.hit_rate == 0.0

    # Put and Hit
    cache.set_sentiment(key, pred)
    retrieved = cache.get_sentiment(key)
    assert retrieved is not None
    assert retrieved.label == SentimentLabel.POSITIVE
    assert retrieved.confidence == 0.9543
    assert retrieved.scores["positive"] == 0.9543
    assert cache.hits == 1
    assert cache.misses == 1
    assert cache.hit_rate == 0.50

    # Batch operations
    key2 = "sentiment:test:002"
    pred2 = SentimentPrediction(
        label=SentimentLabel.NEGATIVE,
        confidence=0.8800,
        scores={"negative": 0.8800, "neutral": 0.1000, "positive": 0.0200},
        model_id="test-model",
    )
    cache.set_sentiment_batch([(key2, pred2)])

    batch_res = cache.get_sentiment_batch([key, key2, "non_existent"])
    assert len(batch_res) == 3
    assert batch_res[0] is not None and batch_res[0].label == SentimentLabel.POSITIVE
    assert batch_res[1] is not None and batch_res[1].label == SentimentLabel.NEGATIVE
    assert batch_res[2] is None

    cache.close()


def test_inference_cache_embedding_operations():
    """3. Verify embedding vector storage, binary byte preservation, and batch lookup."""
    cache = InferenceCache(":memory:")

    key = "embedding:test:001"
    vec = np.random.randn(384).astype(np.float32)

    assert cache.get_embedding(key) is None
    cache.set_embedding(key, vec, model_id="minilm")

    retrieved = cache.get_embedding(key)
    assert retrieved is not None
    assert retrieved.shape == (384,)
    assert np.allclose(vec, retrieved, atol=1e-6)

    # Batch set and get
    key2 = "embedding:test:002"
    vec2 = np.random.randn(384).astype(np.float32)
    cache.set_embedding_batch([(key2, vec2)], model_id="minilm")

    batch_vecs = cache.get_embedding_batch([key, key2, "non_existent_key"])
    assert len(batch_vecs) == 3
    assert np.allclose(batch_vecs[0], vec, atol=1e-6)
    assert np.allclose(batch_vecs[1], vec2, atol=1e-6)
    assert batch_vecs[2] is None

    cache.close()


def test_inference_cache_sqlite_file_persistence(tmp_path):
    """4. Verify SQLite database persistence across independent cache instances."""
    db_file = tmp_path / "cache.db"

    cache1 = InferenceCache(db_file)
    key = "key1"
    pred = SentimentPrediction(
        label=SentimentLabel.NEUTRAL,
        confidence=0.7500,
        scores={"neutral": 0.75},
        model_id="test-model",
    )
    cache1.set_sentiment(key, pred)
    cache1.close()

    # Open with new instance pointing to same file
    cache2 = InferenceCache(db_file)
    retrieved = cache2.get_sentiment(key)
    assert retrieved is not None
    assert retrieved.label == SentimentLabel.NEUTRAL
    assert retrieved.confidence == 0.7500
    cache2.close()


def test_cached_sentiment_adapter_transparent_wrapping():
    """5. Verify CachedSentimentModelAdapter only invokes underlying model on cache misses."""
    from unittest.mock import MagicMock

    mock_raw_adapter = MagicMock()
    mock_raw_adapter.model_id = "mock-model"
    mock_raw_adapter.device = "cpu"
    mock_raw_adapter.idx_to_label = {}
    mock_raw_adapter.max_length = 512

    p1 = SentimentPrediction(label=SentimentLabel.POSITIVE, confidence=0.9, scores={}, model_id="mock-model")
    p2 = SentimentPrediction(label=SentimentLabel.NEGATIVE, confidence=0.8, scores={}, model_id="mock-model")
    mock_raw_adapter.predict_batch.return_value = [p1, p2]

    cache = InferenceCache(":memory:")
    cached_adapter = CachedSentimentModelAdapter(adapter=mock_raw_adapter, cache=cache)

    texts = ["good news", "bad news"]
    # First call -> miss -> calls raw adapter
    res1 = cached_adapter.predict_batch(texts, batch_size=2)
    assert len(res1) == 2
    assert res1[0].label == SentimentLabel.POSITIVE
    assert mock_raw_adapter.predict_batch.call_count == 1

    # Second call with same texts -> 100% hits -> does NOT call raw adapter
    res2 = cached_adapter.predict_batch(texts, batch_size=2)
    assert len(res2) == 2
    assert res2[0].label == SentimentLabel.POSITIVE
    assert mock_raw_adapter.predict_batch.call_count == 1  # Still 1!
    assert cache.hit_rate == 0.50  # 2 misses in call 1, 2 hits in call 2 -> 2/4 = 0.50


def test_cached_embedding_adapter_transparent_wrapping():
    """6. Verify CachedSentenceEmbeddingAdapter only invokes underlying model on cache misses."""
    from unittest.mock import MagicMock

    mock_raw_adapter = MagicMock()
    mock_raw_adapter.model_id = "mock-embed"
    mock_raw_adapter.device = "cpu"
    mock_raw_adapter.batch_size = 32
    mock_raw_adapter.embedding_dimension = 4

    vecs = np.array([[0.1, 0.2, 0.3, 0.4], [0.5, 0.6, 0.7, 0.8]], dtype=np.float32)
    mock_raw_adapter.encode.return_value = vecs

    cache = InferenceCache(":memory:")
    cached_adapter = CachedSentenceEmbeddingAdapter(adapter=mock_raw_adapter, cache=cache)

    texts = ["alpha", "beta"]
    # First call -> miss
    out1 = cached_adapter.encode(texts)
    assert out1.shape == (2, 4)
    assert mock_raw_adapter.encode.call_count == 1

    # Second call -> hit
    out2 = cached_adapter.encode(texts)
    assert out2.shape == (2, 4)
    assert np.allclose(out1, out2)
    assert mock_raw_adapter.encode.call_count == 1  # Still 1!


def test_cache_key_semantics_canonical_vs_content_identity():
    """7. Explicitly verify cache key semantics for identical text content across distinct canonical IDs.
    
    In Telegram syndication, different channels publish the exact same text with different canonical IDs:
      - chanA:101 has text 'Security alert...'
      - chanD:401 has text 'Security alert...' (identical)
      
    This test verifies:
    1. Content-derived keying (default in cached adapters) maps identical text to the same key,
       enabling text-level cache reuse across distinct canonical IDs without semantic drift.
    2. Explicit canonical ID keying maps distinct canonical IDs to distinct keys when strict
       provenance scoping is required.
    """
    from unittest.mock import MagicMock

    text_content = "Security alert: Border Patrol deployed new radar at northern outpost in Ladakh."
    
    # 1. Content-identity keying (default fallback)
    key_chan_a = compute_cache_key(
        namespace="sentiment",
        input_id="text_abc123",
        normalized_text=text_content,
        model_id="roberta-sentiment",
    )
    key_chan_d = compute_cache_key(
        namespace="sentiment",
        input_id="text_abc123",  # same text produces same sha256 prefix
        normalized_text=text_content,
        model_id="roberta-sentiment",
    )
    assert key_chan_a == key_chan_d

    # 2. Strict canonical ID keying
    key_strict_a = compute_cache_key(
        namespace="sentiment",
        input_id="telegram:chanA:101",
        normalized_text=text_content,
        model_id="roberta-sentiment",
    )
    key_strict_d = compute_cache_key(
        namespace="sentiment",
        input_id="telegram:chanD:401",
        normalized_text=text_content,
        model_id="roberta-sentiment",
    )
    assert key_strict_a != key_strict_d

    # 3. Behavioral test: identical text from different channels hits the content cache
    mock_raw = MagicMock()
    mock_raw.model_id = "test-sent"
    mock_raw.predict_batch.return_value = [
        SentimentPrediction(label=SentimentLabel.NEUTRAL, confidence=0.9, scores={}, model_id="test-sent")
    ]

    cache = InferenceCache(":memory:")
    adapter = CachedSentimentModelAdapter(adapter=mock_raw, cache=cache)

    # First request from channel A
    res_a = adapter.predict_batch([text_content])
    assert len(res_a) == 1
    assert mock_raw.predict_batch.call_count == 1
    assert cache.hits == 0
    assert cache.misses == 1

    # Second request with same text (simulating channel D syndication)
    res_d = adapter.predict_batch([text_content])
    assert len(res_d) == 1
    assert mock_raw.predict_batch.call_count == 1  # No re-computation!
    assert cache.hits == 1
    assert cache.misses == 1
    assert cache.hit_rate == 0.50
    assert res_a[0].label == res_d[0].label


def test_inter_stage_cache_reuse_in_pipeline_simulation():
    """8. Verify inter-stage cache hits (e.g. Stage 3 embeddings reused in Stage 4 syndication)."""
    from unittest.mock import MagicMock

    raw_embed = MagicMock()
    raw_embed.model_id = "minilm"
    raw_embed.device = "cpu"
    raw_embed.batch_size = 16
    raw_embed.embedding_dimension = 4
    raw_embed.encode.side_effect = lambda texts, **kw: np.ones((len(texts), 4), dtype=np.float32)

    cache = InferenceCache(":memory:")
    cached_embed = CachedSentenceEmbeddingAdapter(adapter=raw_embed, cache=cache)

    # Stage 3: Topic Discovery encodes 16 messages
    all_texts = [f"Text message {i}" for i in range(16)]
    stage3_vectors = cached_embed.encode(all_texts)
    assert stage3_vectors.shape == (16, 4)
    assert raw_embed.encode.call_count == 1
    assert cache.misses == 16
    assert cache.hits == 0

    # Stage 4: Feature Enrichment re-encodes a cluster of 7 messages for syndication
    cluster_texts = all_texts[:7]
    stage4_vectors = cached_embed.encode(cluster_texts)
    assert stage4_vectors.shape == (7, 4)
    assert raw_embed.encode.call_count == 1  # Raw model NOT called again
    assert cache.misses == 16
    assert cache.hits == 7  # All 7 cluster messages were immediate hits!
    assert round(cache.hit_rate, 4) == round(7 / 23, 4)

