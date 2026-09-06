"""Comprehensive failure and recovery test suite for Telegram incremental collection (Milestone 6D).

Validates:
1. First incremental run creates new checkpoint
2. Second run with no new messages maintains cursor
3. Second run with new messages advances cursor
4. Duplicate retrieval idempotency
5. Source failure isolation (Source A fails, Source B succeeds)
6. Checkpoint preservation after failure
7. Partial multi-source success checkpoint advance
8. Corrupted checkpoint detection and safe recovery
9. Missing checkpoint graceful initialization
10. Atomic checkpoint write behavior
11. Per-source checkpoint cursor isolation
12. Configurable per-source limit enforcement
13. Append-safe Parquet persistence
14. Incremental run manifest completeness and reproducibility
15. Pipeline status API integration with collection metadata
"""

from datetime import datetime, timezone
import json
from pathlib import Path
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.collectors.telegram.checkpoint import (
    SourceCheckpoint,
    TelegramCheckpointManager,
    TelegramCheckpointState,
)
from app.collectors.telegram.collector import CollectionResult, TelegramCollector
from app.collectors.telegram.incremental_runner import (
    IncrementalRunConfig,
    IncrementalRunManifest,
    TelegramIncrementalRunner,
)
from app.collectors.telegram.registry import SourceType, TelegramSourceEntry, TelegramSourceRegistry
from app.schemas.canonical_message import AuthorType, CanonicalMessage, Platform
from app.storage.parquet import (
    append_canonical_messages,
    read_canonical_messages,
    write_canonical_messages,
)


def _make_sample_canonical(
    msg_id: int,
    channel: str = "test_channel",
    text: str = "Sample update",
) -> CanonicalMessage:
    """Helper to synthesize deterministic CanonicalMessage domain records."""
    chat_id = f"1000_{channel}"
    return CanonicalMessage(
        canonical_id=f"telegram:{chat_id}:{msg_id}",
        platform=Platform.TELEGRAM,
        native_id=str(msg_id),
        author_id=chat_id,
        author_username=channel,
        author_type=AuthorType.CHANNEL,
        channel_title=f"Channel {channel}",
        subscriber_count=5000,
        published_at=datetime(2026, 9, 6, 12, 0, 0, tzinfo=timezone.utc),
        collected_at=datetime(2026, 9, 6, 12, 5, 0, tzinfo=timezone.utc),
        text_content=f"{text} #{msg_id}",
        language="en",
        media_types=[],
        has_media=False,
        is_forward=False,
        is_repost=False,
        origin_source_id=None,
        reply_to_id=None,
        thread_id=None,
        views_count=100,
        forwards_count=5,
        replies_count=2,
        reactions={"👍": 10},
        urls=[],
        hashtags=[],
        mentions=[],
        raw_reference=f"raw_{channel}.jsonl:{msg_id}",
    )


# ------------------------------------------------------------------------------
# Test 1 & 9: Missing Checkpoint Graceful Initialization & First Run
# ------------------------------------------------------------------------------

def test_missing_checkpoint_graceful_initialization(tmp_path: Path):
    """Verify that a missing checkpoint file initializes a fresh, valid state without error."""
    ckpt_file = tmp_path / "checkpoints" / "telegram" / "checkpoint.json"
    assert not ckpt_file.exists()

    mgr = TelegramCheckpointManager(ckpt_file)
    assert mgr.state.schema_version == 1
    assert len(mgr.state.sources) == 0
    assert mgr.get_source_checkpoint("@warmonitors") is None
    assert mgr.get_last_message_id("@warmonitors") is None


