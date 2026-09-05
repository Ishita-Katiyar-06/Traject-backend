def test_get_analytics_overview_success(client):
    """Verify GET /api/v1/analytics returns typed dashboard summary statistics."""
    resp = client.get("/api/v1/analytics")
    assert resp.status_code == 200
    data = resp.json()

    assert "data" in data
    payload = data["data"]

    # Verify counts
    counts = payload["summary_counts"]
    assert counts["total_messages"] == 16
    assert counts["text_bearing_messages"] == 16
    assert counts["media_only_messages"] == 0
    assert counts["total_topics"] == 3
    assert counts["total_narratives"] == 3

    # Verify priority distribution
    priority = payload["priority_distribution"]
    assert "critical" in priority
    assert "high" in priority
    assert "elevated" in priority
    assert "routine" in priority
    assert sum(priority.values()) == 3

    # Verify sentiment overview
    sentiment = payload["sentiment_overview"]
    assert sentiment["evaluated_messages_count"] > 0
    assert "distribution" in sentiment
    dist = sentiment["distribution"]
    assert "positive_ratio" in dist
    assert "neutral_ratio" in dist
    assert "negative_ratio" in dist

    # Verify pipeline execution metadata
    execution = payload["pipeline_execution"]
    assert execution["total_runtime_seconds"] > 0.0
    assert "created_at_utc" in execution
