import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import pytest

from app.collectors.telegram.collector import (
    CollectionResult,
    MultiCollectionResult,
    TelegramCollector,
    parse_telegram_sources,
)
from app.collectors.telegram.registry import (
    SourceType,
    TelegramSourceEntry,
    TelegramSourceRegistry,
    load_telegram_source_registry,
)
from app.quality.validation import process_quality
from app.replay.telegram_jsonl import TelegramJSONLReplayer
from app.schemas.canonical_message import AuthorType, CanonicalMessage, Platform
from app.storage.parquet import (
    build_processed_dataset,
    read_canonical_messages,
    write_canonical_messages,
)


# ==============================================================================
# Mock Telethon Infrastructure for Multi-Channel Testing
# ==============================================================================

class MockMultiChat:
    def __init__(self, id: int, username: str, title: str):
        self.id = id
        self.username = username
        self.title = title
        self.broadcast = True


class MockMultiMessage:
    def __init__(
        self,
        id: int,
        message: str,
        chat: MockMultiChat,
        date: datetime | None = None,
    ):
        self.id = id
        self.message = message
        self.chat = chat
        self.date = date or datetime(2026, 9, 6, 12, 0, 0, tzinfo=timezone.utc)
        self.sender = None
        self.sender_id = chat.id
        self.media = None
        self.fwd_from = None
        self.reply_to = None
        self.views = 1500
        self.forwards = 45
        self.replies = 10
        self.reactions = None
        self.entities = None


class MockMultiAsyncTelegramClient:
    """Mock Telethon client supporting multi-channel entity resolution and message iteration."""

    def __init__(
        self,
        channels_messages: dict[str, list[MockMultiMessage]] | None = None,
        failing_channels: dict[str, Exception] | None = None,
    ):
        self.channels_messages = channels_messages or {}
        self.failing_channels = failing_channels or {}
        self._connected = True
        self._authorized = True
        self.connection_count = 0
        self.start_called_count = 0

    def is_connected(self) -> bool:
        return self._connected

    async def connect(self) -> None:
        self.connection_count += 1
        self._connected = True

    async def disconnect(self) -> None:
        self._connected = False

    async def is_user_authorized(self) -> bool:
        return self._authorized

    async def start(self, **kwargs: Any) -> "MockMultiAsyncTelegramClient":
        self.start_called_count += 1
        self._authorized = True
        return self

    async def get_entity(self, channel: str | int) -> MockMultiChat:
        key = str(channel).strip()
        clean_key = key.lstrip("@").lower()

        # Check for simulated failures
        for fail_pattern, exc in self.failing_channels.items():
            if fail_pattern.lstrip("@").lower() == clean_key or fail_pattern == key:
                raise exc

        # Resolve entity
        for ch_key in self.channels_messages:
            if ch_key.lstrip("@").lower() == clean_key or ch_key == key:
                msgs = self.channels_messages[ch_key]
                if msgs:
                    return msgs[0].chat
                return MockMultiChat(id=-100999000, username=clean_key, title=f"Title {clean_key}")

        # Default fallback entity
        channel_id = int(key) if (key.startswith("-") and key[1:].isdigit()) or key.isdigit() else -100111222333
        return MockMultiChat(id=channel_id, username=key.lstrip("@"), title=f"Title {key}")

    async def iter_messages(self, entity: Any, limit: int = 100):
        ent_username = getattr(entity, "username", "")
        ent_id = getattr(entity, "id", None)

        for ch_key, msgs in self.channels_messages.items():
            if ch_key.lstrip("@").lower() == ent_username.lower() or str(ent_id) == str(ch_key):
                for msg in msgs[:limit]:
                    yield msg
                return


# ==============================================================================
# 1. Source Registry Tests
# ==============================================================================

def test_load_production_source_registry():
    """1. Test that default production telegram_sources.json loads with configured seed sources."""
    registry = load_telegram_source_registry()
    assert len(registry.sources) >= 60
    assert len(registry.get_enabled_sources()) >= 60

    usernames = registry.get_enabled_usernames()
    assert "@warmonitors" in usernames
    assert "@liveuamap" in usernames
    assert "@Ministry_Of_Defence_Gvt_India" in usernames
    assert "@thehackernews" in usernames
    assert "@ReutersWorldChannel" in usernames


