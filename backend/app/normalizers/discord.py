import re
from datetime import datetime, timezone
from typing import Any

from app.schemas.canonical_message import AuthorType, CanonicalMessage, Platform


class DiscordNormalizer:
    """Normalizes raw Discord message representations into CanonicalMessage contracts.
    
    Operates on raw dictionary structures without requiring live network connections.
    """

    URL_REGEX = re.compile(r"https?://[^\s/$.?#].[^\s]*", re.IGNORECASE)
    HASHTAG_REGEX = re.compile(r"#[\w\u0080-\uffff]+", re.UNICODE)
    MENTION_REGEX = re.compile(r"<@!?(\d+)>|@([\w]+)", re.UNICODE)

    @classmethod
    def normalize(
        cls,
        raw_payload: dict[str, Any],
        collected_at: datetime | None = None,
        raw_reference: str | None = None,
    ) -> CanonicalMessage:
        """Transform a raw Discord payload into a validated CanonicalMessage.
        
        Args:
            raw_payload: Dictionary representing raw Discord message structure.
            collected_at: Ingestion timestamp. Defaults to current UTC time if not provided.
            raw_reference: Traceability identifier, path, or payload reference.
        
        Returns:
            CanonicalMessage: Fully validated, platform-agnostic message contract.
        """
        if not isinstance(raw_payload, dict):
            raise TypeError(f"raw_payload must be a dict, got {type(raw_payload).__name__}")

        # 1. Native ID
        raw_id = raw_payload.get("id") or raw_payload.get("message_id")
        if raw_id is None:
            raise ValueError("Raw Discord payload is missing 'id'")
        native_id = str(raw_id).strip()

        # 2. Canonical ID
        canonical_id = CanonicalMessage.build_canonical_id(Platform.DISCORD, native_id)

        # 3. Author Metadata
        author_raw = raw_payload.get("author") or {}
        if isinstance(author_raw, dict):
            author_id = str(author_raw.get("id", "unknown")).strip()
            author_username = author_raw.get("global_name") or author_raw.get("username")
            is_bot = bool(author_raw.get("bot", False))
        else:
            author_id = str(author_raw).strip()
            author_username = None
            is_bot = False

        author_type = AuthorType.USER

        # 4. Channel Metadata
        channel_title = raw_payload.get("channel_name")
        if channel_title:
            channel_title = f"#{channel_title.lstrip('#')}"

        # 5. Timestamps
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

        # 6. Text Content & Embeds Synthesis
        text_content = raw_payload.get("content") or ""
        embed_texts = []
        for emb in raw_payload.get("embeds", []):
            if isinstance(emb, dict):
                title = emb.get("title")
                desc = emb.get("description")
                if title:
                    embed_texts.append(str(title))
                if desc:
                    embed_texts.append(str(desc))

        if embed_texts:
            if text_content:
                text_content = f"{text_content}\n" + "\n".join(embed_texts)
            else:
                text_content = "\n".join(embed_texts)

        text_content = text_content.strip()

        # 7. Media & Attachments
        media_types = cls._extract_media_types(raw_payload)
        has_media = bool(media_types)

        # 8. Thread / Reply Reference
        reply_to_id = raw_payload.get("reply_to_id")
        if not reply_to_id and isinstance(raw_payload.get("message_reference"), dict):
            reply_to_id = raw_payload["message_reference"].get("message_id")
        reply_to_id = str(reply_to_id) if reply_to_id else None

        # 9. Reactions Extraction
        reactions = cls._extract_reactions(raw_payload.get("reactions"))

        # 10. Entity Extraction (URLs, Hashtags, Mentions)
        urls, hashtags, mentions = cls._extract_entities(raw_payload, text_content)

        return CanonicalMessage(
            canonical_id=canonical_id,
            platform=Platform.DISCORD,
            native_id=native_id,
            author_id=author_id,
            author_username=author_username,
            author_type=author_type,
            channel_title=channel_title,
            subscriber_count=None,
            published_at=published_at,
            collected_at=collected_at,
            text_content=text_content,
            language=None,
            media_types=media_types,
            has_media=has_media,
            is_forward=False,
            is_repost=False,
            origin_source_id=None,
            reply_to_id=reply_to_id,
            thread_id=None,
            views_count=None,
            forwards_count=None,
            replies_count=None,
            reactions=reactions,
            urls=urls,
            hashtags=hashtags,
            mentions=mentions,
            raw_reference=raw_reference or raw_payload.get("raw_reference"),
        )

    @classmethod
    def _parse_datetime(cls, val: Any) -> datetime:
        """Parse ISO 8601 string, timestamp, or datetime object into UTC datetime."""
        if val is None:
            raise ValueError("Missing timestamp in raw Discord payload")
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
    def _extract_media_types(cls, raw: dict[str, Any]) -> list[str]:
        """Extract media categories from attachments and embeds."""
        media_types = set()
        for att in raw.get("attachments", []):
            if isinstance(att, dict):
                ct = (att.get("content_type") or "").lower()
                fn = (att.get("filename") or "").lower()
                if ct.startswith("image/") or fn.endswith((".png", ".jpg", ".jpeg", ".webp", ".gif")):
                    media_types.add("photo")
                elif ct.startswith("video/") or fn.endswith((".mp4", ".mov", ".mkv", ".webm")):
                    media_types.add("video")
                elif ct.startswith("audio/") or fn.endswith((".mp3", ".ogg", ".wav")):
                    media_types.add("audio")
                else:
                    media_types.add("document")

        for emb in raw.get("embeds", []):
            if isinstance(emb, dict):
                etype = emb.get("type", "")
                if etype in ("image", "video", "gifv"):
                    media_types.add("photo" if etype == "image" else "video")

        return sorted(list(media_types))

    @classmethod
    def _extract_reactions(cls, reactions_data: Any) -> dict[str, int]:
        """Convert Discord reaction list or dictionary into standard emoji-to-count mapping."""
        res: dict[str, int] = {}
        if not reactions_data:
            return res

        if isinstance(reactions_data, dict):
            for k, v in reactions_data.items():
                try:
                    res[str(k)] = max(0, int(v))
                except (ValueError, TypeError):
                    continue
            return res

        if isinstance(reactions_data, list):
            for item in reactions_data:
                if isinstance(item, dict):
                    emoji = item.get("emoji")
                    name = None
                    if isinstance(emoji, dict):
                        name = emoji.get("name")
                    elif isinstance(emoji, str):
                        name = emoji
                    count = item.get("count", 1)
                    if name:
                        res[name] = max(0, int(count))

        return res

    @classmethod
    def _extract_entities(
        cls,
        raw: dict[str, Any],
        text: str,
    ) -> tuple[list[str], list[str], list[str]]:
        """Extract URLs, hashtags, and mentions from text and metadata."""
        urls: set[str] = set()
        hashtags: set[str] = set()
        mentions: set[str] = set()

        if text:
            # 1. URLs
            for match in cls.URL_REGEX.finditer(text):
                urls.add(match.group(0).rstrip(".,;!?)>"))

            # 2. Hashtags
            for match in cls.HASHTAG_REGEX.finditer(text):
                tag = match.group(0).lstrip("#").lower()
                if tag:
                    hashtags.add(tag)

            # 3. Mentions (<@123456> or @username)
            for match in cls.MENTION_REGEX.finditer(text):
                m = match.group(1) or match.group(2)
                if m:
                    mentions.add(m)

        # Extract URLs from embeds
        for emb in raw.get("embeds", []):
            if isinstance(emb, dict) and emb.get("url"):
                urls.add(emb["url"])

        return sorted(list(urls)), sorted(list(hashtags)), sorted(list(mentions))
