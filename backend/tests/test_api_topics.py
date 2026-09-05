def test_list_topics_default(client):
    """Verify GET /api/v1/topics returns paginated list of discovered topics with keywords."""
    resp = client.get("/api/v1/topics")
    assert resp.status_code == 200
    body = resp.json()

    assert "data" in body
    assert "meta" in body
    data = body["data"]

    assert len(data) == 3
    for topic in data:
        assert topic["topic_id"].startswith("topic_")
        assert topic["message_count"] > 0
        assert "representative_keywords" in topic
        assert len(topic["representative_keywords"]) > 0
        assert all("keyword" in k and "score" in k for k in topic["representative_keywords"])


def test_get_topic_by_id_success(client):
    """Verify GET /api/v1/topics/{id} returns topic details joined with 4F contextual features."""
    resp = client.get("/api/v1/topics/topic_000")
    assert resp.status_code == 200
    body = resp.json()

    assert "data" in body
    t = body["data"]
    assert t["topic_id"] == "topic_000"
    assert t["cluster_label"] >= 0
    assert len(t["representative_keywords"]) > 0
    assert len(t["representative_message_ids"]) > 0
    assert "engagement" in t
    assert "propagation" in t
    assert "temporal" in t


def test_get_topic_by_id_not_found(client):
    """Verify GET /api/v1/topics/{id} returns 404 for unknown topic ID."""
    resp = client.get("/api/v1/topics/topic_999")
    assert resp.status_code == 404
    body = resp.json()
    assert "error" in body
    assert body["error"]["code"] == "RESOURCE_NOT_FOUND"
