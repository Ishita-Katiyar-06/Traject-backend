import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.collectors.threads.client import ThreadsClient, ThreadsCredentials
from app.collectors.threads.collector import ThreadsCollector
from app.collectors.threads.serializer import ThreadsMessageSerializer


def test_threads_credentials_from_env():
    with patch.dict("os.environ", {}, clear=True):
        with pytest.raises(ValueError, match="THREADS_ACCESS_TOKEN"):
            ThreadsCredentials.from_env()

    with patch.dict("os.environ", {"THREADS_ACCESS_TOKEN": "test_token_xyz"}):
        creds = ThreadsCredentials.from_env()
        assert creds.access_token == "test_token_xyz"


def test_threads_serializer():
    raw = {
        "id": "180123",
        "text": "Hello Threads #test https://threads.net",
        "timestamp": "2026-09-06T12:00:00+00:00",
        "username": "tester",
        "media_type": "IMAGE",
        "like_count": 10,
        "reply_count": 2,
        "reposts_count": 1,
        "quotes_count": 1,
        "views": 200,
    }

    serialized = ThreadsMessageSerializer.serialize(raw)
    assert serialized["id"] == "180123"
    assert serialized["username"] == "tester"
    assert serialized["like_count"] == 10
    assert serialized["reply_count"] == 2
    assert serialized["media_type"] == "IMAGE"


@pytest.mark.asyncio
async def test_threads_collector_mocked(tmp_path: Path):
    fixture_path = Path(__file__).parent / "fixtures" / "threads" / "sample_threads.json"
    with open(fixture_path, "r", encoding="utf-8") as f:
        sample_threads = json.load(f)

    mock_client = AsyncMock(spec=ThreadsClient)
    mock_client.get_user_profile.return_value = {"id": "999111222", "username": "thakur_saransh_rana"}
    mock_client.get_user_threads.return_value = sample_threads

    collector = ThreadsCollector(
        client=mock_client,
        raw_storage_dir=tmp_path / "raw" / "threads",
    )

    result = await collector.collect_user_threads(user_id="me", limit=10, normalize=True)

    assert result.username == "thakur_saransh_rana"
    assert result.raw_messages_count == 2
    assert result.canonical_messages_count == 2
    assert len(result.errors) == 0
    assert Path(result.raw_file_path).exists()


@pytest.mark.asyncio
async def test_threads_collector_keyword_search_mocked(tmp_path: Path):
    fixture_path = Path(__file__).parent / "fixtures" / "threads" / "sample_threads.json"
    with open(fixture_path, "r", encoding="utf-8") as f:
        sample_threads = json.load(f)

    mock_client = AsyncMock(spec=ThreadsClient)
    mock_client.search_threads.return_value = sample_threads

    collector = ThreadsCollector(
        client=mock_client,
        raw_storage_dir=tmp_path / "raw" / "threads",
    )

    result = await collector.collect_keyword_search(query="security", limit=10, normalize=True)

    assert result.user_id == "query:security"
    assert result.username == "search_security"
    assert result.raw_messages_count == 2
    assert result.canonical_messages_count == 2
    assert len(result.errors) == 0
    assert Path(result.raw_file_path).exists()
    assert "search_security_" in Path(result.raw_file_path).name