def test_registry_source_types_and_ordering():
    """2. Test that source types adhere strictly to controlled taxonomy and ordering is preserved."""
    registry = load_telegram_source_registry()

    reuters = registry.get_by_username("@ReutersWorldChannel")
    assert reuters is not None
    assert reuters.source_type == SourceType.REPUBLICATION
    assert reuters.domain == "general_news"
    assert reuters.expected_language == "en"

    mod = registry.get_by_username("@Ministry_Of_Defence_Gvt_India")
    assert mod is not None
    assert mod.source_type == SourceType.OFFICIAL
    assert mod.domain == "india_defence"

    # Ordering preservation check
    first_three = [s.username for s in registry.sources[:3]]
    assert first_three == ["@warmonitors", "@liveuamap", "@OSINTdefender"]


def test_registry_enabled_disabled_filtering(tmp_path):
    """3. Test enabled vs disabled source filtering."""
    custom_json = {
        "version": "1.0.0",
        "sources": [
            {"username": "@active1", "domain": "news", "expected_language": "en", "source_type": "independent", "enabled": True},
            {"username": "@inactive2", "domain": "news", "expected_language": "en", "source_type": "publisher", "enabled": False},
            {"username": "@active3", "domain": "news", "expected_language": "en", "source_type": "official", "enabled": True},
        ],
    }
    reg_file = tmp_path / "telegram_sources.json"
    reg_file.write_text(json.dumps(custom_json), encoding="utf-8")

    reg = load_telegram_source_registry(reg_file)
    assert len(reg.sources) == 3
    enabled = reg.get_enabled_sources()
    assert len(enabled) == 2
    assert [s.username for s in enabled] == ["@active1", "@active3"]


def test_registry_validation_missing_fields(tmp_path):
    """4. Test that missing required fields in registry JSON raise descriptive ValueError."""
    bad_json = {
        "version": "1.0.0",
        "sources": [
            {"username": "@bad", "domain": "news"},  # missing expected_language and source_type
        ],
    }
    reg_file = tmp_path / "bad.json"
    reg_file.write_text(json.dumps(bad_json), encoding="utf-8")

    with pytest.raises(ValueError) as excinfo:
        load_telegram_source_registry(reg_file)
    assert "missing required field(s)" in str(excinfo.value)


def test_registry_validation_invalid_source_type(tmp_path):
    """5. Test that invalid source_type raises descriptive ValueError."""
    bad_type_json = {
        "version": "1.0.0",
        "sources": [
            {"username": "@bad", "domain": "news", "expected_language": "en", "source_type": "unapproved_type"},
        ],
    }
    reg_file = tmp_path / "bad_type.json"
    reg_file.write_text(json.dumps(bad_type_json), encoding="utf-8")

    with pytest.raises(ValueError) as excinfo:
        load_telegram_source_registry(reg_file)
    assert "Invalid source_type 'unapproved_type'" in str(excinfo.value)


def test_registry_file_not_found():
    """6. Test FileNotFoundError for non-existent registry path."""
    with pytest.raises(FileNotFoundError):
        load_telegram_source_registry("non_existent_registry_file_xyz.json")


# ==============================================================================
# 2. Source Parsing Tests
# ==============================================================================

def test_parse_telegram_sources_single_and_multiple():
    """7. Test source parsing with single, multiple, comma-separated inputs."""
    assert parse_telegram_sources("@channel") == ["@channel"]
    assert parse_telegram_sources("channel") == ["@channel"]
    assert parse_telegram_sources("@a, @b, @c") == ["@a", "@b", "@c"]
    assert parse_telegram_sources(["@a", "@b", "@c"]) == ["@a", "@b", "@c"]


def test_parse_telegram_sources_whitespace_and_newlines():
    """8. Test parsing handles leading/trailing whitespace, newlines, and tabs."""
    raw = "   @alpha  ,\n  @bravo   \n\t  @charlie   "
    parsed = parse_telegram_sources(raw)
    assert parsed == ["@alpha", "@bravo", "@charlie"]


