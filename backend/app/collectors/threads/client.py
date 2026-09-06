import asyncio
import logging
import os
from dataclasses import dataclass
from typing import Any

import httpx

logger = logging.getLogger("traject.collectors.threads")

THREADS_API_BASE = "https://graph.threads.net/v1.0"

DEFAULT_THREAD_FIELDS = (
    "id,media_type,text,permalink,timestamp,username,"
    "is_quote_post,has_replies,like_count,reply_count,reposts_count,quotes_count,views"
)


DEFAULT_SEARCH_FIELDS = (
    "id,media_type,text,permalink,timestamp,username,"
    "has_replies,is_quote_post,is_reply"
)


@dataclass
class ThreadsCredentials:
    """Credentials container for Meta Threads API."""
    access_token: str
    user_id: str | None = None

    @classmethod
    def from_env(cls) -> "ThreadsCredentials":
        """Load Threads credentials from environment variables."""
        token = os.environ.get("THREADS_ACCESS_TOKEN")
        if not token:
            raise ValueError(
                "THREADS_ACCESS_TOKEN environment variable is not set. "
                "Please configure THREADS_ACCESS_TOKEN in your .env file."
            )
        user_id = os.environ.get("THREADS_USER_ID")
        return cls(access_token=token.strip(), user_id=user_id.strip() if user_id else None)


class ThreadsClient:
    """Lightweight HTTP client for Meta Threads Graph API."""

    def __init__(
        self,
        credentials: ThreadsCredentials | None = None,
        timeout: float = 15.0,
    ):
        self.credentials = credentials or ThreadsCredentials.from_env()
        self.timeout = timeout
        self._headers = {
            "Authorization": f"Bearer {self.credentials.access_token}",
            "User-Agent": "TrajectNarrativeIntelligence/0.1.0",
            "Accept": "application/json",
        }

    async def search_threads(
        self,
        query: str,
        limit: int = 50,
        fields: str = DEFAULT_SEARCH_FIELDS,
        search_type: str = "RECENT",
    ) -> list[dict[str, Any]]:
        """Search public Threads posts matching a keyword or hashtag.
        
        Requires threads_keyword_search permission.
        """
        limit = max(1, min(limit, 100))
        url = f"{THREADS_API_BASE}/keyword_search"
        params: dict[str, Any] = {
            "q": query,
            "fields": fields,
            "search_type": search_type,
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await self._send_request(client, "GET", url, params=params)
            data = resp.json()
            if isinstance(data, dict) and "data" in data:
                return data["data"][:limit]
            if isinstance(data, list):
                return data[:limit]
            return []

    async def get_user_profile(self, user_id: str = "me") -> dict[str, Any]:
        """Fetch profile information for the authenticated or specified user."""
        url = f"{THREADS_API_BASE}/{user_id}"
        params = {"fields": "id,username,name,threads_profile_picture_url,threads_biography"}
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await self._send_request(client, "GET", url, params=params)
            return resp.json()

    async def get_user_threads(
        self,
        user_id: str = "me",
        limit: int = 50,
        before: str | None = None,
        after: str | None = None,
        fields: str = DEFAULT_THREAD_FIELDS,
    ) -> list[dict[str, Any]]:
        """Fetch posts published by the given Threads user.
        
        Args:
            user_id: Threads user ID or 'me' for authenticated account.
            limit: Maximum posts to retrieve (1 to 100).
            before: Paging cursor.
            after: Paging cursor.
            fields: Comma-separated fields to return.
        """
        limit = max(1, min(limit, 100))
        url = f"{THREADS_API_BASE}/{user_id}/threads"
        params: dict[str, Any] = {
            "fields": fields,
            "limit": limit,
        }
        if before:
            params["before"] = before
        if after:
            params["after"] = after

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await self._send_request(client, "GET", url, params=params)
            data = resp.json()
            if isinstance(data, dict) and "data" in data:
                return data["data"]
            if isinstance(data, list):
                return data
            return []

    async def _send_request(
        self,
        client: httpx.AsyncClient,
        method: str,
        url: str,
        params: dict[str, Any] | None = None,
        max_retries: int = 3,
    ) -> httpx.Response:
        """Send HTTP request with automatic rate-limit backoff."""
        for attempt in range(max_retries):
            resp = await client.request(method, url, headers=self._headers, params=params)

            if resp.status_code == 429:
                retry_after = float(resp.headers.get("Retry-After", 2.0))
                logger.warning(
                    "Threads API rate limit (429) hit on %s. Backing off for %.2fs (attempt %d/%d)",
                    url, retry_after, attempt + 1, max_retries
                )
                await asyncio.sleep(retry_after)
                continue

            if resp.status_code == 401:
                raise PermissionError(
                    "Threads API 401 Unauthorized: Invalid or expired THREADS_ACCESS_TOKEN. "
                    "Please regenerate your Access Token in Meta Developer portal."
                )

            if resp.status_code == 403:
                raise PermissionError(
                    f"Threads API 403 Forbidden on {url}: The app does not have required "
                    f"Threads permissions or the account is private."
                )

            if resp.status_code == 404:
                raise FileNotFoundError(
                    f"Threads API 404 Not Found on {url}: User or thread not found."
                )

            if resp.status_code >= 400:
                logger.error("Threads API error %d response body: %s", resp.status_code, resp.text)

            resp.raise_for_status()
            return resp

        raise TimeoutError(f"Exceeded {max_retries} retries on Threads API request to {url}")