def test_first_run_creates_checkpoint(tmp_path: Path):
    """Verify that updating a source checkpoint persists it atomically to disk."""
    ckpt_file = tmp_path / "checkpoints" / "telegram" / "checkpoint.json"
    mgr = TelegramCheckpointManager(ckpt_file)

    mgr.update_source_checkpoint(
        source="@warmonitors",
        last_message_id=500,
        last_message_date="2026-09-06T12:00:00Z",
        messages_added=50,
        commit=True,
    )

    assert ckpt_file.is_file()
    mgr2 = TelegramCheckpointManager(ckpt_file)
    ckpt = mgr2.get_source_checkpoint("@warmonitors")
    assert ckpt is not None
    assert ckpt.last_message_id == 500
    assert ckpt.total_messages_collected == 50
    assert ckpt.last_message_date == "2026-09-06T12:00:00Z"


# ------------------------------------------------------------------------------
# Test 2: Second Run with No New Messages
# ------------------------------------------------------------------------------

def test_second_run_no_new_messages_preserves_cursor(tmp_path: Path):
    """Verify that a run with 0 new messages updates timestamp but preserves message ID cursor."""
    ckpt_file = tmp_path / "checkpoints" / "telegram" / "checkpoint.json"
    mgr = TelegramCheckpointManager(ckpt_file)

    mgr.update_source_checkpoint("@channel_a", last_message_id=1200, messages_added=10)
    initial_ckpt = mgr.get_source_checkpoint("@channel_a")
    assert initial_ckpt.last_message_id == 1200

    # Simulate 0 new messages
    updated = mgr.update_source_checkpoint("@channel_a", last_message_id=1200, messages_added=0)
    assert updated.last_message_id == 1200
    assert updated.total_messages_collected == 10


# ------------------------------------------------------------------------------
# Test 3: Second Run with New Messages Advances Cursor
# ------------------------------------------------------------------------------

def test_second_run_advances_cursor_monotonically(tmp_path: Path):
    """Verify that new messages advance cursor monotonically."""
    ckpt_file = tmp_path / "checkpoints" / "telegram" / "checkpoint.json"
    mgr = TelegramCheckpointManager(ckpt_file)

    mgr.update_source_checkpoint("@channel_a", last_message_id=1200, messages_added=10)
    # New message with id 1250 arrives
    updated = mgr.update_source_checkpoint("@channel_a", last_message_id=1250, messages_added=5)
    assert updated.last_message_id == 1250
    assert updated.total_messages_collected == 15

    # Attempting to set an older ID does not move cursor backwards
    older_attempt = mgr.update_source_checkpoint("@channel_a", last_message_id=1100, messages_added=0)
    assert older_attempt.last_message_id == 1250


# ------------------------------------------------------------------------------
# Test 4 & 13: Duplicate Retrieval Idempotency & Parquet Append
# ------------------------------------------------------------------------------

def test_parquet_append_deduplication_idempotency(tmp_path: Path):
    """Verify that repeated append runs with identical records are 100% idempotent."""
    parquet_path = tmp_path / "test.parquet"
    messages_batch_1 = [_make_sample_canonical(i) for i in range(1, 11)]

    # Initial append
    new_count, total_count = append_canonical_messages(parquet_path, messages_batch_1)
    assert new_count == 10
    assert total_count == 10

    # Repeat exact same append
    new_count_2, total_count_2 = append_canonical_messages(parquet_path, messages_batch_1)
    assert new_count_2 == 0
    assert total_count_2 == 10  # Untouched

    # Append batch with overlap (5 old, 5 new)
    messages_batch_2 = [_make_sample_canonical(i) for i in range(6, 16)]
    new_count_3, total_count_3 = append_canonical_messages(parquet_path, messages_batch_2)
    assert new_count_3 == 5
    assert total_count_3 == 15

    # Verify all records loaded cleanly
    loaded = read_canonical_messages(parquet_path)
    assert len(loaded) == 15
    assert len({m.canonical_id for m in loaded}) == 15