def test_parse_telegram_sources_deduplication():
    """9. Test parsing deduplicates channels case-insensitively while preserving first-seen order."""
    raw = "@warmonitors, @liveuamap, @warmonitors, @WARMONITORS, @liveuamap, @bnonews"
    assert parse_telegram_sources(raw) == ["@warmonitors", "@liveuamap", "@bnonews"]


def test_parse_telegram_sources_empty_and_none():
    """10. Test parsing handles empty strings, whitespace, and None gracefully."""
    assert parse_telegram_sources(None) == []
    assert parse_telegram_sources("") == []
    assert parse_telegram_sources("    \n\t   ") == []
    assert parse_telegram_sources([]) == []


def test_parse_telegram_sources_numeric_and_tme_links():
    """11. Test parsing handles numeric IDs and public t.me URLs."""
    raw = "https://t.me/telegram, t.me/durov, -1001234567890, 987654321"
    parsed = parse_telegram_sources(raw)
    assert parsed == ["@telegram", "@durov", "-1001234567890", "987654321"]


# ==============================================================================
# 3. Collection Flow & Client Reuse Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_multi_source_collection_sequential_and_client_reuse(tmp_path):
    """12. Test multi-source collection executes sequentially and reuses ONE Telethon client."""
    chat_a = MockMultiChat(id=-100111, username="channel_a", title="Channel Alpha")
    chat_b = MockMultiChat(id=-100222, username="channel_b", title="Channel Bravo")

    msgs_a = [
        MockMultiMessage(id=1, message="Intel update 1 from Alpha #Alert", chat=chat_a),
        MockMultiMessage(id=2, message="Intel update 2 from Alpha #Alert", chat=chat_a),
    ]
    msgs_b = [
        MockMultiMessage(id=10, message="Cyber briefing from Bravo #Cyber", chat=chat_b),
        MockMultiMessage(id=20, message="Vulnerability alert Bravo #Cyber", chat=chat_b),
    ]

    mock_client = MockMultiAsyncTelegramClient(
        channels_messages={"@channel_a": msgs_a, "@channel_b": msgs_b}
    )

    collector = TelegramCollector(
        client=mock_client,  # type: ignore[arg-type]
        raw_storage_dir=tmp_path / "raw" / "telegram",
    )

    result = await collector.collect_sources(sources=["@channel_a", "@channel_b"], limit=5)

    assert isinstance(result, MultiCollectionResult)
    assert result.total_sources_requested == 2
    assert result.successful_sources == 2
    assert result.failed_sources == 0
    assert result.total_raw_messages == 4
    assert result.total_canonical_messages == 4

    # Ensure single Telethon client connection/start was reused
    assert mock_client.start_called_count == 0  # Already authorized, bypassed start()
    assert len(result.raw_file_paths) == 2

    # Check per-source results
    res_a = result.channel_results["@channel_a"]
    res_b = result.channel_results["@channel_b"]
    assert res_a.raw_messages_count == 2
    assert res_b.raw_messages_count == 2
    assert res_a.canonical_messages[0].canonical_id == "telegram:-100111:1"
    assert res_b.canonical_messages[0].canonical_id == "telegram:-100222:10"


@pytest.mark.asyncio
async def test_per_source_limits(tmp_path):
    """13. Test per-source limits override default collection limit."""
    chat = MockMultiChat(id=-100111, username="chan_lim", title="Limited Channel")
    msgs = [MockMultiMessage(id=i, message=f"Msg {i}", chat=chat) for i in range(1, 11)]

    mock_client = MockMultiAsyncTelegramClient(channels_messages={"@chan_lim": msgs})
    collector = TelegramCollector(client=mock_client, raw_storage_dir=tmp_path)  # type: ignore[arg-type]

    result = await collector.collect_sources(
        sources=["@chan_lim"],
        limit=10,
        per_source_limits={"@chan_lim": 3},
    )

    assert result.total_canonical_messages == 3
    assert result.channel_results["@chan_lim"].canonical_messages_count == 3


