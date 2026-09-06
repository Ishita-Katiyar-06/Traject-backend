import asyncio
import logging
import os
from dataclasses import dataclass
from typing import Any

import httpx

logger = logging.getLogger("traject.collectors.discord")

DISCORD_API_BASE = "https://discord.com/api/v10"


@dataclass
class DiscordCredentials:
    """Credentials container for Discord Bot access."""
    bot_token: str

    @classmethod
    def from_env(cls) -> "DiscordCredentials":
        """Load Discord bot credentials from environment variables."""
        token = os.environ.get("DISCORD_BOT_TOKEN")
        if not token:
            raise ValueError(
                "DISCORD_BOT_TOKEN environment variable is not set. "
                "Please configure DISCORD_BOT_TOKEN in your .env file."
            )
        return cls(bot_token=token.strip())


class DiscordClient:
    """Lightweight HTTP client for Discord v10 REST API."""

    def __init__(
        self,
        credentials: DiscordCredentials | None = None,
        timeout: float = 15.0,
    ):
        self.credentials = credentials or DiscordCredentials.from_env()
        self.timeout = timeout
        self._headers = {
            "Authorization": f"Bot {self.credentials.bot_token}",
            "User-Agent": "TrajectNarrativeIntelligence/0.1.0",
            "Accept": "application/json",
        }

    async def get_bot_guilds(self) -> list[dict[str, Any]]:
        """Fetch all servers (guilds) the bot has joined."""
        url = f"{DISCORD_API_BASE}/users/@me/guilds"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await self._send_request(client, "GET", url)
            data = resp.json()
            return data if isinstance(data, list) else []

    async def get_guild_channels(self, guild_id: str | int) -> list[dict[str, Any]]:
        """Fetch all channels in a given server/guild."""
        url = f"{DISCORD_API_BASE}/guilds/{guild_id}/channels"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await self._send_request(client, "GET", url)
            data = resp.json()
            return data if isinstance(data, list) else []

    async def get_channel_info(self, channel_id: str | int) -> dict[str, Any]:
        """Fetch metadata for a given Discord channel."""
        url = f"{DISCORD_API_BASE}/channels/{channel_id}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await self._send_request(client, "GET", url)
            return resp.json()

    async def get_channel_messages(
        self,
        channel_id: str | int,
        limit: int = 50,
        before: str | None = None,
    ) -> list[dict[str, Any]]:
        """Fetch recent messages from a given Discord channel.
        
        Args:
            channel_id: Target Discord channel snowflake ID.
            limit: Maximum messages to retrieve (1 to 100 per Discord API spec).
            before: Message ID to fetch messages prior to (for pagination).
        """
        limit = max(1, min(limit, 100))
        url = f"{DISCORD_API_BASE}/channels/{channel_id}/messages"
        params: dict[str, Any] = {"limit": limit}
        if before:
            params["before"] = before

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await self._send_request(client, "GET", url, params=params)
            data = resp.json()
            if not isinstance(data, list):
                raise ValueError(f"Expected list of messages from Discord API, got {type(data).__name__}")
            return data

    async def _send_request(
        self,
        client: httpx.AsyncClient,
        method: str,
        url: str,
        params: dict[str, Any] | None = None,
        max_retries: int = 3,
    ) -> httpx.Response:
        """Send HTTP request with automatic Discord rate-limit (429) backoff."""
        for attempt in range(max_retries):
            resp = await client.request(method, url, headers=self._headers, params=params)
            
            if resp.status_code == 429:
                retry_after = resp.json().get("retry_after", 1.0)
                logger.warning(
                    "Discord rate limit (429) hit on %s. Backing off for %.2fs (attempt %d/%d)",
                    url, retry_after, attempt + 1, max_retries
                )
                await asyncio.sleep(float(retry_after))
                continue

            if resp.status_code == 401:
                raise PermissionError(
                    "Discord API 401 Unauthorized: Invalid DISCORD_BOT_TOKEN. "
                    "Please check your Bot Token in the Discord Developer Portal."
                )

            if resp.status_code == 403:
                raise PermissionError(
                    f"Discord API 403 Forbidden on {url}: The bot does not have permission "
                    f"to view this channel or read message history."
                )

            if resp.status_code == 404:
                raise FileNotFoundError(
                    f"Discord API 404 Not Found on {url}: Target channel ID was not found "
                    f"or the bot is not in the server."
                )

            resp.raise_for_status()
            return resp

        raise TimeoutError(f"Exceeded {max_retries} retries on Discord API request to {url}")