# ------------------------------------------------------------------------------
# Test 5, 6, 7: Source Failure Isolation & Partial Success
# ------------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_incremental_source_failure_isolation(tmp_path: Path):
    """Verify that if Source A fails, Source A's checkpoint is preserved, and Source B still succeeds."""
    ckpt_file = tmp_path / "checkpoints" / "telegram" / "checkpoint.json"
    ckpt_mgr = TelegramCheckpointManager(ckpt_file)
    ckpt_mgr.update_source_checkpoint("@source_a", last_message_id=100)
    ckpt_mgr.update_source_checkpoint("@source_b", last_message_id=200)

    # Registry with two sources
    reg = TelegramSourceRegistry(
        version="1.0.0",
        sources=[
            TelegramSourceEntry(
                username="@source_a",
                domain="domain_a",
                expected_language="en",
                source_type=SourceType.OFFICIAL,
            ),
            TelegramSourceEntry(
                username="@source_b",
                domain="domain_b",
                expected_language="en",
                source_type=SourceType.OFFICIAL,
            ),
        ],
    )

    # Mock collector: Source A fails with network exception, Source B returns 2 new messages
    mock_collector = MagicMock(spec=TelegramCollector)

    async def mock_collect_channel(channel: str, limit: int = 100, min_id: int | None = None):
        if "@source_a" in channel:
            raise ConnectionResetError("Connection lost to Telegram DC")
        return CollectionResult(
            channel=channel,
            target_entity_id=999,
            requested_limit=limit,
            raw_messages_count=2,
            canonical_messages_count=2,
            raw_file_path=str(tmp_path / "raw_b.jsonl"),
            canonical_messages=[
                _make_sample_canonical(201, channel="source_b"),
                _make_sample_canonical(202, channel="source_b"),
            ],
            max_message_id=202,
            min_message_id=201,
            latest_message_date="2026-09-06T15:00:00Z",
        )

    mock_collector.collect_channel = AsyncMock(side_effect=mock_collect_channel)

    config = IncrementalRunConfig(
        per_source_limit=10,
        sources=["@source_a", "@source_b"],
        dataset_name="test_corpus",
    )

    runner = TelegramIncrementalRunner(
        config=config,
        checkpoint_manager=ckpt_mgr,
        registry=reg,
        collector=mock_collector,
        repo_root=tmp_path,
    )

    manifest = await runner.run()

    # Manifest verification
    assert manifest.sources_attempted == 2
    assert manifest.sources_succeeded == 1
    assert manifest.sources_failed == 1
    assert "@source_a" in manifest.failed_sources
    assert "ConnectionResetError" in manifest.failed_sources["@source_a"]

    # Checkpoint verification: Source A unchanged, Source B advanced to 202
    assert ckpt_mgr.get_last_message_id("@source_a") == 100
    assert ckpt_mgr.get_last_message_id("@source_b") == 202

    # Verify Parquet only contains Source B's messages
    parquet_path = tmp_path / "data" / "processed" / "telegram" / "test_corpus.parquet"
    assert parquet_path.is_file()
    saved_records = read_canonical_messages(parquet_path)
    assert len(saved_records) == 2
    assert all(m.author_username == "source_b" for m in saved_records)


# ------------------------------------------------------------------------------
# Test 8: Corrupted Checkpoint Detection & Safe Recovery
# ------------------------------------------------------------------------------

def test_corrupted_checkpoint_recovery(tmp_path: Path):
    """Verify that a malformed JSON checkpoint triggers automated backup and safe re-initialization."""
    ckpt_file = tmp_path / "checkpoints" / "telegram" / "checkpoint.json"
    ckpt_file.parent.mkdir(parents=True, exist_ok=True)
    with open(ckpt_file, "w", encoding="utf-8") as f:
        f.write("{ INVALID JSON DATA <<<")

    mgr = TelegramCheckpointManager(ckpt_file)
    assert mgr.state.schema_version == 1
    assert len(mgr.state.sources) == 0

    # Verify backup file was created
    bak_files = list(ckpt_file.parent.glob("*.bak"))
    assert len(bak_files) == 1
    with open(bak_files[0], "r", encoding="utf-8") as f:
        assert f.read() == "{ INVALID JSON DATA <<<"


# ------------------------------------------------------------------------------
# Test 10: Atomic Checkpoint Write
# ------------------------------------------------------------------------------

