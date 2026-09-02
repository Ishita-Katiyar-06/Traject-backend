from datetime import datetime, timezone
import pytest
from app.normalizers.telegram import TelegramNormalizer
from app.schemas.canonical_message import AuthorType, Platform


def test_telegram_normal_message_normalization():
    """Test normalizing a standard broadcast text message with engagement and entities."""
    raw_payload = {
        "id": 104523,
        "date": "2026-09-03T00:15:00+00:00",
        "message": "Breaking: Comprehensive narrative tracking system initialized. https://ntro.gov.in #NationalSecurity #OSINT",
        "peer_id": -1001234567890,
        "chat": {
            "id": -1001234567890,
            "title": "Strategic Updates Daily",
            "username": "strategic_updates",
            "type": "channel",
            "participants_count": 84200,
        },
        "views": 15400,
        "forwards": 320,
        "replies": {"replies": 45},
        "reactions": [{"emoji": "🔥", "count": 210}, {"emoji": "👍", "count": 540}],
    }

    canonical = TelegramNormalizer.normalize(raw_payload)

    assert canonical.canonical_id == "telegram:-1001234567890:104523"
    assert canonical.platform == Platform.TELEGRAM
    assert canonical.native_id == "104523"

    assert canonical.author_id == "-1001234567890"
    assert canonical.author_username == "strategic_updates"
    assert canonical.author_type == AuthorType.CHANNEL
    assert canonical.channel_title == "Strategic Updates Daily"
    assert canonical.subscriber_count == 84200
    assert canonical.published_at == datetime(2026, 9, 3, 0, 15, 0, tzinfo=timezone.utc)
    assert canonical.views_count == 15400
    assert canonical.forwards_count == 320
    assert canonical.replies_count == 45
    assert canonical.reactions == {"🔥": 210, "👍": 540}
    assert "https://ntro.gov.in" in canonical.urls
    assert "#NationalSecurity" in canonical.hashtags
    assert "#OSINT" in canonical.hashtags
    assert canonical.is_forward is False
    assert canonical.has_media is False


def test_telegram_message_with_media_caption():
    """Test normalizing a message containing media and a caption."""
    raw_payload = {
        "id": "205510",
        "date": 1725321600,  # Unix timestamp
        "caption": "Satellite telemetry and coverage map for border regions. @analyst_bot",
        "peer_id": "channel_55",
        "media": {"type": "photo"},
        "photo": True,
    }

    canonical = TelegramNormalizer.normalize(raw_payload)

    assert canonical.native_id == "205510"
    assert canonical.text_content == "Satellite telemetry and coverage map for border regions. @analyst_bot"
    assert canonical.has_media is True
    assert "photo" in canonical.media_types
    assert "@analyst_bot" in canonical.mentions
    assert canonical.published_at.tzinfo == timezone.utc


def test_telegram_forwarded_message_normalization():
    """Test normalizing a forwarded message with origin source tracking."""
    raw_payload = {
        "id": 3001,
        "date": "2026-09-03T00:20:00Z",
        "message": "Forwarded intel report from primary broadcast node.",
        "peer_id": "sub_channel_9",
        "fwd_from": {
            "channel_id": "main_broadcast_node",
            "channel_post": 4820,
        },
        "chat": {"title": "Sub Discussion Node", "type": "supergroup"},
    }

    canonical = TelegramNormalizer.normalize(raw_payload)

    assert canonical.is_forward is True
    assert canonical.origin_source_id == "telegram:main_broadcast_node:4820"
    assert canonical.author_type == AuthorType.GROUP


def test_telegram_reply_normalization():
    """Test normalizing a comment/reply linked to a parent message and thread."""
    raw_payload = {
        "id": 4099,
        "date": "2026-09-03T00:25:00+00:00",
        "message": "Confirming receipt of information cascade notification.",
        "peer_id": "group_discussion_01",
        "reply_to": {
            "reply_to_msg_id": 4000,
            "reply_to_top_id": 3950,
        },
    }

    canonical = TelegramNormalizer.normalize(raw_payload)

    assert canonical.reply_to_id == "4000"
    assert canonical.thread_id == "3950"


def test_unicode_text_preservation():
    """Test that multilingual unicode scripts and emojis are perfectly preserved without mangling."""
    hindi_text = "राष्ट्रीय तकनीकी अनुसंधान संगठन (NTRO) - सूचना सत्यापन 🇮🇳 🚀 🔍"
    raw_payload = {
        "id": 5012,
        "date": "2026-09-03T00:30:00Z",
        "message": hindi_text,
        "peer_id": "ntro_public_feed",
    }

    canonical = TelegramNormalizer.normalize(raw_payload)

    assert canonical.text_content == hindi_text
    assert "🇮🇳" in canonical.text_content


def test_optional_fields_absent():
    """Test handling bare minimum payload without optional metadata."""
    bare_payload = {
        "id": 9999,
        "date": "2026-09-03T00:35:00Z",
        "from_id": "user_42",
    }

    canonical = TelegramNormalizer.normalize(bare_payload)

    assert canonical.canonical_id == "telegram:user_42:9999"
    assert canonical.native_id == "9999"
    assert canonical.author_id == "user_42"
    assert canonical.author_username is None
    assert canonical.channel_title is None
    assert canonical.subscriber_count is None
    assert canonical.text_content == ""
    assert canonical.media_types == []
    assert canonical.has_media is False
    assert canonical.is_forward is False
    assert canonical.views_count is None
    assert canonical.reactions == {}
    assert canonical.urls == []


def test_normalizer_same_message_id_different_chats_receive_distinct_canonical_ids():
    """Verify that messages with identical message IDs from different channels produce distinct canonical IDs."""
    shared_msg_id = 555
    payload_channel_a = {
        "id": shared_msg_id,
        "date": "2026-09-03T00:40:00Z",
        "message": "Alert broadcast from channel Alpha",
        "peer_id": -100111111111,
        "chat": {"id": -100111111111, "title": "Channel Alpha", "type": "channel"},
    }
    payload_channel_b = {
        "id": shared_msg_id,
        "date": "2026-09-03T00:40:00Z",
        "message": "Alert broadcast from channel Beta",
        "peer_id": -100222222222,
        "chat": {"id": -100222222222, "title": "Channel Beta", "type": "channel"},
    }

    canonical_a = TelegramNormalizer.normalize(payload_channel_a)
    canonical_b = TelegramNormalizer.normalize(payload_channel_b)

    assert canonical_a.native_id == "555"
    assert canonical_b.native_id == "555"
    assert canonical_a.canonical_id == "telegram:-100111111111:555"
    assert canonical_b.canonical_id == "telegram:-100222222222:555"
    assert canonical_a.canonical_id != canonical_b.canonical_id


def test_invalid_payload_types():
    """Test error handling on malformed raw inputs."""
    with pytest.raises(TypeError):
        TelegramNormalizer.normalize("not a dict")  # type: ignore[arg-type]

    with pytest.raises(ValueError):
        TelegramNormalizer.normalize({"date": "2026-09-03T00:00:00Z"})  # missing id

    with pytest.raises(ValueError):
        TelegramNormalizer.normalize({"id": 100})  # missing date

