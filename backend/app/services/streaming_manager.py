"""WebSocket Connection and PubSub Manager for Real-Time Telegram Streaming.

Maintains active client connections, buffers recent telemetry events, and
broadcasts incoming messages, live alerts, and heartbeat telemetry.
"""

from collections import deque
from datetime import datetime, timezone
import logging
from typing import Any
from fastapi import WebSocket

logger = logging.getLogger("traject.services.streaming_manager")


class StreamingManager:
    """Thread-safe WebSocket PubSub Hub with event buffering."""

    def __init__(self, buffer_size: int = 50) -> None:
        self.active_connections: set[WebSocket] = set()
        self.event_buffer: deque[dict[str, Any]] = deque(maxlen=buffer_size)

    async def connect(self, websocket: WebSocket) -> None:
        """Register a new WebSocket connection."""
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(
            "WebSocket client connected. Total active connections: %d",
            len(self.active_connections),
        )

    def disconnect(self, websocket: WebSocket) -> None:
        """Unregister a disconnected WebSocket client."""
        self.active_connections.discard(websocket)
        logger.info(
            "WebSocket client disconnected. Total active connections: %d",
            len(self.active_connections),
        )

    def get_recent_history(self) -> list[dict[str, Any]]:
        """Return buffered recent streaming events."""
        return list(self.event_buffer)

    async def broadcast(self, event_type: str, data: dict[str, Any]) -> None:
        """Broadcast a strongly-typed JSON event to all connected clients."""
        event_payload = {
            "type": event_type,
            "data": data,
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        }

        # Store in circular buffer for newly connecting clients
        self.event_buffer.append(event_payload)

        if not self.active_connections:
            return

        dead_connections: list[WebSocket] = []
        for connection in list(self.active_connections):
            try:
                await connection.send_json(event_payload)
            except Exception as exc:
                logger.debug("Failed sending WebSocket message to client: %s", exc)
                dead_connections.append(connection)

        for dead_conn in dead_connections:
            self.disconnect(dead_conn)


# Global singleton instance
streaming_manager = StreamingManager()


def get_streaming_manager() -> StreamingManager:
    """Dependency helper to access the global StreamingManager."""
    return streaming_manager
