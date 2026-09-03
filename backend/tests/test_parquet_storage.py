import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch
import pytest

from app.normalizers.telegram import TelegramNormalizer
from app.replay.telegram_jsonl import TelegramJSONLReplayer
from app.schemas.canonical_message import AuthorType, CanonicalMessage, Platform
from app.storage.parquet import (
    CANONICAL_MESSAGE_ARROW_SCHEMA,
    build_processed_dataset,
    canonical_messages_to_arrow_table,
    read_canonical_messages,
    read_parquet_metadata,
    write_canonical_messages,
)


@pytest.fixture
def sample_canonical_message():
    return CanonicalMessage(
        canonical_id="telegram:3190072493:1082",
        platform=Platform.TELEGRAM,
        native_id="1082",
        author_id="3190072493",
        author_username="GenshinUpdate_STR",
        author_type=AuthorType.CHANNEL,
        channel_title="Genshin Updates",
        subscriber_count=50000,
        published_at=datetime(2026, 9, 2, 7, 36, 3, 123456, tzinfo=timezone.utc),
        collected_at=datetime(2026, 9, 2, 19, 43, 25, 654321, tzinfo=timezone.utc),
        text_content="Character Selector Interface 7.1 #GenshinImpact https://example.com/test",
        language="en",
        media_types=["photo"],
        has_media=True,
        is_forward=False,
        is_repost=False,
        origin_source_id=None,
        reply_to_id="1000",
        thread_id="999",
        views_count=1200,
        forwards_count=45,
        replies_count=11,
        reactions={"👍": 12, "🔥": 5},
        urls=["https://example.com/test"],
        hashtags=["#GenshinImpact"],
        mentions=["@GenshinUpdate_STR"],
        raw_reference="GenshinUpdate_STR_20260902_194324.jsonl:2",
    )


def test_write_and_read_single_canonical_message(tmp_path, sample_canonical_message):
    """1. Test single CanonicalMessage round-trip to Parquet and back."""
    target_file = tmp_path / "test.parquet"
    written = write_canonical_messages([sample_canonical_message], target_file)
    assert written == 1
    assert target_file.exists()

    read_back = read_canonical_messages(target_file)
    assert len(read_back) == 1
    msg = read_back[0]

    assert msg.canonical_id == sample_canonical_message.canonical_id
    assert msg.platform == sample_canonical_message.platform
    assert msg.native_id == sample_canonical_message.native_id
    assert msg.author_id == sample_canonical_message.author_id
    assert msg.author_username == sample_canonical_message.author_username
    assert msg.text_content == sample_canonical_message.text_content


def test_all_canonical_fields_represented():
    """2. Test that all CanonicalMessage schema fields are explicitly mapped in Arrow schema."""
    arrow_field_names = set(CANONICAL_MESSAGE_ARROW_SCHEMA.names)
    canonical_model_fields = set(CanonicalMessage.model_fields.keys())

    assert canonical_model_fields.issubset(arrow_field_names)
    assert len(arrow_field_names) == 27


def test_nullable_fields_preserve_none(tmp_path):
    """3. Test that optional None fields remain None and are not coerced to empty strings or zeroes."""
    sparse_message = CanonicalMessage(
        canonical_id="telegram:123:456",
        platform=Platform.TELEGRAM,
        native_id="456",
        author_id="123",
        author_username=None,
        author_type=AuthorType.USER,
        channel_title=None,
        subscriber_count=None,
        published_at=datetime(2026, 9, 2, 0, 0, 0, tzinfo=timezone.utc),
        collected_at=datetime(2026, 9, 2, 0, 0, 0, tzinfo=timezone.utc),
        text_content="Sparse text",
        language=None,
        media_types=[],
        has_media=False,
        is_forward=False,
        is_repost=False,
        origin_source_id=None,
        reply_to_id=None,
        thread_id=None,
        views_count=None,
        forwards_count=None,
        replies_count=None,
        reactions={},
        urls=[],
        hashtags=[],
        mentions=[],
        raw_reference=None,
    )
    target_file = tmp_path / "sparse.parquet"
    write_canonical_messages([sparse_message], target_file)

    read_back = read_canonical_messages(target_file)[0]
    assert read_back.author_username is None
    assert read_back.channel_title is None
    assert read_back.subscriber_count is None
    assert read_back.language is None
    assert read_back.origin_source_id is None
    assert read_back.reply_to_id is None
    assert read_back.thread_id is None
    assert read_back.views_count is None
    assert read_back.forwards_count is None
    assert read_back.replies_count is None
    assert read_back.raw_reference is None


