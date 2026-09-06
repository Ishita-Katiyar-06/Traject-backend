import json
from pathlib import Path

import pytest

from app.normalizers.discord import DiscordNormalizer
from app.schemas.canonical_message import AuthorType, CanonicalMessage, Platform


def test_discord_normalizer_fixture():
    fixture_path = Path(__file__).parent / "fixtures" / "discord" / "sample_messages.json"
    with open(fixture_path, "r", encoding="utf-8") as f:
        samples = json.load(f)

    # 1. First message: Has content, attachments, embeds, reactions
    cmsg1 = DiscordNormalizer.normalize(
        samples[0],
        raw_reference="discord_test.jsonl:line_1",
    )

    assert isinstance(cmsg1, CanonicalMessage)
    assert cmsg1.platform == Platform.DISCORD
    assert cmsg1.native_id == "1001"
    assert cmsg1.canonical_id == "discord:1001"
    assert cmsg1.author_id == "2001"
    assert cmsg1.author_username == "Alpha Lead"
    assert cmsg1.author_type == AuthorType.USER
    assert cmsg1.has_media is True
    assert "photo" in cmsg1.media_types
    assert "https://example.com/briefing" in cmsg1.urls
    assert "security" in cmsg1.hashtags
    assert "update" in cmsg1.hashtags
    assert cmsg1.reactions == {"👍": 5, "🔥": 2}
    assert cmsg1.raw_reference == "discord_test.jsonl:line_1"

    # 2. Second message: Reply with no media
    cmsg2 = DiscordNormalizer.normalize(
        samples[1],
        raw_reference="discord_test.jsonl:line_2",
    )

    assert cmsg2.platform == Platform.DISCORD
    assert cmsg2.native_id == "1002"
    assert cmsg2.canonical_id == "discord:1002"
    assert cmsg2.author_id == "2002"
    assert cmsg2.author_username == "Beta Analyst"
    assert cmsg2.has_media is False
    assert cmsg2.media_types == []
    assert cmsg2.reply_to_id == "1001"


def test_discord_normalizer_invalid_payload():
    with pytest.raises(TypeError):
        DiscordNormalizer.normalize(["not", "a", "dict"])

    with pytest.raises(ValueError, match="missing 'id'"):
        DiscordNormalizer.normalize({"content": "Missing ID"})

    with pytest.raises(ValueError, match="Missing timestamp"):
        DiscordNormalizer.normalize({"id": "123"})
