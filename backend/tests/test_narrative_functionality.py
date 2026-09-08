import pytest

def test_list_narratives_search_exact_id(client):
    """Verify searching by exact narrative_id returns the matching narrative."""
    resp = client.get("/api/v1/narratives?query=narrative_000")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) >= 1
    assert any(item["narrative_id"] == "narrative_000" for item in data)


def test_list_narratives_search_partial_id(client):
    """Verify searching by numeric suffix or partial ID returns matches."""
    resp = client.get("/api/v1/narratives?query=000")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) >= 1
    assert any("000" in item["narrative_id"] for item in data)


def test_list_narratives_search_case_insensitive(client):
    """Verify search is case-insensitive."""
    resp = client.get("/api/v1/narratives?query=NARRATIVE_000")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) >= 1
    assert any(item["narrative_id"] == "narrative_000" for item in data)


def test_list_narratives_search_text(client):
    """Verify searching by textual claim or entity works."""
    # First get the first narrative's claim or name to test with
    base_resp = client.get("/api/v1/narratives?page_size=1")
    assert base_resp.status_code == 200
    items = base_resp.json()["data"]
    if items:
        narrative = items[0]
        # Test searching with the first token of narrative_name or headline_claim
        name = narrative.get("narrative_name") or narrative.get("headline_claim") or ""
        tokens = [t for t in name.replace("–", " ").replace("-", " ").split() if len(t) > 3]
        if tokens:
            search_term = tokens[0].lower()
            resp = client.get(f"/api/v1/narratives?query={search_term}")
            assert resp.status_code == 200
            data = resp.json()["data"]
            assert len(data) >= 1


def test_narrative_sentiment_bucket_size(client):
    """Verify GET /api/v1/narratives/{id}/sentiment supports bucket_size query param."""
    resp = client.get("/api/v1/narratives/narrative_000/sentiment?bucket_size=1h")
    assert resp.status_code == 200
    body = resp.json()
    assert "data" in body
    data = body["data"]
    assert data["bucket_size"] == "1h"
    assert "time_series" in data
    assert "summary" in data


def test_temporal_lineage_by_narrative(client):
    """Verify GET /api/v1/temporal/narratives/by-narrative/{narrative_id} resolves real lineage."""
    resp = client.get("/api/v1/temporal/narratives/by-narrative/narrative_000")
    assert resp.status_code == 200
    body = resp.json()
    assert "lineage" in body
    assert body["lineage"]["lineage_id"] is not None
    assert body["lineage"]["current_narrative_id"] == "narrative_000"
    assert "events" in body