def test_list_fields_roundtrip(tmp_path, sample_canonical_message):
    """4. Test that all list fields (media_types, urls, hashtags, mentions) round-trip accurately."""
    target_file = tmp_path / "lists.parquet"
    write_canonical_messages([sample_canonical_message], target_file)

    msg = read_canonical_messages(target_file)[0]
    assert msg.media_types == ["photo"]
    assert msg.urls == ["https://example.com/test"]
    assert msg.hashtags == ["#GenshinImpact"]
    assert msg.mentions == ["@GenshinUpdate_STR"]


def test_reactions_map_roundtrip(tmp_path, sample_canonical_message):
    """5. Test that reaction count dictionary round-trips cleanly."""
    target_file = tmp_path / "reactions.parquet"
    write_canonical_messages([sample_canonical_message], target_file)

    msg = read_canonical_messages(target_file)[0]
    assert isinstance(msg.reactions, dict)
    assert msg.reactions == {"👍": 12, "🔥": 5}


def test_utc_timestamps_roundtrip(tmp_path, sample_canonical_message):
    """6. Test that UTC timestamps preserve timezone awareness and microsecond accuracy."""
    target_file = tmp_path / "timestamps.parquet"
    write_canonical_messages([sample_canonical_message], target_file)

    msg = read_canonical_messages(target_file)[0]
    assert msg.published_at.tzinfo == timezone.utc
    assert msg.collected_at.tzinfo == timezone.utc
    assert msg.published_at == sample_canonical_message.published_at
    assert msg.collected_at == sample_canonical_message.collected_at


def test_multiple_records_deterministic_ordering(tmp_path, sample_canonical_message):
    """7. Test writing multiple records maintains deterministic sequence."""
    m1 = sample_canonical_message.model_copy(update={"native_id": "1", "canonical_id": "telegram:3190072493:1"})
    m2 = sample_canonical_message.model_copy(update={"native_id": "2", "canonical_id": "telegram:3190072493:2"})
    m3 = sample_canonical_message.model_copy(update={"native_id": "3", "canonical_id": "telegram:3190072493:3"})

    target_file = tmp_path / "multi.parquet"
    write_canonical_messages([m1, m2, m3], target_file)

    read_back = read_canonical_messages(target_file)
    assert len(read_back) == 3
    assert [m.native_id for m in read_back] == ["1", "2", "3"]


def test_dataset_metadata_persisted(tmp_path, sample_canonical_message):
    """8. Test custom metadata persistence and absence of secret information."""
    target_file = tmp_path / "meta.parquet"
    custom_meta = {
        "dataset_platform": "telegram",
        "schema_version": "1.0.0",
        "source_type": "raw_jsonl_replay",
        "raw_sources": "test_batch.jsonl",
    }
    write_canonical_messages([sample_canonical_message], target_file, metadata=custom_meta)

    meta = read_parquet_metadata(target_file)
    assert meta["dataset_platform"] == "telegram"
    assert meta["schema_version"] == "1.0.0"
    assert meta["source_type"] == "raw_jsonl_replay"
    assert meta["raw_sources"] == "test_batch.jsonl"

    # Confirm no credentials leaked into metadata
    meta_dump = " ".join(f"{k}:{v}" for k, v in meta.items()).lower()
    assert "api_hash" not in meta_dump
    assert "phone" not in meta_dump
    assert "password" not in meta_dump


