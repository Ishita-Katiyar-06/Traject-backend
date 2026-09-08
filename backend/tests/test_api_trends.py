import pytest


def test_list_trends_default(client):
    """Verify GET /api/v1/trends returns paginated list of trends mapped from cluster discovery."""
    resp = client.get("/api/v1/trends")
    assert resp.status_code == 200
    body = resp.json()

    assert "data" in body
    assert "meta" in body
    data = body["data"]

    assert len(data) == 3
    for trend in data:
        assert trend["trend_id"].startswith("trend_")
        assert trend["topic_id"].startswith("topic_")
        assert trend["message_count"] > 0
        assert "label" in trend
        assert "representative_keywords" in trend
        assert len(trend["representative_keywords"]) > 0
        assert all("keyword" in k and "score" in k for k in trend["representative_keywords"])


def test_get_trend_by_id_success(client):
    """Verify GET /api/v1/trends/{id} returns trend dossier with channels and features."""
    resp = client.get("/api/v1/trends/trend_000")
    assert resp.status_code == 200
    body = resp.json()

    assert "data" in body
    t = body["data"]
    assert t["trend_id"] == "trend_000"
    assert t["topic_id"] == "topic_000"
    assert t["cluster_label"] == 0
    assert len(t["representative_keywords"]) > 0
    assert len(t["representative_message_ids"]) > 0
    assert "channels" in t
    assert isinstance(t["channels"], list)
    assert len(t["channels"]) > 0
    assert all("channel_id" in c and "message_count" in c for c in t["channels"])


def test_get_trend_by_topic_id_alias(client):
    """Verify GET /api/v1/trends/{id} accepts topic_XXX identifiers interchangeably."""
    resp = client.get("/api/v1/trends/topic_000")
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["trend_id"] == "trend_000"
    assert body["data"]["topic_id"] == "topic_000"


def test_get_trend_by_id_not_found(client):
    """Verify GET /api/v1/trends/{id} returns 404 for unknown trend ID."""
    resp = client.get("/api/v1/trends/trend_999")
    assert resp.status_code == 404
    body = resp.json()
    assert "error" in body
    assert body["error"]["code"] == "RESOURCE_NOT_FOUND"


def test_get_trend_graph_converging_topology(client):
    """Verify GET /api/v1/trends/{id}/graph returns converging node graph from real data."""
    resp = client.get("/api/v1/trends/trend_000/graph")
    assert resp.status_code == 200
    body = resp.json()

    assert "data" in body
    g = body["data"]
    assert g["trend_id"] == "trend_000"
    assert "nodes" in g
    assert "edges" in g

    # Central trend node must exist
    trend_nodes = [n for n in g["nodes"] if n["type"] == "trend"]
    assert len(trend_nodes) == 1
    assert trend_nodes[0]["id"] == "trend:trend_000"

    # Channel nodes must exist and have converging observed_in edges to trend
    channel_nodes = [n for n in g["nodes"] if n["type"] == "channel"]
    assert len(channel_nodes) > 0

    observed_edges = [e for e in g["edges"] if e["relationship_type"] == "observed_in"]
    assert len(observed_edges) == len(channel_nodes)
    for edge in observed_edges:
        assert edge["target"] == "trend:trend_000"
        assert edge["source"].startswith("channel:")

    # Edges and nodes counts must match
    assert g["node_count"] == len(g["nodes"])
    assert g["edge_count"] == len(g["edges"])


def test_get_topic_graph_alias(client):
    """Verify GET /api/v1/topics/{id}/graph alias returns identical graph structure."""
    resp = client.get("/api/v1/topics/topic_000/graph")
    assert resp.status_code == 200
    body = resp.json()
    assert "data" in body
    assert body["data"]["trend_id"] == "trend_000"
    assert len(body["data"]["nodes"]) > 0


def test_get_trend_sentiment_time_series(client):
    """Verify GET /api/v1/trends/{id}/sentiment returns discrete temporal buckets and summary."""
    resp = client.get("/api/v1/trends/trend_000/sentiment")
    assert resp.status_code == 200
    body = resp.json()

    assert "data" in body
    s = body["data"]
    assert s["trend_id"] == "trend_000"
    assert "bucket_size" in s
    assert "time_series" in s
    assert "summary" in s

    summary = s["summary"]
    assert summary["total_messages"] > 0
    assert summary["total_messages"] == summary["evaluated_messages"] + summary["unassigned_messages"]

    # If time_series has buckets, assert schema integrity
    if len(s["time_series"]) > 0:
        for b in s["time_series"]:
            assert "bucket_start_utc" in b
            assert "bucket_end_utc" in b
            assert b["total"] == b["positive"] + b["neutral"] + b["negative"] + b["unassigned"]


def test_get_topic_sentiment_alias(client):
    """Verify GET /api/v1/topics/{id}/sentiment alias functions identically."""
    resp = client.get("/api/v1/topics/topic_000/sentiment")
    assert resp.status_code == 200
    body = resp.json()
    assert "data" in body
    assert body["data"]["trend_id"] == "trend_000"


def test_get_narrative_sentiment_time_series(client):
    """Verify GET /api/v1/narratives/{id}/sentiment returns sentiment progression for narrative messages."""
    resp = client.get("/api/v1/narratives/narrative_000/sentiment")
    assert resp.status_code == 200
    body = resp.json()

    assert "data" in body
    ns = body["data"]
    assert ns["narrative_id"] == "narrative_000"
    assert "promoted_from_trend_id" in ns
    assert "time_series" in ns
    assert "summary" in ns
    assert ns["summary"]["total_messages"] >= 0


def test_get_narrative_sentiment_not_found(client):
    """Verify GET /api/v1/narratives/{id}/sentiment returns 404 for unknown narrative."""
    resp = client.get("/api/v1/narratives/narrative_999/sentiment")
    assert resp.status_code == 404
