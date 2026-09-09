def test_list_messages_default(client):
    """Verify GET /api/v1/messages returns paginated canonical messages feed."""
    resp = client.get("/api/v1/messages")
    assert resp.status_code == 200
    body = resp.json()

    assert "data" in body
    assert "meta" in body
    data = body["data"]

    assert len(data) == 16
    assert body["meta"]["total"] == 16

    first_msg = data[0]
    assert "canonical_id" in first_msg
    assert "platform" in first_msg
    assert "published_at" in first_msg
    assert "text_content" in first_msg


def test_list_messages_filtering_by_topic(client):
    """Verify filtering messages by assigned topic cluster ID."""
    resp = client.get("/api/v1/messages?topic_id=topic_000")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) > 0


def test_get_message_by_canonical_id_success(client):
    """Verify GET /api/v1/messages/{id} resolves Telegram chat-scoped identifier."""
    # First get an existing ID from list
    list_resp = client.get("/api/v1/messages?page_size=1")
    target_id = list_resp.json()["data"][0]["canonical_id"]

    resp = client.get(f"/api/v1/messages/{target_id}")
    assert resp.status_code == 200
    body = resp.json()

    assert "data" in body
    msg = body["data"]
    assert msg["canonical_id"] == target_id
    assert "platform" in msg
    assert "author_id" in msg
    assert "text_content" in msg


def test_get_message_by_encoded_canonical_id(client):
    """Verify GET /api/v1/messages/{id} resolves percent-encoded URL identifier."""
    list_resp = client.get("/api/v1/messages?page_size=1")
    target_id = list_resp.json()["data"][0]["canonical_id"]

    encoded_id = target_id.replace(":", "%3A")
    resp = client.get(f"/api/v1/messages/{encoded_id}")
    assert resp.status_code == 200
    assert resp.json()["data"]["canonical_id"] == target_id


def test_get_message_by_id_not_found(client):
    """Verify GET /api/v1/messages/{id} returns 404 for unknown message ID."""
    resp = client.get("/api/v1/messages/telegram:unknown_chat:999999")
    assert resp.status_code == 404
    body = resp.json()
    assert "error" in body
    assert body["error"]["code"] == "RESOURCE_NOT_FOUND"


def test_post_message_triage(client):
    """Verify POST /api/v1/messages/triage performs forensic evaluation and returns typed report."""
    payload = {
        "text": "Breaking: Massive drone attack reported near major power substation. Severe casualties and damage.",
        "author": "intel_wire",
        "forward_origin": "warmonitors",
        "views": 15000,
        "forwards": 45,
    }
    resp = client.post("/api/v1/messages/triage", json=payload)
    assert resp.status_code == 200
    report = resp.json()

    assert "processed_text" in report
    assert "detected_language" in report
    assert "sentiment_label" in report
    assert report["sentiment_label"] == "NEGATIVE"
    assert "estimated_priority_tier" in report
    assert report["estimated_priority_tier"] in ("CRITICAL", "HIGH", "ELEVATED", "ROUTINE")
    assert "estimated_priority_score" in report
    assert 0.0 <= report["estimated_priority_score"] <= 1.0
    assert "indicators" in report
    assert len(report["indicators"]) > 0


def test_post_message_triage_validation_error(client):
    """Verify POST /api/v1/messages/triage rejects empty or invalid payload."""
    resp = client.post("/api/v1/messages/triage", json={"text": ""})
    assert resp.status_code == 400

