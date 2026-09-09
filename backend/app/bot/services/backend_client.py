"""Asynchronous HTTP client interface communicating with TRAJECT FastAPI backend."""

import json
import logging
from typing import Any

import httpx

from app.bot.config import BotSettings, get_bot_settings

logger = logging.getLogger("traject.bot.backend_client")


class BackendClient:
    """Provides typed, non-blocking HTTP operations against TRAJECT REST API endpoints."""

    def __init__(self, settings: BotSettings | None = None) -> None:
        self.settings = settings or get_bot_settings()
        self.base_url = self.settings.backend_api_base_url
        self._timeout = httpx.Timeout(15.0, connect=5.0)

    async def get_health(self) -> dict[str, Any]:
        """Query /health endpoint."""
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.get(f"{self.base_url}/health")
            resp.raise_for_status()
            return resp.json()

    async def get_analytics_overview(self) -> dict[str, Any]:
        """Query /analytics for high-level platform KPIs."""
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.get(f"{self.base_url}/analytics")
            resp.raise_for_status()
            return resp.json()

    async def get_narratives(
        self,
        priority_tier: str | None = None,
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        """Query /narratives for top prioritized narrative candidates."""
        params: dict[str, Any] = {"page": 1, "page_size": limit, "sort_by": "priority_signal_score", "order": "desc"}
        if priority_tier:
            params["priority_tier"] = priority_tier.lower()

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.get(f"{self.base_url}/narratives", params=params)
            resp.raise_for_status()
            data = resp.json()
            return data.get("data", [])

    async def get_emerging_trends(
        self,
        horizon_hours: int = 24,
        limit: int = 5,
    ) -> dict[str, Any]:
        """Query /forecasting/emerging-trends for predicted future emerging topics."""
        params = {"horizon_hours": horizon_hours, "limit": limit}
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.get(f"{self.base_url}/forecasting/emerging-trends", params=params)
            if resp.status_code == 503:
                return {"forecasts": [], "artifact": {}, "not_generated": True}
            resp.raise_for_status()
            return resp.json()

    async def get_forecasting_status(self) -> dict[str, Any]:
        """Query /forecasting/status for forecast artifact availability and freshness."""
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.get(f"{self.base_url}/forecasting/status")
            resp.raise_for_status()
            return resp.json()

    async def search_messages(self, query: str, limit: int = 5) -> list[dict[str, Any]]:
        """Query /messages for matching social media posts."""
        params = {"query": query, "page": 1, "page_size": limit, "sort_by": "published_at", "order": "desc"}
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.get(f"{self.base_url}/messages", params=params)
            resp.raise_for_status()
            data = resp.json()
            return data.get("data", [])

    async def get_monitored_sources(self) -> list[dict[str, Any]]:
        """Load monitored source channels from telegram_sources.json."""
        config_path = self.settings.repo_root / "backend" / "config" / "telegram_sources.json"
        if not config_path.is_file():
            config_path = self.settings.repo_root / "config" / "telegram_sources.json"

        if config_path.is_file():
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                return data.get("sources", [])
            except Exception as e:
                logger.warning("Could not load sources from %s: %s", config_path, e)
        return []

    async def triage_message(
        self,
        text: str,
        author: str | None = None,
        forward_origin: str | None = None,
        views: int | None = None,
        forwards: int | None = None,
    ) -> dict[str, Any]:
        """Submit post to /messages/triage for on-demand ML forensic evaluation."""
        payload = {
            "text": text,
            "author": author,
            "forward_origin": forward_origin,
            "views": views,
            "forwards": forwards,
        }
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.post(f"{self.base_url}/messages/triage", json=payload)
            resp.raise_for_status()
            return resp.json()


_backend_client: BackendClient | None = None


def get_backend_client() -> BackendClient:
    """Retrieve global BackendClient singleton."""
    global _backend_client
    if _backend_client is None:
        _backend_client = BackendClient()
    return _backend_client
