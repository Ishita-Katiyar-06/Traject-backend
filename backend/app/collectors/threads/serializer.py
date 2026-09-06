from datetime import datetime, timezone
from typing import Any


class ThreadsMessageSerializer:
    """Serialization layer converting Meta Threads Graph API responses
    into clean, JSON-serializable dictionaries.
    """

    @classmethod
    def serialize(
        cls,
        raw_thread: dict[str, Any],
        author_info: dict[str, Any] | None = None,
        collected_at: datetime | None = None,
    ) -> dict[str, Any]:
        """Convert a Threads Graph API post dictionary into a standard raw dictionary.
        
        Args:
            raw_thread: Raw dictionary returned from Threads /threads API.
            author_info: Optional profile metadata from /me API.
            collected_at: UTC timestamp when the record was ingested.
        """
        thread_id = raw_thread.get("id")
        if not thread_id:
            raise ValueError("Threads payload is missing 'id'")

        # 1. Publication timestamp
        raw_timestamp = raw_thread.get("timestamp")
        if not raw_timestamp:
            raise ValueError(f"Threads post '{thread_id}' is missing 'timestamp'")

        if isinstance(raw_timestamp, str):
            dt = datetime.fromisoformat(raw_timestamp)
            date_iso = dt.astimezone(timezone.utc).isoformat()
        elif isinstance(raw_timestamp, datetime):
            date_iso = raw_timestamp.astimezone(timezone.utc).isoformat()
        else:
            raise ValueError(f"Unsupported timestamp format: {raw_timestamp}")

        # 2. Author extraction
        author_username = raw_thread.get("username")
        author_id = str(raw_thread.get("owner", {}).get("id") if isinstance(raw_thread.get("owner"), dict) else "")
        if not author_id and author_info:
            author_id = str(author_info.get("id", ""))
            if not author_username:
                author_username = author_info.get("username")

        # 3. Content
        text = raw_thread.get("text") or ""

        # 4. Media
        media_type = raw_thread.get("media_type") or "TEXT_POST"
        permalink = raw_thread.get("permalink")

        # 5. Engagement metrics
        like_count = raw_thread.get("like_count")
        reply_count = raw_thread.get("reply_count")
        reposts_count = raw_thread.get("reposts_count")
        quotes_count = raw_thread.get("quotes_count")
        views = raw_thread.get("views")

        # 6. Ingestion timestamp
        if collected_at is None:
            collected_at = datetime.now(timezone.utc)
        elif collected_at.tzinfo is None:
            collected_at = collected_at.replace(tzinfo=timezone.utc)
        else:
            collected_at = collected_at.astimezone(timezone.utc)

        return {
            "id": str(thread_id),
            "text": text,
            "timestamp": date_iso,
            "username": author_username,
            "author_id": author_id or author_username or "unknown",
            "permalink": permalink,
            "media_type": media_type,
            "is_quote_post": bool(raw_thread.get("is_quote_post", False)),
            "like_count": int(like_count) if like_count is not None else None,
            "reply_count": int(reply_count) if reply_count is not None else None,
            "reposts_count": int(reposts_count) if reposts_count is not None else None,
            "quotes_count": int(quotes_count) if quotes_count is not None else None,
            "views": int(views) if views is not None else None,
            "collected_at": collected_at.isoformat(),
        }
