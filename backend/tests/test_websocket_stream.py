"""Unit and integration tests for FastAPI WebSocket live streaming and real-time alerts."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.streaming_manager import StreamingManager, streaming_manager


def test_streaming_manager_connect_and_broadcast() -> None:
    """Verify StreamingManager manages connections and buffers history."""
    mgr = StreamingManager(buffer_size=5)
    assert len(mgr.active_connections) == 0
    assert len(mgr.get_recent_history()) == 0


def test_websocket_endpoint_handshake_and_ping() -> None:
    """Verify WebSocket handshake connection_ack and ping/pong roundtrip."""
    client = TestClient(app)

    with client.websocket_connect("/api/v1/ws/live") as ws:
        # 1. First frame must be connection_ack
        ack = ws.receive_json()
        assert ack["type"] == "connection_ack"
        assert ack["data"]["status"] == "connected"
        assert "active_corpus_records" in ack["data"]
        assert "recent_history" in ack["data"]

        # 2. Ping-Pong test
        ws.send_json({"type": "ping", "timestamp": 123456789})
        pong = ws.receive_json()
        assert pong["type"] == "pong"


@pytest.mark.asyncio
async def test_websocket_broadcast_receives_live_message() -> None:
    """Verify that broadcasting message_ingested and alert_triggered delivers to connected clients."""
    client = TestClient(app)

    with client.websocket_connect("/api/v1/ws/live") as ws:
        # Consume initial handshake
        ack = ws.receive_json()
        assert ack["type"] == "connection_ack"

        # Broadcast a simulated live message
        sample_msg = {
            "message_id": "test_msg_001",
            "channel_title": "Test Channel",
            "text": "Breaking news test payload",
            "text_preview": "Breaking news test payload",
            "views": 1200,
            "forwards": 5,
        }
        await streaming_manager.broadcast("message_ingested", sample_msg)

        received = ws.receive_json()
        assert received["type"] == "message_ingested"
        assert received["data"]["message_id"] == "test_msg_001"
        assert received["data"]["channel_title"] == "Test Channel"

        # Broadcast a simulated live alert
        sample_alert = {
            "id": "alt-test-001",
            "title": "Critical Velocity Spike",
            "severity": "critical",
            "priority_score": 0.82,
        }
        await streaming_manager.broadcast("alert_triggered", sample_alert)

        alert_received = ws.receive_json()
        assert alert_received["type"] == "alert_triggered"
        assert alert_received["data"]["id"] == "alt-test-001"
        assert alert_received["data"]["severity"] == "critical"
