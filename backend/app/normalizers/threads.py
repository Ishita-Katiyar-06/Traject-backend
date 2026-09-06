import re
from datetime import datetime, timezone
from typing import Any

from app.schemas.canonical_message import AuthorType, CanonicalMessage, Platform


class ThreadsNormalizer:
    """Normalizes raw Meta Threads post representations into CanonicalMessage contracts."""

    URL_REGEX = re.compile(r"https?://[^\s/$.?#].[^\s]*", re.IGNORECASE)
    HASHTAG_REGEX = re.compile(r"#[\w\u0080-\uffff]+", re.UNICODE)
    MENTION_REGEX = re.compile(r"@([\w.]+)", re.UNICODE)

    @classmethod
    def normalize(
        cls,
        raw_payload: dict[str, Any],
        collected_at: datetime | None = None,
        raw_reference: str | None = None,
    ) -> CanonicalMessage:
        """Transform a raw Threads payload into a validated CanonicalMessage.
        
        Args:
            raw_payload: Dictionary representing raw Threads post structure.
            collected_at: Ingestion timestamp.
            raw_reference: Traceability identifier or file pointer.
        """
        if not isinstance(raw_payload, dict):
            raise TypeError(f"raw_payload must be a dict, got {type(raw_payload).__name__}")

        # 1. Native ID
        raw_id = raw_payload.get("id")
        if raw_id is None:
            raise ValueError("Raw Threads payload is missing 'id'")
        native_id = str(raw_id).strip()

        # 2. Canonical ID
        canonical_id = CanonicalMessage.build_canonical_id(Platform.THREADS, native_id)

        # 3. Author Metadata
        author_id = str(raw_payload.get("author_id") or raw_payload.get("username") or "unknown").strip()
        author_username = raw_payload.get("username")
        author_type = AuthorType.USER

        # 4. Timestamps
        raw_timestamp = raw_payload.get("timestamp") or raw_payload.get("created_at")
        published_at = cls._parse_datetime(raw_timestamp)

        if collected_at is None:
            raw_collected = raw_payload.get("collected_at")
            if raw_collected:
                collected_at = cls._parse_datetime(raw_collected)
            else:
                collected_at = datetime.now(timezone.utc)
        else:
            if collected_at.tzinfo is None:
                raise ValueError("collected_at must be timezone-aware (UTC)")
            collected_at = collected_at.astimezone(timezone.utc)

        # 5. Text Content
        text_content = str(raw_payload.get("text") or raw_payload.get("content") or "").strip()

        # 6. Media extraction
        media_type_raw = str(raw_payload.get("media_type") or "").upper()
        media_types = []
        if "IMAGE" in media_type_raw:
            media_types.append("photo")
        if "VIDEO" in media_type_raw:
            media_types.append("video")
        if "CAROUSEL" in media_type_raw:
            media_types.extend(["photo", "video"])
        media_types = sorted(list(set(media_types)))
        has_media = bool(media_types)

        # 7. Engagement metrics
        like_count = raw_payload.get("like_count")
        reply_count = raw_payload.get("reply_count")
        reposts_count = raw_payload.get("reposts_count") or 0
        quotes_count = raw_payload.get("quotes_count") or 0
        total_forwards = int(reposts_count) + int(quotes_count) if (raw_payload.get("reposts_count") is not None or raw_payload.get("quotes_count") is not None) else None
        views_count = raw_payload.get("views")

        reactions = {}
        if like_count is not None:
            reactions["likes"] = max(0, int(like_count))

        # 8. Entity extraction
        urls, hashtags, mentions = cls._extract_entities(raw_payload, text_content)

        return CanonicalMessage(
            canonical_id=canonical_id,
            platform=Platform.THREADS,
            native_id=native_id,
            author_id=author_id,
            author_username=author_username,
            author_type=author_type,
            channel_title=None,
            subscriber_count=None,
            published_at=published_at,
            collected_at=collected_at,
            text_content=text_content,
            language=None,
            media_types=media_types,
            has_media=has_media,
            is_forward=bool(raw_payload.get("is_quote_post", False)),
            is_repost=False,
            origin_source_id=None,
            reply_to_id=None,
            thread_id=None,
            views_count=int(views_count) if views_count is not None else None,
            forwards_count=total_forwards,
            replies_count=int(reply_count) if reply_count is not None else None,
            reactions=reactions,
            urls=urls,
            hashtags=hashtags,
            mentions=mentions,
            raw_reference=raw_reference or raw_payload.get("raw_reference"),
        )

    @classmethod
    def _parse_datetime(cls, val: Any) -> datetime:
        if val is None:
            raise ValueError("Missing timestamp in raw Threads payload")
        if isinstance(val, (int, float)):
            return datetime.fromtimestamp(val, tz=timezone.utc)
        if isinstance(val, str):
            dt = datetime.fromisoformat(val)
            if dt.tzinfo is None:
                raise ValueError(f"Naive datetime string not allowed: '{val}'")
            return dt.astimezone(timezone.utc)
        if isinstance(val, datetime):
            if val.tzinfo is None:
                raise ValueError(f"Naive datetime object not allowed: '{val}'")
            return val.astimezone(timezone.utc)
        raise ValueError(f"Unsupported datetime format: {type(val).__name__}")

    @classmethod
    def _extract_entities(
        cls,
        raw: dict[str, Any],
        text: str,
    ) -> tuple[list[str], list[str], list[str]]:
        urls: set[str] = set()
        hashtags: set[str] = set()
        mentions: set[str] = set()

        if text:
            for match in cls.URL_REGEX.finditer(text):
                urls.add(match.group(0).rstrip(".,;!?)>"))
            for match in cls.HASHTAG_REGEX.finditer(text):
                tag = match.group(0).lstrip("#").lower()
                if tag:
                    hashtags.add(tag)
            for match in cls.MENTION_REGEX.finditer(text):
                m = match.group(1)
                if m:
                    mentions.add(m)

        if raw.get("permalink"):
            urls.add(raw["permalink"])

        return sorted(list(urls)), sorted(list(hashtags)), sorted(list(mentions))
