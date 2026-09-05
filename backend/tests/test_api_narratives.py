def test_list_narratives_default(client):
    """Verify GET /api/v1/narratives returns paginated narrative list sorted by priority score DESC."""
    resp = client.get("/api/v1/narratives")
    assert resp.status_code == 200
    body = resp.json()

    assert "data" in body
    assert "meta" in body
    data = body["data"]
    meta = body["meta"]

    assert len(data) == 3
    assert meta["total"] == 3
    assert meta["page"] == 1
    assert meta["page_size"] == 20
    assert meta["total_pages"] == 1

    # Verify descending sort order
    scores = [item["priority_signal_score"] for item in data]
    assert scores == sorted(scores, reverse=True)


def test_list_narratives_filtering_and_pagination(client):
    """Verify filtering narratives by priority_tier, min_priority, and pagination limits."""
    # Filter by min_priority
    resp = client.get("/api/v1/narratives?min_priority=0.40")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert all(item["priority_signal_score"] >= 0.40 for item in data)

    # Filter with pagination page_size=1
    resp_paged = client.get("/api/v1/narratives?page=1&page_size=1")
    assert resp_paged.status_code == 200
    body = resp_paged.json()
    assert len(body["data"]) == 1
    assert body["meta"]["page_size"] == 1
    assert body["meta"]["total"] == 3
    assert body["meta"]["total_pages"] == 3
    assert body["meta"]["has_next"] is True
    assert body["meta"]["has_prev"] is False


def test_get_narrative_by_id_success(client):
    """Verify GET /api/v1/narratives/{id} returns full explainability details for valid candidate."""
    resp = client.get("/api/v1/narratives/narrative_000")
    assert resp.status_code == 200
    body = resp.json()

    assert "data" in body
    item = body["data"]
    assert item["narrative_id"] == "narrative_000"
    assert "headline_claim" in item
    assert "priority_signal_score" in item
    assert "sub_scores" in item
    assert "coordination_signals" in item
    assert "data_coverage" in item
    assert "audit_rationale" in item
    assert len(item["audit_rationale"]) > 0


def test_get_narrative_by_id_not_found(client):
    """Verify GET /api/v1/narratives/{id} returns 404 with structured ErrorEnvelope for non-existent ID."""
    resp = client.get("/api/v1/narratives/narrative_999")
    assert resp.status_code == 404
    body = resp.json()

    assert "error" in body
    err = body["error"]
    assert err["code"] == "RESOURCE_NOT_FOUND"
    assert "narrative_999" in err["message"]
    assert err["details"]["resource_type"] == "narrative"
