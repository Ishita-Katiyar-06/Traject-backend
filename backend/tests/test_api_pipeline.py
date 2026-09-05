def test_get_pipeline_status(client):
    """Verify GET /api/v1/pipeline/status returns status and provenance metadata."""
    resp = client.get("/api/v1/pipeline/status")
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "completed"
    assert "dataset_source" in data
    assert "created_at_utc" in data
    assert data["pipeline_version"] == "4h.v1"
    assert "cache_status" in data


def test_get_pipeline_metrics(client):
    """Verify GET /api/v1/pipeline/metrics returns stage latencies and memory footprint."""
    resp = client.get("/api/v1/pipeline/metrics")
    assert resp.status_code == 200
    data = resp.json()

    assert "stage_latencies_seconds" in data
    latencies = data["stage_latencies_seconds"]
    assert "language_detection" in latencies
    assert "sentiment_load" in latencies
    assert "embedding_load" in latencies
    assert "topic_discovery" in latencies
    assert "total_runtime" in latencies

    assert "execution_breakdown" in data
    assert "record_accounting" in data
    assert "cache_performance" in data
    assert "memory_footprint_mb" in data
    assert "peak_process_rss_mb" in data["memory_footprint_mb"]
