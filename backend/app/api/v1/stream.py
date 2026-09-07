"""FastAPI WebSocket Endpoint for Real-Time Streaming and Live Telemetry."""

from datetime import datetime, timezone
import json
import logging
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from app.api.deps import get_artifact_repository
from app.repositories.artifact_repository import ArtifactRepository
from app.services.streaming_manager import StreamingManager, get_streaming_manager

logger = logging.getLogger("traject.api.v1.stream")

router = APIRouter(tags=["Real-Time WebSocket Stream"])


@router.websocket("/ws/live")
async def websocket_live_stream(
    websocket: WebSocket,
    manager: StreamingManager = Depends(get_streaming_manager),
    repo: ArtifactRepository = Depends(get_artifact_repository),
) -> None:
    """Duplex WebSocket connection endpoint for real-time live messages and alerts."""
    await manager.connect(websocket)

    try:
        # Check channel join status if collector service is active
        channels_monitored = 0
        channels_joined = 0
        try:
            from app.services.live_collector_service import get_live_collector_service
            col = get_live_collector_service()
            if col:
                summary = col.get_channel_join_summary()
                channels_monitored = summary.get("total_sources", 0)
                channels_joined = summary.get("joined_count", 0)
        except Exception:
            pass

        # Send initial handshake with recent events buffer and current corpus state
        initial_payload = {
            "type": "connection_ack",
            "data": {
                "status": "connected",
                "active_corpus_records": len(repo._messages),
                "artifacts_loaded": repo.artifacts_loaded,
                "dataset_source": repo.dataset_source,
                "channels_monitored": channels_monitored,
                "channels_joined": channels_joined,
                "recent_history": manager.get_recent_history(),
                "server_time_utc": datetime.now(timezone.utc).isoformat(),
            },
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        }
        await websocket.send_json(initial_payload)

        while True:
            # Handle incoming client messages (e.g. heartbeat ping)
            raw_data = await websocket.receive_text()
            try:
                msg = json.loads(raw_data)
                msg_type = msg.get("type", "")

                if msg_type == "ping":
                    await websocket.send_json({
                        "type": "pong",
                        "data": {
                            "client_time": msg.get("timestamp"),
                            "server_time": datetime.now(timezone.utc).isoformat(),
                        },
                        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
                    })
            except json.JSONDecodeError:
                if raw_data.strip() == "ping":
                    await websocket.send_json({
                        "type": "pong",
                        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
                    })
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("Client cleanly disconnected from /ws/live.")
    except Exception as exc:
        manager.disconnect(websocket)
        logger.warning("Error in /ws/live stream: %s", exc)


@router.post("/stream/simulate", summary="Simulate a real-time live Telegram event or alert")
async def simulate_event(
    event_type: str = "alert",
    manager: StreamingManager = Depends(get_streaming_manager),
    repo: ArtifactRepository = Depends(get_artifact_repository),
) -> dict:
    """Manually dispatch a real-time live message or alert over the WebSocket stream."""
    now_iso = datetime.now(timezone.utc).isoformat()
    if event_type == "alert":
        alert_payload = {
            "id": f"alt-sim-{int(datetime.now(timezone.utc).timestamp())}",
            "narrative_id": "sim_narrative_live",
            "topic_id": "topic_sim",
            "title": "Real-Time Rapid Syndication Burst",
            "claim": "Observed rapid multi-channel coordinated forward burst across defense monitoring channels.",
            "severity": "critical",
            "category": "coordination_anomaly",
            "status": "open",
            "priority_score": 0.842,
            "message_count": 42,
            "indicators": ["Synchronous burst in <60s", "Cross-channel forward cascade", "Domain: conflict"],
            "domains": ["conflict", "geopolitics"],
            "detected_at": now_iso,
        }
        await manager.broadcast("alert_triggered", alert_payload)
        return {"status": "broadcast_sent", "event": "alert_triggered", "payload": alert_payload}
    else:
        msg_payload = {
            "message_id": f"msg-sim-{int(datetime.now(timezone.utc).timestamp())}",
            "native_id": 999999,
            "channel_title": "War Monitor (Live)",
            "channel_username": "warmonitors",
            "text": "Live transmission test: Tactical developments reported along northern sector.",
            "text_preview": "Live transmission test: Tactical developments reported along northern sector.",
            "timestamp": now_iso,
            "views": 15420,
            "forwards": 84,
            "has_media": False,
            "total_corpus_count": len(repo._messages) + 1,
        }
        await manager.broadcast("message_ingested", msg_payload)
        return {"status": "broadcast_sent", "event": "message_ingested", "payload": msg_payload}


@router.get(
    "/stream/channels",
    summary="Retrieve live Telegram channel join and monitoring status",
    tags=["Real-Time WebSocket Stream"],
)
async def get_stream_channels() -> dict:
    """Returns real-time status of all monitored channels and background auto-join progress."""
    try:
        from app.services.live_collector_service import get_live_collector_service
        collector = get_live_collector_service()
        if not collector:
            return {"total_sources": 0, "joined_count": 0, "channels": {}}
        return collector.get_channel_join_summary()
    except Exception as exc:
        logger.warning("Error fetching stream channels summary: %s", exc)
        return {"total_sources": 0, "joined_count": 0, "channels": {}, "error": str(exc)}