def test_overwrite_policy(tmp_path, sample_canonical_message):
    """9. Test overwrite guard protects existing files unless overwrite=True is passed."""
    target_file = tmp_path / "protected.parquet"
    write_canonical_messages([sample_canonical_message], target_file)

    # Attempting second write without overwrite must fail
    with pytest.raises(FileExistsError) as excinfo:
        write_canonical_messages([sample_canonical_message], target_file, overwrite=False)
    assert "already exists" in str(excinfo.value)

    # Explicit overwrite=True succeeds
    written = write_canonical_messages([sample_canonical_message], target_file, overwrite=True)
    assert written == 1


def test_empty_input_handling(tmp_path):
    """10. Test writing an empty collection raises ValueError."""
    target_file = tmp_path / "empty.parquet"
    with pytest.raises(ValueError) as excinfo:
        write_canonical_messages([], target_file)
    assert "cannot write empty" in str(excinfo.value).lower()


def test_invalid_message_type_rejection(tmp_path):
    """11. Test that non-CanonicalMessage objects in input raise TypeError."""
    target_file = tmp_path / "bad.parquet"
    with pytest.raises(TypeError) as excinfo:
        write_canonical_messages([{"not": "a_canonical_message"}], target_file)  # type: ignore[list-item]
    assert "expected canonicalmessage instance" in str(excinfo.value).lower()


def test_raw_jsonl_remains_untouched(tmp_path, sample_canonical_message):
    """12. Test that building Parquet from raw JSONL does not alter the source JSONL."""
    raw_record = {
        "id": 1082,
        "date": "2026-09-02T07:36:03+00:00",
        "peer_id": 3190072493,
        "chat": {"id": 3190072493, "title": "Genshin", "username": "GenshinUpdate_STR", "type": "channel"},
        "from": {"id": 3190072493, "username": "GenshinUpdate_STR", "type": "user"},
        "message": "Sample update",
        "media": {"type": "photo"},
        "collected_at": "2026-09-02T19:43:25.067787+00:00",
    }
    raw_file = tmp_path / "raw.jsonl"
    raw_file.write_text(json.dumps(raw_record) + "\n", encoding="utf-8")
    hash_before = hashlib.sha256(raw_file.read_bytes()).hexdigest()

    out_parquet = tmp_path / "out.parquet"
    summary = build_processed_dataset(raw_file, out_parquet)

    assert summary.records_written == 1
    hash_after = hashlib.sha256(raw_file.read_bytes()).hexdigest()
    assert hash_before == hash_after


def test_replay_pipeline_integration(tmp_path):
    """13. Test build_processed_dataset delegates to TelegramJSONLReplayer and TelegramNormalizer."""
    raw_record = {
        "id": 500,
        "date": "2026-09-02T00:00:00+00:00",
        "peer_id": 100,
        "chat": {"id": 100, "username": "channel1"},
        "message": "Intel message",
        "collected_at": "2026-09-02T12:00:00+00:00",
    }
    raw_file = tmp_path / "batch.jsonl"
    raw_file.write_text(json.dumps(raw_record) + "\n", encoding="utf-8")
    out_parquet = tmp_path / "output.parquet"

    with patch.object(TelegramNormalizer, "normalize", wraps=TelegramNormalizer.normalize) as mock_norm:
        summary = build_processed_dataset(raw_file, out_parquet)
        assert mock_norm.call_count == 1
        assert summary.records_written == 1

    messages = read_canonical_messages(out_parquet)
    assert len(messages) == 1
    assert messages[0].canonical_id == "telegram:100:500"


def test_parent_directory_creation(tmp_path, sample_canonical_message):
    """14. Test that write_canonical_messages creates nested parent directories if they don't exist."""
    nested_target = tmp_path / "level1" / "level2" / "output.parquet"
    assert not nested_target.parent.exists()

    written = write_canonical_messages([sample_canonical_message], nested_target)
    assert written == 1
    assert nested_target.exists()


def test_offline_guarantee(tmp_path, sample_canonical_message):
    """15. Test that writing and reading Parquet makes zero network calls and instantiates no Telethon client."""
    target_file = tmp_path / "offline.parquet"

    with patch("telethon.TelegramClient.__init__", side_effect=AssertionError("Telethon must not be called!")):
        write_canonical_messages([sample_canonical_message], target_file)
        msgs = read_canonical_messages(target_file)
        assert len(msgs) == 1
