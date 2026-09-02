from datetime import datetime, timezone
from typing import Any


class TelethonMessageSerializer:
    """Deliberate serialization layer converting Telethon Message objects and entities
    into clean, JSON-serializable raw dictionaries without unsafe reflection.
    """

    @classmethod
    def serialize(
        cls,
        message: Any,
        chat_entity: Any = None,
        collected_at: datetime | None = None,
    ) -> dict[str, Any]:
        """Convert a Telethon Message instance (or mock) to a standard raw JSON-compatible dictionary.
        
        Args:
            message: Telethon Message or mock object.
            chat_entity: Optional resolved chat/channel entity if known.
            collected_at: Ingestion timestamp (UTC).
            
        Returns:
            dict[str, Any]: JSON-serializable dictionary capturing all message metadata.
        """
        # 1. Message ID
        msg_id = getattr(message, "id", None)
        if msg_id is None:
            raise ValueError("Telethon message is missing 'id'")

        # 2. Date
        raw_date = getattr(message, "date", None)
        if isinstance(raw_date, datetime):
            if raw_date.tzinfo is None:
                date_iso = raw_date.replace(tzinfo=timezone.utc).isoformat()
            else:
                date_iso = raw_date.astimezone(timezone.utc).isoformat()
        elif isinstance(raw_date, (int, float)):
            date_iso = datetime.fromtimestamp(raw_date, tz=timezone.utc).isoformat()
        elif isinstance(raw_date, str):
            try:
                datetime.fromisoformat(raw_date)
            except Exception as e:
                raise ValueError(f"Message has invalid date string: '{raw_date}'") from e
            date_iso = raw_date
        else:
            raise ValueError(f"Message has invalid date: {raw_date}")


        # 3. Peer & Chat identification
        chat_dict = cls._serialize_chat_entity(chat_entity or getattr(message, "chat", None))
        peer_id = cls._extract_peer_id(message, chat_dict)

        # 4. Sender / Author
        sender_dict = cls._serialize_sender(getattr(message, "sender", None), getattr(message, "sender_id", None))

        # 5. Message text / caption
        text = getattr(message, "message", "") or getattr(message, "raw_text", "") or ""
        if not isinstance(text, str):
            text = str(text)

        # 6. Media extraction
        media_dict = cls._serialize_media(getattr(message, "media", None), message)

        # 7. Forwarding information
        fwd_dict = cls._serialize_forward(getattr(message, "fwd_from", None) or getattr(message, "forward", None))

        # 8. Reply & Thread information
        reply_dict = cls._serialize_reply(getattr(message, "reply_to", None))

        # 9. Engagement metrics
        views = getattr(message, "views", None)
        forwards = getattr(message, "forwards", None)
        replies_count = cls._serialize_replies(getattr(message, "replies", None))
        reactions_list = cls._serialize_reactions(getattr(message, "reactions", None))

        # 10. Entities (URLs, hashtags, mentions)
        entities_list = cls._serialize_entities(getattr(message, "entities", None), text)

        # 11. Ingestion timestamp
        if collected_at is None:
            collected_at = datetime.now(timezone.utc)
        elif collected_at.tzinfo is None:
            collected_at = collected_at.replace(tzinfo=timezone.utc)
        else:
            collected_at = collected_at.astimezone(timezone.utc)

        return {
            "id": int(msg_id),
            "date": date_iso,
            "peer_id": peer_id,
            "chat": chat_dict,
            "from": sender_dict,
            "message": text,
            "media": media_dict,
            "fwd_from": fwd_dict,
            "reply_to": reply_dict,
            "views": int(views) if views is not None else None,
            "forwards": int(forwards) if forwards is not None else None,
            "replies": replies_count,
            "reactions": reactions_list,
            "entities": entities_list,
            "collected_at": collected_at.isoformat(),
        }

    @classmethod
    def _extract_peer_id(cls, message: Any, chat_dict: dict[str, Any]) -> str | int:
        """Extract stable signed chat ID or peer identifier."""
        if chat_dict.get("id") is not None:
            return chat_dict["id"]

        chat_id = getattr(message, "chat_id", None)
        if chat_id is not None:
            return chat_id

        peer = getattr(message, "peer_id", None)
        if peer is not None:
            # Telethon PeerChannel, PeerChat, PeerUser
            if hasattr(peer, "channel_id"):
                return -1000000000000 - peer.channel_id if peer.channel_id > 0 else peer.channel_id
            if hasattr(peer, "chat_id"):
                return -peer.chat_id if peer.chat_id > 0 else peer.chat_id
            if hasattr(peer, "user_id"):
                return peer.user_id
            if isinstance(peer, (int, str)):
                return peer

        return "unknown_peer"

    @classmethod
    def _serialize_chat_entity(cls, chat: Any) -> dict[str, Any]:
        """Convert a Telethon Chat / Channel entity into primitive dictionary."""
        if not chat:
            return {}
        if isinstance(chat, dict):
            return chat

        chat_id = getattr(chat, "id", None)
        title = getattr(chat, "title", None)
        username = getattr(chat, "username", None)
        
        # Determine chat type
        is_broadcast = getattr(chat, "broadcast", False)
        is_megagroup = getattr(chat, "megagroup", False) or getattr(chat, "gigagroup", False)
        
        if is_broadcast:
            chat_type = "channel"
        elif is_megagroup:
            chat_type = "supergroup"
        elif title:
            chat_type = "group"
        else:
            chat_type = "chat"

        participants_count = (
            getattr(chat, "participants_count", None)
            or getattr(chat, "subscriber_count", None)
        )

        return {
            "id": chat_id,
            "title": title,
            "username": username,
            "type": chat_type,
            "participants_count": participants_count,
        }

    @classmethod
    def _serialize_sender(cls, sender: Any, sender_id: Any) -> dict[str, Any]:
        """Convert message sender details into primitive dictionary."""
        if not sender and not sender_id:
            return {}
        if isinstance(sender, dict):
            return sender

        sid = getattr(sender, "id", None) or sender_id
        username = getattr(sender, "username", None)
        first_name = getattr(sender, "first_name", None)
        last_name = getattr(sender, "last_name", None)
        is_bot = getattr(sender, "bot", False)

        return {
            "id": sid,
            "username": username,
            "first_name": first_name,
            "last_name": last_name,
            "is_bot": is_bot,
            "type": "bot" if is_bot else "user",
        }

    @classmethod
    def _serialize_media(cls, media: Any, message: Any) -> dict[str, Any] | None:
        """Serialize media attachment information into primitive dictionary."""
        if not media:
            # Check boolean media properties
            if getattr(message, "photo", False):
                return {"type": "photo"}
            if getattr(message, "video", False):
                return {"type": "video"}
            if getattr(message, "document", False):
                return {"type": "document"}
            return None

        if isinstance(media, dict):
            return media

        media_cls_name = media.__class__.__name__.lower()
        if "photo" in media_cls_name:
            return {"type": "photo"}
        if "video" in media_cls_name:
            return {"type": "video"}
        if "document" in media_cls_name or "doc" in media_cls_name or hasattr(media, "document"):
            mime = getattr(getattr(media, "document", None), "mime_type", None)
            return {"type": "document", "mime_type": mime}
        if "webpage" in media_cls_name:
            url = getattr(getattr(media, "webpage", None), "url", None)
            return {"type": "webpage", "url": url}
        if "poll" in media_cls_name:
            return {"type": "poll"}
        if "geo" in media_cls_name:
            return {"type": "geo"}

        return {"type": media_cls_name.replace("messagemedia", "")}


    @classmethod
    def _serialize_forward(cls, fwd: Any) -> dict[str, Any] | None:
        """Serialize forward header into primitive dictionary."""
        if not fwd:
            return None
        if isinstance(fwd, dict):
            return fwd

        channel_id = None
        from_id = getattr(fwd, "from_id", None)
        if from_id is not None:
            if hasattr(from_id, "channel_id"):
                channel_id = from_id.channel_id
            elif hasattr(from_id, "user_id"):
                channel_id = from_id.user_id
            else:
                channel_id = str(from_id)

        channel_post = getattr(fwd, "channel_post", None)
        from_name = getattr(fwd, "from_name", None)
        
        fwd_date = getattr(fwd, "date", None)
        date_str = fwd_date.isoformat() if isinstance(fwd_date, datetime) else None

        return {
            "channel_id": channel_id,
            "channel_post": channel_post,
            "from_name": from_name,
            "date": date_str,
        }

    @classmethod
    def _serialize_reply(cls, reply: Any) -> dict[str, Any] | None:
        """Serialize reply header into primitive dictionary."""
        if not reply:
            return None
        if isinstance(reply, dict):
            return reply

        reply_to_msg_id = getattr(reply, "reply_to_msg_id", None)
        reply_to_top_id = getattr(reply, "reply_to_top_id", None)

        if reply_to_msg_id is None and reply_to_top_id is None:
            if isinstance(reply, int):
                return {"reply_to_msg_id": reply}
            return None

        return {
            "reply_to_msg_id": reply_to_msg_id,
            "reply_to_top_id": reply_to_top_id,
        }

    @classmethod
    def _serialize_replies(cls, replies: Any) -> int | None:
        """Extract reply count integer."""
        if replies is None:
            return None
        if isinstance(replies, int):
            return replies
        if isinstance(replies, dict):
            return replies.get("replies") or replies.get("count")
        return getattr(replies, "replies", None)

    @classmethod
    def _serialize_reactions(cls, reactions: Any) -> list[dict[str, Any]]:
        """Serialize reactions into a list of {emoji, count} dictionaries."""
        if not reactions:
            return []
        if isinstance(reactions, list):
            return reactions
        if isinstance(reactions, dict):
            return [{"emoji": str(k), "count": int(v)} for k, v in reactions.items()]

        out: list[dict[str, Any]] = []
        results = getattr(reactions, "results", None)
        if results:
            for item in results:
                reaction_obj = getattr(item, "reaction", None)
                emoticon = getattr(reaction_obj, "emoticon", None) or str(reaction_obj)
                count = getattr(item, "count", 1)
                if emoticon:
                    out.append({"emoji": emoticon, "count": int(count)})
        return out

    @classmethod
    def _serialize_entities(cls, entities: Any, text: str) -> list[dict[str, Any]]:
        """Extract explicit entity spans from Telethon message entities."""
        if not entities:
            return []
        if isinstance(entities, list) and entities and isinstance(entities[0], dict):
            return entities

        out: list[dict[str, Any]] = []
        for ent in entities:
            ent_cls = ent.__class__.__name__.lower()
            offset = getattr(ent, "offset", None)
            length = getattr(ent, "length", None)
            extracted_text = ""
            if offset is not None and length is not None and text:
                extracted_text = text[offset : offset + length]

            if "url" in ent_cls:
                url_val = getattr(ent, "url", None) or extracted_text
                out.append({"type": "url", "url": url_val})
            elif "hashtag" in ent_cls:
                out.append({"type": "hashtag", "text": extracted_text})
            elif "mention" in ent_cls:
                out.append({"type": "mention", "text": extracted_text})

        return out
