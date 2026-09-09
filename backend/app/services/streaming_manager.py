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
    """Thread-safe WebSocket PubSub Hub with event buffering and role segregation."""

    def __init__(self, buffer_size: int = 50) -> None:
        self.active_connections: set[WebSocket] = set()
        self.connection_roles: dict[WebSocket, str] = {}
        self.event_buffer: deque[dict[str, Any]] = deque(maxlen=buffer_size)

    async def connect(self, websocket: WebSocket, role: str = "public_user") -> None:
        """Register a new WebSocket connection with associated authorization role."""
        await websocket.accept()
        self.active_connections.add(websocket)
        self.connection_roles[websocket] = role
        logger.info(
            "WebSocket client connected with role '%s'. Total active connections: %d",
            role,
            len(self.active_connections),
        )

    def disconnect(self, websocket: WebSocket) -> None:
        """Unregister a disconnected WebSocket client."""
        self.active_connections.discard(websocket)
        self.connection_roles.pop(websocket, None)
        logger.info(
            "WebSocket client disconnected. Total active connections: %d",
            len(self.active_connections),
        )

    def get_recent_history(self, role: str = "public_user") -> list[dict[str, Any]]:
        """Return buffered recent streaming events filtered by audience role."""
        if role == "ntro_analyst":
            return list(self.event_buffer)
        # For public clients, filter out sensitive alerts or internal message broadcasts
        return [
            e for e in self.event_buffer
            if e.get("type") not in ("alert_triggered", "message_ingested")
        ]

    async def broadcast(
        self,
        event_type: str,
        data: dict[str, Any],
        ntro_only: bool = False,
    ) -> None:
        """Broadcast a strongly-typed JSON event with optional NTRO clearance enforcement."""
        event_payload = {
            "type": event_type,
            "data": data,
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        }

        # Store in circular buffer
        self.event_buffer.append(event_payload)

        if not self.active_connections:
            return

        dead_connections: list[WebSocket] = []
        for connection in list(self.active_connections):
            # Check if this connection has clearance for NTRO-only broadcasts
            client_role = self.connection_roles.get(connection, "public_user")
            if ntro_only and client_role != "ntro_analyst":
                continue

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
