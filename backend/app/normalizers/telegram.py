import re
from datetime import datetime, timezone
from typing import Any

from app.schemas.canonical_message import AuthorType, CanonicalMessage, Platform


class TelegramNormalizer:
    """Normalizes raw Telegram message representations into CanonicalMessage contracts.
    
    Operates on raw dictionary structures (such as serializations from Telethon,
    Pyrogram, or the Telegram Bot API) without requiring live network connections.
    """

    # Regex fallbacks for entity extraction when not provided in raw platform metadata
    URL_REGEX = re.compile(r"https?://[^\s/$.?#].[^\s]*", re.IGNORECASE)
    HASHTAG_REGEX = re.compile(r"#[\w\u0080-\uffff]+", re.UNICODE)
    MENTION_REGEX = re.compile(r"@[\w]+", re.UNICODE)

    @classmethod
    def normalize(
        cls,
        raw_payload: dict[str, Any],
        collected_at: datetime | None = None,
        raw_reference: str | None = None,
    ) -> CanonicalMessage:
        """Transform a raw Telegram payload into a validated CanonicalMessage.
        
        Args:
            raw_payload: Dictionary representing raw Telegram message structure.
            collected_at: Ingestion timestamp. Defaults to current UTC time if not provided.
            raw_reference: Traceability identifier, path, or payload hash.
        
        Returns:
            CanonicalMessage: Fully validated, platform-agnostic message contract.
        """
        if not isinstance(raw_payload, dict):
            raise TypeError(f"raw_payload must be a dict, got {type(raw_payload).__name__}")

        # 1. Native ID
        raw_id = raw_payload.get("id") or raw_payload.get("message_id")
        if raw_id is None:
            raise ValueError("Raw Telegram payload is missing 'id' or 'message_id'")
        native_id = str(raw_id).strip()

        # 2. Author / Source resolution (determines chat_id for canonical_id)
        author_id, author_username, author_type, channel_title, subscriber_count = (
            cls._extract_author_metadata(raw_payload)
        )

        canonical_id = CanonicalMessage.build_canonical_id(
            Platform.TELEGRAM, native_id, chat_id=author_id
        )

        # 3. Timestamps
        raw_date = raw_payload.get("date") or raw_payload.get("timestamp")
        published_at = cls._parse_datetime(raw_date)

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


        # 4. Text Content & Media
        text_content = raw_payload.get("message") or raw_payload.get("text") or raw_payload.get("caption") or ""
        text_content = str(text_content).strip()

        media_types = cls._extract_media_types(raw_payload)
        has_media = bool(media_types) or bool(raw_payload.get("media") or raw_payload.get("photo") or raw_payload.get("video"))

        # 5. Forwards, Reposts & Threading
        is_forward, origin_source_id = cls._extract_forward_info(raw_payload)
        reply_to_id, thread_id = cls._extract_thread_info(raw_payload)

        # 6. Engagement Metrics
        views_count = raw_payload.get("views") or raw_payload.get("views_count")
        forwards_count = raw_payload.get("forwards") or raw_payload.get("forwards_count")
        
        raw_replies = raw_payload.get("replies")
        replies_count = None
        if isinstance(raw_replies, int):
            replies_count = raw_replies
        elif isinstance(raw_replies, dict):
            replies_count = raw_replies.get("replies") or raw_replies.get("count")

        reactions = cls._extract_reactions(raw_payload.get("reactions"))

        # 7. Entities (URLs, Hashtags, Mentions)
        urls, hashtags, mentions = cls._extract_entities(raw_payload, text_content)

        # 8. Language & Traceability
        language = raw_payload.get("language") or raw_payload.get("lang_code")

        return CanonicalMessage(
            canonical_id=canonical_id,
            platform=Platform.TELEGRAM,
            native_id=native_id,
            author_id=author_id,
            author_username=author_username,
            author_type=author_type,
            channel_title=channel_title,
            subscriber_count=subscriber_count,
            published_at=published_at,
            collected_at=collected_at,
            text_content=text_content,
            language=language,
            media_types=media_types,
            has_media=has_media,
            is_forward=is_forward,
            is_repost=False,  # In Telegram, shared content is characterized as a forward
            origin_source_id=origin_source_id,
            reply_to_id=reply_to_id,
            thread_id=thread_id,
            views_count=int(views_count) if views_count is not None else None,
            forwards_count=int(forwards_count) if forwards_count is not None else None,
            replies_count=int(replies_count) if replies_count is not None else None,
            reactions=reactions,
            urls=urls,
            hashtags=hashtags,
            mentions=mentions,
            raw_reference=raw_reference or raw_payload.get("raw_reference"),
        )

    @classmethod
    def _parse_datetime(cls, val: Any) -> datetime:
        """Parse unix timestamp, ISO 8601 string, or datetime object into UTC datetime."""
        if val is None:
            raise ValueError("Missing timestamp in raw payload")
        if isinstance(val, (int, float)):
            return datetime.fromtimestamp(val, tz=timezone.utc)
        if isinstance(val, str):
            # Parse ISO formatted string
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
    def _extract_author_metadata(
        cls, raw_payload: dict[str, Any]
    ) -> tuple[str, str | None, AuthorType, str | None, int | None]:
        """Extract author and channel identifiers, type, and follower count."""
        chat = raw_payload.get("chat") or raw_payload.get("channel") or {}
        sender = raw_payload.get("from") or raw_payload.get("sender") or {}

        author_id = (
            raw_payload.get("peer_id")
            or chat.get("id")
            or sender.get("id")
            or raw_payload.get("from_id")
        )
        if author_id is None:
            raise ValueError("Unable to determine author_id or peer_id from raw payload")
        author_id_str = str(author_id)

        author_username = (
            chat.get("username")
            or sender.get("username")
            or raw_payload.get("author_username")
        )
        channel_title = (
            chat.get("title")
            or raw_payload.get("channel_title")
        )
        subscriber_count = (
            chat.get("participants_count")
            or chat.get("subscriber_count")
            or raw_payload.get("subscriber_count")
        )
        if subscriber_count is not None:
            subscriber_count = int(subscriber_count)

        # Classify author type
        raw_type = (
            chat.get("type")
            or raw_payload.get("chat_type")
            or raw_payload.get("author_type")
        )
        if raw_type:
            raw_type_str = str(raw_type).lower()
            if "channel" in raw_type_str:
                author_type = AuthorType.CHANNEL
            elif "group" in raw_type_str or "supergroup" in raw_type_str or "chat" in raw_type_str:
                author_type = AuthorType.GROUP
            elif "user" in raw_type_str or "private" in raw_type_str or "bot" in raw_type_str:
                author_type = AuthorType.USER
            else:
                author_type = AuthorType.UNKNOWN
        else:
            # If chat dictionary has title and no sender, it is commonly a broadcast channel in Telegram
            if channel_title and not sender:
                author_type = AuthorType.CHANNEL
            elif sender:
                author_type = AuthorType.USER
            else:
                author_type = AuthorType.UNKNOWN

        return author_id_str, author_username, author_type, channel_title, subscriber_count

    @classmethod
    def _extract_media_types(cls, raw_payload: dict[str, Any]) -> list[str]:
        """Detect and classify attached media types."""
        media_types: list[str] = []
        raw_media = raw_payload.get("media")

        if isinstance(raw_media, dict):
            media_type = raw_media.get("type") or raw_media.get("_")
            if media_type:
                clean_type = str(media_type).lower().replace("messagemedia", "")
                media_types.append(clean_type)
        elif isinstance(raw_media, str):
            media_types.append(raw_media.lower())

        # Check explicit flags
        if raw_payload.get("photo") and "photo" not in media_types:
            media_types.append("photo")
        if raw_payload.get("video") and "video" not in media_types:
            media_types.append("video")
        if raw_payload.get("document") and "document" not in media_types:
            media_types.append("document")

        return media_types

    @classmethod
    def _extract_forward_info(cls, raw_payload: dict[str, Any]) -> tuple[bool, str | None]:
        """Extract forward status and origin message identifier."""
        fwd = raw_payload.get("fwd_from") or raw_payload.get("forward") or raw_payload.get("forward_from")
        if not fwd:
            return False, None

        is_forward = True
        origin_source_id: str | None = None

        if isinstance(fwd, dict):
            orig_channel = fwd.get("from_id") or fwd.get("channel_id") or fwd.get("chat_id")
            orig_msg_id = fwd.get("channel_post") or fwd.get("message_id")
            if orig_channel and orig_msg_id:
                origin_source_id = f"telegram:{orig_channel}:{orig_msg_id}"
            elif orig_msg_id:
                origin_source_id = f"telegram:{orig_msg_id}"
            elif orig_channel:
                origin_source_id = f"telegram:{orig_channel}"
        elif isinstance(fwd, (str, int)):
            origin_source_id = f"telegram:{fwd}"

        return is_forward, origin_source_id

    @classmethod
    def _extract_thread_info(cls, raw_payload: dict[str, Any]) -> tuple[str | None, str | None]:
        """Extract reply and thread/topic identifiers."""
        reply_to_id: str | None = None
        thread_id: str | None = None

        reply_raw = raw_payload.get("reply_to") or raw_payload.get("reply_to_message")
        if isinstance(reply_raw, dict):
            parent_id = reply_raw.get("reply_to_msg_id") or reply_raw.get("message_id")
            if parent_id is not None:
                reply_to_id = str(parent_id)
            top_msg_id = reply_raw.get("reply_to_top_id")
            if top_msg_id is not None:
                thread_id = str(top_msg_id)
        elif reply_raw is not None:
            reply_to_id = str(reply_raw)

        raw_reply_to_msg_id = raw_payload.get("reply_to_msg_id")
        if raw_reply_to_msg_id is not None and reply_to_id is None:
            reply_to_id = str(raw_reply_to_msg_id)

        return reply_to_id, thread_id

    @classmethod
    def _extract_reactions(cls, raw_reactions: Any) -> dict[str, int]:
        """Normalize Telegram reaction counts into an emoji-to-count mapping."""
        reactions: dict[str, int] = {}
        if not raw_reactions:
            return reactions

        if isinstance(raw_reactions, dict):
            for k, v in raw_reactions.items():
                if isinstance(v, int) and v >= 0:
                    reactions[str(k)] = v
        elif isinstance(raw_reactions, list):
            for item in raw_reactions:
                if isinstance(item, dict):
                    emoji = item.get("emoticon") or item.get("emoji")
                    count = item.get("count", 1)
                    if emoji and isinstance(count, int) and count >= 0:
                        reactions[str(emoji)] = count

        return reactions

    @classmethod
    def _extract_entities(
        cls, raw_payload: dict[str, Any], text: str
    ) -> tuple[list[str], list[str], list[str]]:
        """Extract URLs, hashtags, and mentions from metadata or text regex."""
        urls: list[str] = []
        hashtags: list[str] = []
        mentions: list[str] = []

        raw_entities = raw_payload.get("entities")
        if isinstance(raw_entities, list):
            for ent in raw_entities:
                if isinstance(ent, dict):
                    ent_type = ent.get("type") or ent.get("_")
                    if not ent_type:
                        continue
                    ent_type_str = str(ent_type).lower()
                    if "url" in ent_type_str:
                        if "url" in ent:
                            urls.append(ent["url"])
                    elif "hashtag" in ent_type_str and "text" in ent:
                        hashtags.append(ent["text"])
                    elif "mention" in ent_type_str and "text" in ent:
                        mentions.append(ent["text"])

        # Complement with regex if empty or incomplete
        if not urls and text:
            urls = cls.URL_REGEX.findall(text)
        if not hashtags and text:
            hashtags = cls.HASHTAG_REGEX.findall(text)
        if not mentions and text:
            mentions = cls.MENTION_REGEX.findall(text)

        # Deduplicate while preserving order
        urls = list(dict.fromkeys(urls))
        hashtags = list(dict.fromkeys(hashtags))
        mentions = list(dict.fromkeys(mentions))

        return urls, hashtags, mentions