def test_atomic_checkpoint_persistence(tmp_path: Path):
    """Verify that saving checkpoint produces no dangling .tmp files and is valid JSON."""
    ckpt_file = tmp_path / "checkpoints" / "telegram" / "checkpoint.json"
    mgr = TelegramCheckpointManager(ckpt_file)

    mgr.update_source_checkpoint("@src1", last_message_id=42, commit=True)
    assert ckpt_file.is_file()
    assert not (ckpt_file.parent / "checkpoint.tmp").exists()

    with open(ckpt_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert data["schema_version"] == 1
    assert "@src1" in data["sources"]
    assert data["sources"]["@src1"]["last_message_id"] == 42


# ------------------------------------------------------------------------------
# Test 11: Per-Source Isolation
# ------------------------------------------------------------------------------

def test_per_source_checkpoint_isolation(tmp_path: Path):
    """Verify that updating one source doesn't affect other sources."""
    ckpt_file = tmp_path / "checkpoints" / "telegram" / "checkpoint.json"
    mgr = TelegramCheckpointManager(ckpt_file)

    mgr.update_source_checkpoint("@alpha", last_message_id=10)
    mgr.update_source_checkpoint("@beta", last_message_id=20)
    mgr.update_source_checkpoint("@gamma", last_message_id=30)

    mgr.update_source_checkpoint("@beta", last_message_id=25)

    assert mgr.get_last_message_id("@alpha") == 10
    assert mgr.get_last_message_id("@beta") == 25
    assert mgr.get_last_message_id("@gamma") == 30


# ------------------------------------------------------------------------------
# Test 12: Limit Enforcement
# ------------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_per_source_limit_passed_to_collector(tmp_path: Path):
    """Verify that the configured per-source limit is strictly honored during collection."""
    mock_collector = MagicMock(spec=TelegramCollector)
    mock_collector.collect_channel = AsyncMock(
        return_value=CollectionResult(
            channel="@test",
            target_entity_id=1,
            requested_limit=15,
            raw_messages_count=0,
            canonical_messages_count=0,
            raw_file_path="",
        )
    )

    reg = TelegramSourceRegistry(
        sources=[
            TelegramSourceEntry(
                username="@test",
                domain="domain_x",
                expected_language="en",
                source_type=SourceType.OFFICIAL,
            )
        ]
    )

    config = IncrementalRunConfig(per_source_limit=15, sources=["@test"])
    runner = TelegramIncrementalRunner(
        config=config,
        checkpoint_manager=TelegramCheckpointManager(tmp_path / "ckpt.json"),
        registry=reg,
        collector=mock_collector,
        repo_root=tmp_path,
    )

    await runner.run()
    mock_collector.collect_channel.assert_called_once_with(channel="@test", limit=15, min_id=None)


# ------------------------------------------------------------------------------
# Test 14: Manifest Generation and Completeness
# ------------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_incremental_manifest_structure(tmp_path: Path):
    """Verify that incremental runs produce complete, valid manifest files with no leaked secrets."""
    mock_collector = MagicMock(spec=TelegramCollector)
    mock_collector.collect_channel = AsyncMock(
        return_value=CollectionResult(
            channel="@test_ch",
            target_entity_id=100,
            requested_limit=10,
            raw_messages_count=1,
            canonical_messages_count=1,
            raw_file_path=str(tmp_path / "raw.jsonl"),
            canonical_messages=[_make_sample_canonical(101, channel="test_ch")],
            max_message_id=101,
            min_message_id=101,
            latest_message_date="2026-09-06T18:00:00Z",
        )
    )

    config = IncrementalRunConfig(sources=["@test_ch"], dataset_name="test_dataset")
    runner = TelegramIncrementalRunner(
        config=config,
        checkpoint_manager=TelegramCheckpointManager(tmp_path / "ckpt.json"),
        collector=mock_collector,
        repo_root=tmp_path,
    )

    manifest = await runner.run()

    # Verify manifest file exists on disk
    manifest_dir = tmp_path / "data" / "manifests" / "telegram" / "incremental"
    manifest_files = list(manifest_dir.glob("manifest_*.json"))
    assert len(manifest_files) >= 1

    with open(manifest_files[0], "r", encoding="utf-8") as f:
        data = json.load(f)

    # Check required fields
    required_keys = [
        "run_id",
        "started_at_utc",
        "completed_at_utc",
        "mode",
        "configuration",
        "sources_attempted",
        "sources_succeeded",
        "sources_failed",
        "failed_sources",
        "per_source_metrics",
        "total_raw_fetched",
        "total_canonical_normalized",
        "total_new_canonical_persisted",
        "total_duplicates_discarded",
        "cumulative_corpus_count",
        "corpus_snapshot_id",
    ]
    for key in required_keys:
        assert key in data, f"Missing manifest key: {key}"

    # Verify no secret keywords exist in manifest
    manifest_str = json.dumps(data)
    for forbidden in ["api_hash", "session_string", "phone", "password", "cloud_password"]:
        assert forbidden not in manifest_str


# ------------------------------------------------------------------------------
# Test 15: Pipeline Status API Integration
# ------------------------------------------------------------------------------

def test_pipeline_status_response_schema_with_6d_fields():
    """Verify that PipelineStatusResponse model validates all additive Milestone 6D fields."""
    from app.schemas.api.pipeline import PipelineStatusResponse

    payload = {
        "status": "completed",
        "dataset_source": "telegram_messages",
        "created_at_utc": "2026-09-06T19:00:00Z",
        "pipeline_version": "4h.v1",
        "cache_status": None,
        "collection_mode": "incremental",
        "last_collection_run": "2026-09-06T19:30:00Z",
        "last_successful_collection": "2026-09-06T19:30:00Z",
        "source_count": 13,
        "successful_source_count": 13,
        "failed_source_count": 0,
        "last_new_record_count": 42,
        "cumulative_record_count": 6078,
        "corpus_snapshot_id": "corpus_snapshot_20260906_193000",
        "analytics_generated_at": "2026-09-06T19:00:00Z",
    }

    model = PipelineStatusResponse.model_validate(payload)
    assert model.collection_mode == "incremental"
    assert model.cumulative_record_count == 6078
    assert model.corpus_snapshot_id == "corpus_snapshot_20260906_193000"


# ------------------------------------------------------------------------------
# Test 16: Two Consecutive Incremental Runs (Run 1 -> Checkpoint -> Run 2)
# ------------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_incremental_runner_two_consecutive_runs(tmp_path: Path):
    """Verify that Run 1 collects messages and creates checkpoint, and Run 2 queries with min_id."""
    ckpt_file = tmp_path / "checkpoints" / "telegram" / "checkpoint.json"
    ckpt_mgr = TelegramCheckpointManager(ckpt_file)
    mock_collector = MagicMock(spec=TelegramCollector)

    call_history = []

    async def mock_collect(channel: str, limit: int = 100, min_id: int | None = None):
        call_history.append({"channel": channel, "limit": limit, "min_id": min_id})
        if min_id is None:
            # Run 1: Returns 3 messages
            return CollectionResult(
                channel=channel,
                target_entity_id=555,
                requested_limit=limit,
                raw_messages_count=3,
                canonical_messages_count=3,
                raw_file_path=str(tmp_path / "raw1.jsonl"),
                canonical_messages=[
                    _make_sample_canonical(10, channel="test"),
                    _make_sample_canonical(11, channel="test"),
                    _make_sample_canonical(12, channel="test"),
                ],
                max_message_id=12,
                min_message_id=10,
                latest_message_date="2026-09-06T12:00:00Z",
            )
        else:
            # Run 2: Only messages newer than min_id (none available)
            assert min_id == 12
            return CollectionResult(
                channel=channel,
                target_entity_id=555,
                requested_limit=limit,
                raw_messages_count=0,
                canonical_messages_count=0,
                raw_file_path="",
                canonical_messages=[],
                max_message_id=None,
                min_message_id=None,
            )

    mock_collector.collect_channel = AsyncMock(side_effect=mock_collect)

    config = IncrementalRunConfig(sources=["@test"], dataset_name="test_corpus")
    runner = TelegramIncrementalRunner(
        config=config,
        checkpoint_manager=ckpt_mgr,
        collector=mock_collector,
        repo_root=tmp_path,
    )

    # RUN 1
    m1 = await runner.run()
    assert m1.total_new_canonical_persisted == 3
    assert m1.cumulative_corpus_count == 3
    assert ckpt_mgr.get_last_message_id("@test") == 12

    # RUN 2
    m2 = await runner.run()
    assert m2.total_new_canonical_persisted == 0
    assert m2.cumulative_corpus_count == 3
    assert ckpt_mgr.get_last_message_id("@test") == 12

    assert len(call_history) == 2
    assert call_history[0]["min_id"] is None
    assert call_history[1]["min_id"] == 12


# ------------------------------------------------------------------------------
# Test 17: TelegramCollector collect_channel min_id parameter verification
# ------------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_collector_collect_channel_passes_min_id_to_telethon(tmp_path: Path):
    """Verify that TelegramCollector forwards min_id to client.iter_messages."""
    fake_client = MagicMock()
    fake_client.is_connected.return_value = True
    fake_client.is_user_authorized = AsyncMock(return_value=True)

    fake_entity = MagicMock()
    fake_entity.id = 12345
    fake_client.get_entity = AsyncMock(return_value=fake_entity)

    # Mock async generator for iter_messages
    async def mock_iter_messages(entity, **kwargs):
        assert kwargs.get("min_id") == 777
        assert kwargs.get("limit") == 50
        if False:
            yield None  # empty generator

    fake_client.iter_messages = mock_iter_messages

    collector = TelegramCollector(
        client=fake_client,
        raw_storage_dir=tmp_path / "raw",
    )

    res = await collector.collect_channel("@test_chan", limit=50, min_id=777)
    assert res.channel == "@test_chan"
    assert res.raw_messages_count == 0


# ------------------------------------------------------------------------------
# Test 18: ArtifactRepository reads latest incremental manifest
# ------------------------------------------------------------------------------

def test_artifact_repository_reads_latest_incremental_manifest(tmp_path: Path):
    """Verify that ArtifactRepository loads 6D metadata from latest_manifest.json."""
    from app.repositories.artifact_repository import ArtifactRepository

    manifest_dir = tmp_path / "data" / "manifests" / "telegram" / "incremental"
    manifest_dir.mkdir(parents=True, exist_ok=True)
    latest_manifest_file = manifest_dir / "latest_manifest.json"

    manifest_data = {
        "run_id": "incremental_20260906_200000",
        "started_at_utc": "2026-09-06T20:00:00Z",
        "completed_at_utc": "2026-09-06T20:01:00Z",
        "mode": "incremental",
        "sources_attempted": 13,
        "sources_succeeded": 13,
        "sources_failed": 0,
        "total_new_canonical_persisted": 25,
        "cumulative_corpus_count": 6061,
        "corpus_snapshot_id": "corpus_snapshot_20260906_200100",
    }
    with open(latest_manifest_file, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f)

    repo = ArtifactRepository()
    repo.repo_root = tmp_path
    repo.artifacts_loaded = True
    repo.dataset_source = "telegram_messages"
    repo.created_at_utc = "2026-09-06T19:00:00Z"
    repo.pipeline_version = "4h.v1"

    status = repo.get_pipeline_status()
    assert status.collection_mode == "incremental"
    assert status.last_collection_run == "2026-09-06T20:01:00Z"
    assert status.last_new_record_count == 25
    assert status.cumulative_record_count == 6061
    assert status.corpus_snapshot_id == "corpus_snapshot_20260906_200100"