@pytest.mark.asyncio
async def test_single_channel_backwards_compatibility(tmp_path):
    """14. Test existing single-channel collect_channel() remains 100% backwards compatible."""
    chat = MockMultiChat(id=-100777, username="legacy_chan", title="Legacy Channel")
    msgs = [MockMultiMessage(id=50, message="Legacy msg", chat=chat)]

    mock_client = MockMultiAsyncTelegramClient(channels_messages={"@legacy_chan": msgs})
    collector = TelegramCollector(client=mock_client, raw_storage_dir=tmp_path)  # type: ignore[arg-type]

    res = await collector.collect_channel("@legacy_chan", limit=1)

    assert isinstance(res, CollectionResult)
    assert res.channel == "@legacy_chan"
    assert res.raw_messages_count == 1
    assert res.canonical_messages_count == 1
    assert res.canonical_messages[0].canonical_id == "telegram:-100777:50"


# ==============================================================================
# 4. Failure Isolation Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_failure_isolation_continues_collection(tmp_path):
    """15. Test that an inaccessible or private channel does not terminate collection of other channels."""
    chat_a = MockMultiChat(id=-1001, username="good_a", title="Channel A")
    chat_c = MockMultiChat(id=-1003, username="good_c", title="Channel C")

    msgs_a = [MockMultiMessage(id=101, message="Message A", chat=chat_a)]
    msgs_c = [MockMultiMessage(id=301, message="Message C", chat=chat_c)]

    from telethon.errors import ChannelPrivateError

    mock_client = MockMultiAsyncTelegramClient(
        channels_messages={"@good_a": msgs_a, "@good_c": msgs_c},
        failing_channels={"@bad_b": ChannelPrivateError(request=None)},
    )

    collector = TelegramCollector(client=mock_client, raw_storage_dir=tmp_path)  # type: ignore[arg-type]

    multi_res = await collector.collect_sources(
        sources=["@good_a", "@bad_b", "@good_c"],
        limit=5,
    )

    assert multi_res.total_sources_requested == 3
    assert multi_res.successful_sources == 2
    assert multi_res.failed_sources == 1
    assert multi_res.total_raw_messages == 2
    assert multi_res.total_canonical_messages == 2

    # Verify Channel B was isolated and recorded
    assert "@bad_b" in multi_res.failed_channel_errors
    assert "Channel is private or inaccessible" in multi_res.failed_channel_errors["@bad_b"]

    # Verify Channel A and C were collected successfully
    assert multi_res.channel_results["@good_a"].canonical_messages_count == 1
    assert multi_res.channel_results["@good_c"].canonical_messages_count == 1


# ==============================================================================
# 5. Provenance & Canonical IDs Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_provenance_and_canonical_id_integrity(tmp_path):
    """16. Test that chat_id and message_id form strictly scoped telegram:{chat_id}:{message_id} IDs."""
    chat = MockMultiChat(id=-100888999, username="intel_wire", title="Intel Wire")
    msgs = [MockMultiMessage(id=777, message="Surveillance dispatch", chat=chat)]

    mock_client = MockMultiAsyncTelegramClient(channels_messages={"@intel_wire": msgs})
    collector = TelegramCollector(client=mock_client, raw_storage_dir=tmp_path)  # type: ignore[arg-type]

    res = await collector.collect_sources(sources=["@intel_wire"])
    msg = res.canonical_messages[0]

    assert msg.platform == Platform.TELEGRAM
    assert msg.native_id == "777"
    assert msg.author_id == "-100888999"
    assert msg.author_username == "intel_wire"
    assert msg.channel_title == "Intel Wire"
    assert msg.canonical_id == "telegram:-100888999:777"
    assert "raw_reference" in msg.model_dump()
    assert msg.raw_reference.endswith(":1")


# ==============================================================================
# 6. Deduplication Across Channels Tests
# ==============================================================================

