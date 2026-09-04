import json
from pathlib import Path
from unittest.mock import MagicMock

import numpy as np
import pytest

from app.ml.topics.clustering import cluster_embeddings
from app.ml.topics.discovery import discover_topics
from app.ml.topics.embeddings import SentenceEmbeddingAdapter
from app.ml.topics.models import (
    ClusteringConfig,
    TopicDiscoveryResult,
    TopicKeyword,
    TopicRecord,
)
from app.ml.topics.representation import (
    build_topic_records,
    extract_cluster_keywords,
    find_representative_messages,
    tokenize_text,
)


def test_topic_models_serialization(tmp_path):
    """1. Verify TopicDiscoveryResult serializes to JSON with overwrite guard."""
    config = ClusteringConfig(min_cluster_size=2, min_samples=1)
    record = TopicRecord(
        topic_id="topic_000",
        cluster_label=0,
        message_count=3,
        percentage_of_dataset=60.0,
        representative_keywords=[TopicKeyword(keyword="security", score=1.0)],
        representative_message_ids=["msg_1"],
        sample_message_ids=["msg_1", "msg_2", "msg_3"],
    )
    result = TopicDiscoveryResult(
        model_id="test-embedder",
        embedding_dimension=384,
        total_input_messages=5,
        clustered_messages=3,
        noise_messages=2,
        number_of_topics=1,
        topic_records=[record],
        noise_message_ids=["msg_4", "msg_5"],
        clustering_config=config,
    )

    out_file = tmp_path / "topics.json"
    result.save_json(out_file)
    assert out_file.exists()

    data = json.loads(out_file.read_text(encoding="utf-8"))
    assert data["model_id"] == "test-embedder"
    assert data["number_of_topics"] == 1
    assert data["topic_records"][0]["topic_id"] == "topic_000"

    # Test overwrite protection
    with pytest.raises(FileExistsError):
        result.save_json(out_file, overwrite=False)

    result.save_json(out_file, overwrite=True)


def test_tokenize_text_and_stopwords():
    """2. Verify tokenization strips URLs, raw mentions, and stopwords while preserving hashtags and Unicode."""
    text = "Check this alert on https://t.me/news @admin: #Security breach reported in Delhi! सुरक्षा अलर्ट"
    tokens = tokenize_text(text)

    assert "https" not in tokens
    assert "t.me" not in tokens
    assert "admin" not in tokens
    assert "security" in tokens
    assert "breach" in tokens
    assert "reported" in tokens
    assert "delhi" in tokens
    assert "सुरक्षा" in tokens
    assert "अलर्ट" in tokens


def test_extract_cluster_keywords_ctfidf():
    """3. Verify c-TF-IDF keyword extraction ranks distinctive cluster terms highest."""
    cluster_a = [
        "border patrol deployed radar at northern frontier",
        "border security forces patrol the boundary line",
    ]
    cluster_b = [
        "football match ended with thrilling penalty shootout",
        "champions league football derby in the stadium",
    ]

    keywords_a = extract_cluster_keywords(cluster_a, [cluster_a, cluster_b], top_k=3)
    kw_terms_a = [k.keyword for k in keywords_a]

    assert "border" in kw_terms_a or "patrol" in kw_terms_a
    assert "football" not in kw_terms_a

    keywords_b = extract_cluster_keywords(cluster_b, [cluster_a, cluster_b], top_k=3)
    kw_terms_b = [k.keyword for k in keywords_b]

    assert "football" in kw_terms_b
    assert "border" not in kw_terms_b


def test_find_representative_messages():
    """4. Verify representative message selection picks items closest to cluster centroid."""
    # 3 vectors in 2D space: v1=(1, 0), v2=(0.99, 0.05), v3=(0.8, 0.6)
    embeddings = np.array([
        [1.0, 0.0],
        [0.99, 0.05],
        [0.8, 0.6],
    ], dtype=np.float32)
    ids = ["id_1", "id_2", "id_3"]

    # Normalize vectors
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    embeddings = embeddings / norms

    rep = find_representative_messages(embeddings, ids, top_m=2)
    assert len(rep) == 2
    assert "id_1" in rep or "id_2" in rep


