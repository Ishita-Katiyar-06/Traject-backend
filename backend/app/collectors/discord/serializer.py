from datetime import datetime, timezone
from typing import Any


class DiscordMessageSerializer:
    """Deliberate serialization layer converting raw Discord REST message payloads
    into clean, JSON-serializable dictionaries.
    """

    @classmethod
    def serialize(
        cls,
        raw_message: dict[str, Any],
        channel_info: dict[str, Any] | None = None,
        collected_at: datetime | None = None,
    ) -> dict[str, Any]:
        """Convert a Discord REST API message dictionary into a standardized raw dictionary.
        
        Args:
            raw_message: Raw dictionary returned from Discord /messages API.
            channel_info: Optional metadata from /channels/{id} API.
            collected_at: UTC timestamp when the record was ingested.
        """
        msg_id = raw_message.get("id")
        if not msg_id:
            raise ValueError("Discord message payload is missing 'id'")

        # 1. Publication timestamp
        raw_timestamp = raw_message.get("timestamp")
        if not raw_timestamp:
            raise ValueError(f"Discord message '{msg_id}' is missing 'timestamp'")

        if isinstance(raw_timestamp, str):
            dt = datetime.fromisoformat(raw_timestamp)
            date_iso = dt.astimezone(timezone.utc).isoformat()
        elif isinstance(raw_timestamp, datetime):
            date_iso = raw_timestamp.astimezone(timezone.utc).isoformat()
        else:
            raise ValueError(f"Unsupported timestamp format: {raw_timestamp}")

        # 2. Author extraction
        author_data = raw_message.get("author") or {}
        author_dict = {
            "id": str(author_data.get("id", "unknown")),
            "username": author_data.get("username"),
            "discriminator": author_data.get("discriminator"),
            "global_name": author_data.get("global_name"),
            "bot": bool(author_data.get("bot", False)),
        }

        # 3. Channel metadata
        channel_id = str(raw_message.get("channel_id") or (channel_info.get("id") if channel_info else ""))
        channel_name = channel_info.get("name") if channel_info else None
        guild_id = raw_message.get("guild_id") or (channel_info.get("guild_id") if channel_info else None)

        # 4. Content
        content = raw_message.get("content") or ""

        # 5. Media & Attachments
        attachments_list = []
        for att in raw_message.get("attachments", []):
            if isinstance(att, dict):
                attachments_list.append({
                    "id": str(att.get("id", "")),
                    "filename": att.get("filename", ""),
                    "content_type": att.get("content_type", ""),
                    "size": att.get("size", 0),
                    "url": att.get("url", ""),
                })

        # 6. Embeds
        embeds_list = []
        for emb in raw_message.get("embeds", []):
            if isinstance(emb, dict):
                embeds_list.append({
                    "title": emb.get("title"),
                    "description": emb.get("description"),
                    "url": emb.get("url"),
                    "type": emb.get("type", "rich"),
                })

        # 7. Reactions
        reactions_list = []
        for react in raw_message.get("reactions", []):
            if isinstance(react, dict):
                emoji_obj = react.get("emoji") or {}
                emoji_name = emoji_obj.get("name") if isinstance(emoji_obj, dict) else str(emoji_obj)
                count = react.get("count", 0)
                if emoji_name:
                    reactions_list.append({
                        "emoji": emoji_name,
                        "count": int(count),
                    })

        # 8. Thread / Reply Reference
        ref = raw_message.get("message_reference") or {}
        referenced_msg_id = str(ref.get("message_id")) if ref.get("message_id") else None

        # 9. Ingestion timestamp
        if collected_at is None:
            collected_at = datetime.now(timezone.utc)
        elif collected_at.tzinfo is None:
            collected_at = collected_at.replace(tzinfo=timezone.utc)
        else:
            collected_at = collected_at.astimezone(timezone.utc)

        return {
            "id": str(msg_id),
            "channel_id": channel_id,
            "guild_id": str(guild_id) if guild_id else None,
            "channel_name": channel_name,
            "author": author_dict,
            "content": content,
            "timestamp": date_iso,
            "attachments": attachments_list,
            "embeds": embeds_list,
            "reactions": reactions_list,
            "reply_to_id": referenced_msg_id,
            "collected_at": collected_at.isoformat(),
        }