def test_deduplication_same_channel_vs_different_channels():
    """17. Test Milestone 3C quality deduplication on multi-channel records.
    
    - Same chat + same message ID -> deduplicated to 1 record.
    - Different chats + same native message ID -> preserved as 2 distinct records.
    """
    now = datetime(2026, 9, 6, 12, 0, 0, tzinfo=timezone.utc)

    # Message 10 from Channel A
    msg_a = CanonicalMessage(
        canonical_id="telegram:-100111:10",
        platform=Platform.TELEGRAM,
        native_id="10",
        author_id="-100111",
        author_username="channel_a",
        author_type=AuthorType.CHANNEL,
        published_at=now,
        collected_at=now,
        text_content="Alpha update 10",
        media_types=[],
        has_media=False,
        is_forward=False,
        is_repost=False,
        reactions={},
        urls=[],
        hashtags=[],
        mentions=[],
        raw_reference="a.jsonl:1",
    )

    # Duplicate of Message 10 from Channel A (e.g. from repeated collection)
    msg_a_dup = CanonicalMessage(
        canonical_id="telegram:-100111:10",
        platform=Platform.TELEGRAM,
        native_id="10",
        author_id="-100111",
        author_username="channel_a",
        author_type=AuthorType.CHANNEL,
        published_at=now,
        collected_at=now,
        text_content="Alpha update 10",
        media_types=[],
        has_media=False,
        is_forward=False,
        is_repost=False,
        reactions={},
        urls=[],
        hashtags=[],
        mentions=[],
        raw_reference="a_repeat.jsonl:1",
    )

    # Message 10 from Channel B (same native_id 10, but different chat_id -100222!)
    msg_b = CanonicalMessage(
        canonical_id="telegram:-100222:10",
        platform=Platform.TELEGRAM,
        native_id="10",
        author_id="-100222",
        author_username="channel_b",
        author_type=AuthorType.CHANNEL,
        published_at=now,
        collected_at=now,
        text_content="Bravo update 10",
        media_types=[],
        has_media=False,
        is_forward=False,
        is_repost=False,
        reactions={},
        urls=[],
        hashtags=[],
        mentions=[],
        raw_reference="b.jsonl:1",
    )

    clean_messages, report = process_quality(
        [msg_a, msg_a_dup, msg_b],
        dataset_platform="telegram",
    )

    assert report.records_seen == 3
    assert report.duplicates_detected == 1
    assert len(clean_messages) == 2

    clean_ids = {m.canonical_id for m in clean_messages}
    assert clean_ids == {"telegram:-100111:10", "telegram:-100222:10"}


# ==============================================================================
# 7. End-to-End Replay & Parquet Round-Trip Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_multi_source_jsonl_replay_and_parquet_round_trip(tmp_path):
    """18. Test full flow: multi-source collect -> raw JSONL -> replay -> Parquet round-trip."""
    raw_dir = tmp_path / "raw" / "telegram"
    chat_a = MockMultiChat(id=-100111, username="source_a", title="Source A")
    chat_b = MockMultiChat(id=-100222, username="source_b", title="Source B")

    msgs_a = [MockMultiMessage(id=1, message="Source A report", chat=chat_a)]
    msgs_b = [MockMultiMessage(id=2, message="Source B report", chat=chat_b)]

    mock_client = MockMultiAsyncTelegramClient(
        channels_messages={"@source_a": msgs_a, "@source_b": msgs_b}
    )

    collector = TelegramCollector(client=mock_client, raw_storage_dir=raw_dir)  # type: ignore[arg-type]
    multi_res = await collector.collect_sources(sources=["@source_a", "@source_b"])

    assert multi_res.total_raw_messages == 2

    # Replay directory
    summary = TelegramJSONLReplayer.run(raw_dir)
    assert summary.files_processed == 2
    assert summary.records_normalized == 2

    # Parquet conversion
    parquet_file = tmp_path / "processed" / "multi_telegram.parquet"
    dataset_summary = build_processed_dataset(
        input_raw_path=raw_dir,
        output_parquet_path=parquet_file,
    )
    assert dataset_summary.records_written == 2
    assert parquet_file.exists()

    # Read back and verify both source identities are preserved
    read_back = read_canonical_messages(parquet_file)
    assert len(read_back) == 2
    usernames = {m.author_username for m in read_back}
    assert usernames == {"source_a", "source_b"}