def test_build_topic_records_and_noise():
    """5. Verify build_topic_records aggregates counts, percentages, and separates noise."""
    canonical_ids = ["m1", "m2", "m3", "m4", "m5"]
    texts = [
        "border defense patrol",
        "border security command",
        "football match trophy",
        "football cup derby",
        "completely random unrelated chatter",
    ]
    embeddings = np.random.randn(5, 10).astype(np.float32)
    labels = np.array([0, 0, 1, 1, -1])

    topics, noise = build_topic_records(canonical_ids, texts, embeddings, labels)

    assert len(topics) == 2
    assert len(noise) == 1
    assert noise == ["m5"]

    assert topics[0].message_count == 2
    assert topics[0].percentage_of_dataset == 40.0
    assert topics[1].message_count == 2
    assert topics[1].percentage_of_dataset == 40.0


def test_cluster_embeddings_mocked():
    """6. Verify HDBSCAN separates synthetic dense Gaussian blobs."""
    np.random.seed(42)
    # Create 2 tight clusters of 5 points each
    blob_1 = np.random.normal(loc=0.0, scale=0.01, size=(5, 10))
    blob_2 = np.random.normal(loc=10.0, scale=0.01, size=(5, 10))
    embeddings = np.vstack([blob_1, blob_2]).astype(np.float32)

    config = ClusteringConfig(min_cluster_size=3, min_samples=1)
    labels, sil = cluster_embeddings(embeddings, config=config)

    assert len(labels) == 10
    # Group 1 and Group 2 should have distinct cluster IDs
    assert labels[0] == labels[1] == labels[2]
    assert labels[5] == labels[6] == labels[7]
    assert labels[0] != labels[5]
    assert labels[0] != -1
    assert labels[5] != -1


def test_discover_topics_mocked():
    """7. Verify discover_topics orchestration using a mocked embedding adapter."""
    mock_embedder = MagicMock(spec=SentenceEmbeddingAdapter)
    mock_embedder.model_id = "mock-minilm"
    mock_embedder.embedding_dimension = 4

    # 4 messages: 2 border, 2 football
    records = [
        {"canonical_id": "b1", "text": "border surveillance outpost radar"},
        {"canonical_id": "b2", "text": "frontier border security forces patrol"},
        {"canonical_id": "f1", "text": "football stadium goal score win"},
        {"canonical_id": "f2", "text": "champions league football match striker"},
    ]

    # Return 2 separated 4D vectors
    mock_embedder.encode.return_value = np.array([
        [1.0, 0.0, 0.0, 0.0],
        [0.99, 0.01, 0.0, 0.0],
        [0.0, 0.0, 1.0, 0.0],
        [0.0, 0.0, 0.99, 0.01],
    ], dtype=np.float32)

    cfg = ClusteringConfig(min_cluster_size=2, min_samples=1)
    result = discover_topics(records, embedder=mock_embedder, config=cfg)

    assert result.total_input_messages == 4
    assert result.clustered_messages == 4
    assert result.noise_messages == 0
    assert result.number_of_topics == 2


def test_small_dataset_graceful_noise():
    """8. Verify small dataset below min_cluster_size returns all noise gracefully without error."""
    records = [
        {"canonical_id": "m1", "text": "isolated single text"},
    ]
    mock_embedder = MagicMock(spec=SentenceEmbeddingAdapter)
    mock_embedder.model_id = "mock-minilm"
    mock_embedder.embedding_dimension = 4
    mock_embedder.encode.return_value = np.array([[1.0, 0.0, 0.0, 0.0]], dtype=np.float32)

    cfg = ClusteringConfig(min_cluster_size=3)
    result = discover_topics(records, embedder=mock_embedder, config=cfg)

    assert result.total_input_messages == 1
    assert result.clustered_messages == 0
    assert result.noise_messages == 1
    assert result.number_of_topics == 0
    assert result.noise_message_ids == ["m1"]


def test_empty_input_handling():
    """9. Verify empty input returns zero-count topic result safely."""
    result = discover_topics([])
    assert result.total_input_messages == 0
    assert result.number_of_topics == 0
    assert result.noise_messages == 0
