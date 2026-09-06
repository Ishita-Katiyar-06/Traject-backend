import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.collectors.discord.client import DiscordClient, DiscordCredentials
from app.collectors.discord.collector import DiscordCollector
from app.collectors.discord.serializer import DiscordMessageSerializer


def test_discord_credentials_from_env():
    with patch.dict("os.environ", {}, clear=True):
        with pytest.raises(ValueError, match="DISCORD_BOT_TOKEN"):
            DiscordCredentials.from_env()

    with patch.dict("os.environ", {"DISCORD_BOT_TOKEN": "test_bot_token_123"}):
        creds = DiscordCredentials.from_env()
        assert creds.bot_token == "test_bot_token_123"


def test_discord_serializer_basic():
    raw_payload = {
        "id": "123456",
        "channel_id": "987654",
        "timestamp": "2026-09-06T12:00:00.000000+00:00",
        "content": "Hello #alert test https://traject.ai",
        "author": {
            "id": "111",
            "username": "tester",
            "global_name": "Test User",
            "bot": False,
        },
        "attachments": [
            {
                "id": "att1",
                "filename": "photo.jpg",
                "content_type": "image/jpeg",
                "size": 100,
                "url": "https://cdn.discord.com/att1.jpg",
            }
        ],
        "embeds": [
            {
                "title": "Alert Title",
                "description": "Alert Description",
                "url": "https://traject.ai",
                "type": "rich",
            }
        ],
        "reactions": [
            {"emoji": {"name": "👍"}, "count": 3}
        ],
        "message_reference": {
            "message_id": "1000"
        }
    }

    serialized = DiscordMessageSerializer.serialize(
        raw_payload,
        channel_info={"id": "987654", "name": "general"},
    )

    assert serialized["id"] == "123456"
    assert serialized["channel_id"] == "987654"
    assert serialized["channel_name"] == "general"
    assert serialized["author"]["username"] == "tester"
    assert serialized["author"]["global_name"] == "Test User"
    assert serialized["reply_to_id"] == "1000"
    assert len(serialized["attachments"]) == 1
    assert len(serialized["embeds"]) == 1
    assert len(serialized["reactions"]) == 1
    assert serialized["reactions"][0]["emoji"] == "👍"


@pytest.mark.asyncio
async def test_discord_collector_mocked(tmp_path: Path):
    fixture_path = Path(__file__).parent / "fixtures" / "discord" / "sample_messages.json"
    with open(fixture_path, "r", encoding="utf-8") as f:
        sample_msgs = json.load(f)

    mock_client = AsyncMock(spec=DiscordClient)
    mock_client.get_channel_info.return_value = {"id": "1546079728404930612", "name": "general"}
    mock_client.get_channel_messages.return_value = sample_msgs

    collector = DiscordCollector(
        client=mock_client,
        raw_storage_dir=tmp_path / "raw" / "discord",
    )

    result = await collector.collect_channel("1546079728404930612", limit=10, normalize=True)

    assert result.channel_id == "1546079728404930612"
    assert result.channel_name == "general"
    assert result.raw_messages_count == 2
    assert result.canonical_messages_count == 2
    assert len(result.errors) == 0
    assert Path(result.raw_file_path).exists()


@pytest.mark.asyncio
async def test_discord_collector_all_mocked(tmp_path: Path):
    fixture_path = Path(__file__).parent / "fixtures" / "discord" / "sample_messages.json"
    with open(fixture_path, "r", encoding="utf-8") as f:
        sample_msgs = json.load(f)

    mock_client = AsyncMock(spec=DiscordClient)
    mock_client.get_bot_guilds.return_value = [{"id": "guild_1", "name": "Test Server"}]
    mock_client.get_guild_channels.return_value = [
        {"id": "ch_1", "name": "general", "type": 0},
        {"id": "ch_2", "name": "announcements", "type": 5},
    ]
    mock_client.get_channel_info.side_effect = lambda cid: {"id": cid, "name": f"name_{cid}"}
    mock_client.get_channel_messages.return_value = sample_msgs

    collector = DiscordCollector(
        client=mock_client,
        raw_storage_dir=tmp_path / "raw" / "discord",
    )

    results = await collector.collect_all(limit=10, normalize=True)
    assert len(results) == 2
    assert results[0].channel_id == "ch_1"
    assert results[1].channel_id == "ch_2"
    assert results[0].canonical_messages_count == 2
    assert results[1].canonical_messages_count == 2
