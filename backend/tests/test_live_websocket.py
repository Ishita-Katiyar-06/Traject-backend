import asyncio
import json
import logging
import httpx
import pytest
from websockets.asyncio.client import connect

logger = logging.getLogger("traject.tests.websocket")

@pytest.mark.asyncio
async def test_websocket_live_stream_duplex():
    """Verify live WebSocket endpoint connects, handshakes, ping-pongs, and receives live events."""
    uri = "ws://127.0.0.1:8000/api/v1/ws/live"
    
    async with connect(uri) as ws:
        # 1. Verify Connection Ack Handshake
        raw_handshake = await asyncio.wait_for(ws.recv(), timeout=5.0)
        handshake = json.loads(raw_handshake)
        assert handshake.get("type") == "connection_ack"
        data = handshake.get("data", {})
        assert data.get("status") == "connected"
        assert "active_corpus_records" in data
        assert "server_time_utc" in data
        
        # 2. Verify Heartbeat Ping-Pong
        ping_payload = {"type": "ping", "timestamp": 1725790000}
        await ws.send(json.dumps(ping_payload))
        raw_pong = await asyncio.wait_for(ws.recv(), timeout=5.0)
        pong = json.loads(raw_pong)
        assert pong.get("type") == "pong"
        assert pong.get("data", {}).get("client_time") == 1725790000
        
        # 3. Trigger Live Stream Simulation via HTTP and verify WebSocket receives push
        async with httpx.AsyncClient() as client:
            sim_resp = await client.post("http://127.0.0.1:8000/api/v1/stream/simulate?event_type=alert")
            assert sim_resp.status_code == 200
            
        raw_event = await asyncio.wait_for(ws.recv(), timeout=5.0)
        event = json.loads(raw_event)
        assert event.get("type") == "alert_triggered"
        assert "data" in event
        
        # Clean exit
