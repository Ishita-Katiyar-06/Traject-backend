"""Comprehensive test suite for Fresh Temporal Engagement Observation Infrastructure (Milestone 7B).

Verifies:
1. Observation schema validation (Pydantic v2, extra="forbid").
2. UTC timezone-awareness enforcement and normalization.
3. Non-negative metric validation.
4. Multiple observations allowed for the same canonical_id.
5. Idempotent storage: same (canonical_id, observed_at) is deduplicated.
6. Temporal distinction: same canonical_id + different observed_at creates separate records.
7. Reaction map preservation (emoji -> count).
8. Total reactions calculation.
9. Reaction delta calculation when emoji types appear or disappear.
10. Engagement metric deltas and rates of change per hour.
11. Missing engagement values handled safely (None preservation).
12. Decreasing counters flagged as anomalous, never clamped or fabricated.
13. Canonical message deduplication is NOT modified (still one row per canonical_id).
14. Arrow schema serialization roundtrip.
15. Incremental runner integration with observation persistence and re-observation.
16. End-to-end multi-observation workflow: canonical remains 1 row, observation store has multiple rows.
"""

from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from pydantic import ValidationError

from app.collectors.telegram.collector import CollectionResult, TelegramCollector
from app.collectors.telegram.incremental_runner import (
    IncrementalRunConfig,
    IncrementalRunManifest,
    TelegramIncrementalRunner,
)
from app.schemas.canonical_message import AuthorType, CanonicalMessage, Platform
from app.schemas.engagement_observation import EngagementObservation
from app.storage.engagement_observations import (
    append_engagement_observations,
    read_engagement_observations,
    write_engagement_observations,
)
from app.storage.parquet import append_canonical_messages, read_canonical_messages
from app.temporal.observation_metrics import (
    calculate_reaction_deltas,
    calculate_total_reactions,
    compute_engagement_delta,
    compute_observation_series,
)


def _make_canonical_message(
    canonical_id: str = "telegram:12345:101",
    published_at: datetime | None = None,
    collected_at: datetime | None = None,
    views: int | None = 100,
    forwards: int | None = 5,
    replies: int | None = 2,
    reactions: dict[str, int] | None = None,
    author_id: str | None = None,
) -> CanonicalMessage:
    pub = published_at or datetime(2026, 9, 1, 12, 0, tzinfo=timezone.utc)
    coll = collected_at or datetime(2026, 9, 1, 13, 0, tzinfo=timezone.utc)
    rx = reactions if reactions is not None else {"👍": 10, "🔥": 3}
    parts = canonical_id.split(":")
    aid = author_id or (parts[1] if len(parts) == 3 else "12345")
    nid = parts[-1]
    return CanonicalMessage(
        canonical_id=canonical_id,
        platform=Platform.TELEGRAM,
        native_id=nid,
        author_id=aid,
        author_type=AuthorType.CHANNEL,
        published_at=pub,
        collected_at=coll,
        text_content="Test message content",
        views_count=views,
        forwards_count=forwards,
        replies_count=replies,
        reactions=rx,
    )


# ------------------------------------------------------------------------------
# 1. Observation Schema Validation
# ------------------------------------------------------------------------------

def test_observation_schema_valid():
    """Verify that a valid EngagementObservation builds correctly."""
    now = datetime(2026, 9, 8, 14, 30, tzinfo=timezone.utc)
    obs_id = EngagementObservation.build_observation_id("telegram:100:200", now)
    obs = EngagementObservation(
        observation_id=obs_id,
        canonical_id="telegram:100:200",
        platform=Platform.TELEGRAM,
        native_id="200",
        channel_id="100",
        observed_at=now,
        views_count=500,
        forwards_count=20,
        replies_count=8,
        reactions={"👍": 15, "🔥": 5},
    )
    assert obs.canonical_id == "telegram:100:200"
    assert obs.views_count == 500
    assert obs.total_reactions == 20
    assert obs.reactions["👍"] == 15


def test_observation_schema_forbid_extra():
    """Verify that extra fields are rejected under extra='forbid'."""
    now = datetime(2026, 9, 8, 14, 30, tzinfo=timezone.utc)
    with pytest.raises(ValidationError):
        EngagementObservation(
            observation_id="obs_1",
            canonical_id="telegram:100:200",
            observed_at=now,
            views_count=100,
            unknown_arbitrary_field="invalid",  # type: ignore[call-arg]
        )


# ------------------------------------------------------------------------------
# 2. UTC Timestamp Validation
# ------------------------------------------------------------------------------

def test_observation_rejects_naive_datetime():
    """Verify that naive datetimes without timezone are rejected."""
    naive_dt = datetime(2026, 9, 8, 14, 30)
    with pytest.raises(ValidationError) as exc:
        EngagementObservation(
            observation_id="obs_1",
            canonical_id="telegram:100:200",
            observed_at=naive_dt,
            views_count=100,
        )
    assert "timezone-aware" in str(exc.value)


def test_observation_normalizes_non_utc_timezone():
    """Verify that non-UTC timezone-aware datetimes are normalized to UTC."""
    from datetime import timezone as tz, timedelta
    ist = tz(timedelta(hours=5, minutes=30))
    dt_ist = datetime(2026, 9, 8, 20, 0, tzinfo=ist)
    obs_id = EngagementObservation.build_observation_id("telegram:100:200", dt_ist)
    obs = EngagementObservation(
        observation_id=obs_id,
        canonical_id="telegram:100:200",
        observed_at=dt_ist,
        views_count=100,
    )
    assert obs.observed_at.tzinfo == timezone.utc
    assert obs.observed_at.hour == 14
    assert obs.observed_at.minute == 30


# ------------------------------------------------------------------------------
# 3. Non-Negative Metric Validation
# ------------------------------------------------------------------------------

def test_observation_rejects_negative_metrics():
    """Verify that negative metrics are rejected by pydantic validators."""
    now = datetime(2026, 9, 8, 14, 30, tzinfo=timezone.utc)
    with pytest.raises(ValidationError):
        EngagementObservation(
            observation_id="obs_1",
            canonical_id="telegram:100:200",
            observed_at=now,
            views_count=-1,
        )

    with pytest.raises(ValidationError):
        EngagementObservation(
            observation_id="obs_1",
            canonical_id="telegram:100:200",
            observed_at=now,
            forwards_count=-5,
        )

    with pytest.raises(ValidationError):
        EngagementObservation(
            observation_id="obs_1",
            canonical_id="telegram:100:200",
            observed_at=now,
            reactions={"👍": -2},
        )


# ------------------------------------------------------------------------------
# 4 & 6. Multiple Observations for Same Canonical ID
# ------------------------------------------------------------------------------

def test_multiple_observations_allowed_in_storage(tmp_path: Path):
    """Verify that the observation store permits multiple observations for the same canonical_id."""
    parquet_path = tmp_path / "observations.parquet"
    cid = "telegram:channel_1:1001"

    t0 = datetime(2026, 9, 8, 10, 0, tzinfo=timezone.utc)
    t1 = datetime(2026, 9, 8, 12, 0, tzinfo=timezone.utc)
    t2 = datetime(2026, 9, 8, 14, 0, tzinfo=timezone.utc)

    obs0 = EngagementObservation(
        observation_id=EngagementObservation.build_observation_id(cid, t0),
        canonical_id=cid,
        observed_at=t0,
        views_count=100,
        forwards_count=2,
    )
    obs1 = EngagementObservation(
        observation_id=EngagementObservation.build_observation_id(cid, t1),
        canonical_id=cid,
        observed_at=t1,
        views_count=250,
        forwards_count=7,
    )
    obs2 = EngagementObservation(
        observation_id=EngagementObservation.build_observation_id(cid, t2),
        canonical_id=cid,
        observed_at=t2,
        views_count=600,
        forwards_count=18,
    )

    appended1, total1 = append_engagement_observations(parquet_path, [obs0])
    assert appended1 == 1
    assert total1 == 1

    appended2, total2 = append_engagement_observations(parquet_path, [obs1, obs2])
    assert appended2 == 2
    assert total2 == 3

    stored = read_engagement_observations(parquet_path, canonical_id=cid)
    assert len(stored) == 3
    assert [s.views_count for s in stored] == [100, 250, 600]


# ------------------------------------------------------------------------------
# 5. Idempotency: Same (canonical_id, observed_at) is Deduplicated
# ------------------------------------------------------------------------------

def test_observation_ingestion_is_idempotent(tmp_path: Path):
    """Verify that repeating observation ingestion does NOT create duplicate rows."""
    parquet_path = tmp_path / "observations.parquet"
    cid = "telegram:channel_1:1001"
    t0 = datetime(2026, 9, 8, 10, 0, tzinfo=timezone.utc)

    obs = EngagementObservation(
        observation_id=EngagementObservation.build_observation_id(cid, t0),
        canonical_id=cid,
        observed_at=t0,
        views_count=100,
    )

    # First append
    appended1, total1 = append_engagement_observations(parquet_path, [obs])
    assert appended1 == 1
    assert total1 == 1

    # Second identical append (same canonical_id + same observed_at)
    appended2, total2 = append_engagement_observations(parquet_path, [obs])
    assert appended2 == 0  # No new records added!
    assert total2 == 1

    records = read_engagement_observations(parquet_path)
    assert len(records) == 1


# ------------------------------------------------------------------------------
# 7, 8, 9. Reaction Maps & Reaction Deltas
# ------------------------------------------------------------------------------

def test_reactions_preserved_and_totals_calculated():
    """Verify structured emoji reactions and total scalar calculation."""
    rx = {"👍": 42, "🔥": 12, "❤️": 7}
    now = datetime(2026, 9, 8, 10, 0, tzinfo=timezone.utc)
    obs = EngagementObservation(
        observation_id=EngagementObservation.build_observation_id("m1", now),
        canonical_id="m1",
        observed_at=now,
        reactions=rx,
    )
    assert obs.reactions == rx
    assert obs.total_reactions == 61
    assert calculate_total_reactions(rx) == 61


def test_reaction_deltas_with_appearing_and_disappearing_emojis():
    """Verify reaction delta calculations when reaction categories emerge or drop."""
    rx_early = {"👍": 10, "❤️": 5}
    rx_late = {"👍": 15, "🔥": 8}  # '❤️' absent (dropped to 0), '🔥' appeared

    deltas = calculate_reaction_deltas(rx_early, rx_late)
    assert deltas["👍"] == 5
    assert deltas["❤️"] == -5
    assert deltas["🔥"] == 8


# ------------------------------------------------------------------------------
# 10. Engagement Deltas & Rates of Change
# ------------------------------------------------------------------------------

def test_compute_engagement_delta_success():
    """Verify deterministic metric delta calculation between two observations."""
    t0 = datetime(2026, 9, 8, 10, 0, 0, tzinfo=timezone.utc)
    t1 = datetime(2026, 9, 8, 12, 0, 0, tzinfo=timezone.utc)  # 2 hours elapsed
    cid = "telegram:channel_1:200"

    obs0 = EngagementObservation(
        observation_id=EngagementObservation.build_observation_id(cid, t0),
        canonical_id=cid,
        observed_at=t0,
        views_count=1000,
        forwards_count=50,
        replies_count=10,
        reactions={"👍": 20, "🔥": 5},
    )
    obs1 = EngagementObservation(
        observation_id=EngagementObservation.build_observation_id(cid, t1),
        canonical_id=cid,
        observed_at=t1,
        views_count=1600,
        forwards_count=70,
        replies_count=14,
        reactions={"👍": 35, "🔥": 15},
    )

    delta = compute_engagement_delta(obs0, obs1)
    assert delta.canonical_id == cid
    assert delta.elapsed_seconds == 7200.0
    assert delta.delta_views == 600
    assert delta.views_rate_per_hour == pytest.approx(300.0)
    assert delta.delta_forwards == 20
    assert delta.forwards_rate_per_hour == pytest.approx(10.0)
    assert delta.delta_replies == 4
    assert delta.replies_rate_per_hour == pytest.approx(2.0)
    assert delta.delta_reactions_total == 25
    assert delta.reactions_rate_per_hour == pytest.approx(12.5)
    assert delta.delta_reactions_by_emoji == {"👍": 15, "🔥": 10}
    assert not delta.is_views_decrease
    assert not delta.anomalies


def test_compute_observation_series():
    """Verify compute_observation_series pairwise deltas across 3 chronological steps."""
    cid = "telegram:ch:1"
    t0 = datetime(2026, 9, 8, 10, 0, tzinfo=timezone.utc)
    t1 = datetime(2026, 9, 8, 11, 0, tzinfo=timezone.utc)
    t2 = datetime(2026, 9, 8, 13, 0, tzinfo=timezone.utc)

    o0 = EngagementObservation(
        observation_id=EngagementObservation.build_observation_id(cid, t0),
        canonical_id=cid,
        observed_at=t0,
        views_count=100,
    )
    o1 = EngagementObservation(
        observation_id=EngagementObservation.build_observation_id(cid, t1),
        canonical_id=cid,
        observed_at=t1,
        views_count=250,
    )
    o2 = EngagementObservation(
        observation_id=EngagementObservation.build_observation_id(cid, t2),
        canonical_id=cid,
        observed_at=t2,
        views_count=700,
    )

    # Supply out of order to verify automatic chronological sorting
    series = compute_observation_series([o2, o0, o1])
    assert len(series) == 2

    # Step 0 -> 1
    assert series[0].t0 == t0
    assert series[0].t1 == t1
    assert series[0].delta_views == 150
    assert series[0].views_rate_per_hour == pytest.approx(150.0)

    # Step 1 -> 2
    assert series[1].t0 == t1
    assert series[1].t1 == t2
    assert series[1].delta_views == 450
    assert series[1].views_rate_per_hour == pytest.approx(225.0)


# ------------------------------------------------------------------------------
# 11. Missing Engagement Values Handled Safely
# ------------------------------------------------------------------------------

def test_missing_engagement_values_handled_safely():
    """Verify that None engagement values do not raise exceptions and yield None deltas."""
    t0 = datetime(2026, 9, 8, 10, 0, tzinfo=timezone.utc)
    t1 = datetime(2026, 9, 8, 11, 0, tzinfo=timezone.utc)
    cid = "telegram:channel_1:200"

    obs0 = EngagementObservation(
        observation_id=EngagementObservation.build_observation_id(cid, t0),
        canonical_id=cid,
        observed_at=t0,
        views_count=None,
        forwards_count=10,
        replies_count=None,
    )
    obs1 = EngagementObservation(
        observation_id=EngagementObservation.build_observation_id(cid, t1),
        canonical_id=cid,
        observed_at=t1,
        views_count=500,
        forwards_count=None,
        replies_count=None,
    )

    delta = compute_engagement_delta(obs0, obs1)
    assert delta.delta_views is None
    assert delta.views_rate_per_hour is None
    assert delta.delta_forwards is None
    assert delta.delta_replies is None


# ------------------------------------------------------------------------------
# 12. Decreasing Counters Flagged As Anomalous, Not Fabricated
# ------------------------------------------------------------------------------

def test_decreasing_counters_preserved_faithfully_and_flagged():
    """Verify that unexpected decreases in counters are recorded as-is and flagged, not clamped."""
    t0 = datetime(2026, 9, 8, 10, 0, tzinfo=timezone.utc)
    t1 = datetime(2026, 9, 8, 11, 0, tzinfo=timezone.utc)
    cid = "telegram:channel_1:200"

    obs0 = EngagementObservation(
        observation_id=EngagementObservation.build_observation_id(cid, t0),
        canonical_id=cid,
        observed_at=t0,
        views_count=1000,
        forwards_count=50,
        reactions={"👍": 20},
    )
    obs1 = EngagementObservation(
        observation_id=EngagementObservation.build_observation_id(cid, t1),
        canonical_id=cid,
        observed_at=t1,
        views_count=900,  # Decreased by 100
        forwards_count=45,  # Decreased by 5
        reactions={"👍": 15},  # Decreased by 5
    )

    delta = compute_engagement_delta(obs0, obs1)
    # Must preserve real factual values faithfully
    assert delta.delta_views == -100
    assert delta.delta_forwards == -5
    assert delta.delta_reactions_total == -5
    # Must flag anomalies
    assert delta.is_views_decrease
    assert delta.is_forwards_decrease
    assert delta.is_reactions_decrease
    assert len(delta.anomalies) == 3


# ------------------------------------------------------------------------------
# 13 & 16. Canonical Message Deduplication vs Observation Multiplicity
# ------------------------------------------------------------------------------

def test_canonical_message_remains_single_row_while_observations_multiply(tmp_path: Path):
    """Verify that canonical Parquet discards duplicates while observation Parquet preserves multiple snapshots."""
    canonical_parquet = tmp_path / "canonical.parquet"
    observation_parquet = tmp_path / "observations.parquet"

    cid = "telegram:channel_1:9999"
    pub_dt = datetime(2026, 9, 1, 10, 0, tzinfo=timezone.utc)

    # Observation 1: Collected at Sep 6
    obs_t1 = datetime(2026, 9, 6, 12, 0, tzinfo=timezone.utc)
    msg1 = _make_canonical_message(
        canonical_id=cid,
        published_at=pub_dt,
        collected_at=obs_t1,
        views=5000,
        forwards=10,
    )
    obs1 = EngagementObservation.from_canonical_message(msg1, observed_at=obs_t1)

    # Ingest 1
    c_appended1, c_total1 = append_canonical_messages(canonical_parquet, [msg1])
    o_appended1, o_total1 = append_engagement_observations(observation_parquet, [obs1])

    assert c_appended1 == 1
    assert c_total1 == 1
    assert o_appended1 == 1
    assert o_total1 == 1

    # Observation 2: Re-observed at Sep 8 with updated engagement
    obs_t2 = datetime(2026, 9, 8, 14, 0, tzinfo=timezone.utc)
    msg2 = _make_canonical_message(
        canonical_id=cid,
        published_at=pub_dt,
        collected_at=obs_t2,
        views=5400,
        forwards=14,
    )
    obs2 = EngagementObservation.from_canonical_message(msg2, observed_at=obs_t2)

    # Ingest 2
    c_appended2, c_total2 = append_canonical_messages(canonical_parquet, [msg2])
    o_appended2, o_total2 = append_engagement_observations(observation_parquet, [obs2])

    # Canonical storage strictly rejected duplicate canonical_id!
    assert c_appended2 == 0
    assert c_total2 == 1

    # Observation storage strictly accepted new point-in-time measurement!
    assert o_appended2 == 1
    assert o_total2 == 2

    # Verify contents
    c_msgs = read_canonical_messages(canonical_parquet)
    assert len(c_msgs) == 1
    assert c_msgs[0].canonical_id == cid

    o_records = read_engagement_observations(observation_parquet, canonical_id=cid)
    assert len(o_records) == 2
    assert [o.observed_at for o in o_records] == [obs_t1, obs_t2]
    assert [o.views_count for o in o_records] == [5000, 5400]


# ------------------------------------------------------------------------------
# 14. Arrow Schema Serialization Roundtrip
# ------------------------------------------------------------------------------

def test_arrow_schema_roundtrip(tmp_path: Path):
    """Verify that EngagementObservation instances roundtrip faithfully through PyArrow Parquet."""
    parquet_file = tmp_path / "roundtrip.parquet"
    now = datetime(2026, 9, 8, 15, 0, tzinfo=timezone.utc)
    obs = EngagementObservation(
        observation_id=EngagementObservation.build_observation_id("telegram:10:20", now),
        canonical_id="telegram:10:20",
        platform=Platform.TELEGRAM,
        native_id="20",
        channel_id="10",
        observed_at=now,
        views_count=1234,
        forwards_count=45,
        replies_count=12,
        reactions={"👍": 100, "🔥": 25},
        raw_reference="batch_1.jsonl:42",
    )

    write_engagement_observations([obs], parquet_file)
    restored = read_engagement_observations(parquet_file)
    assert len(restored) == 1
    r = restored[0]
    assert r.observation_id == obs.observation_id
    assert r.canonical_id == obs.canonical_id
    assert r.platform == Platform.TELEGRAM
    assert r.native_id == "20"
    assert r.channel_id == "10"
    assert r.observed_at == now
    assert r.views_count == 1234
    assert r.forwards_count == 45
    assert r.replies_count == 12
    assert r.reactions == {"👍": 100, "🔥": 25}
    assert r.raw_reference == "batch_1.jsonl:42"


# ------------------------------------------------------------------------------
# 15. Incremental Runner Integration
# ------------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_incremental_runner_records_observations_and_reobserves(tmp_path: Path):
    """Verify that IncrementalRunner extracts and persists observations during collection."""
    mock_collector = MagicMock(spec=TelegramCollector)

    now = datetime(2026, 9, 8, 12, 0, tzinfo=timezone.utc)
    m1 = _make_canonical_message(
        canonical_id="telegram:src:101",
        published_at=now,
        collected_at=now,
        views=200,
    )
    obs1 = EngagementObservation.from_canonical_message(m1, observed_at=now)

    col_res = CollectionResult(
        channel="@test_source",
        target_entity_id=123,
        requested_limit=10,
        raw_messages_count=1,
        canonical_messages_count=1,
        raw_file_path=str(tmp_path / "raw.jsonl"),
        canonical_messages=[m1],
        engagement_observations=[obs1],
        max_message_id=101,
        latest_message_date=now.isoformat(),
    )
    mock_collector.collect_channel = AsyncMock(return_value=col_res)
    mock_collector.reobserve_channel = AsyncMock(return_value=col_res)

    cfg = IncrementalRunConfig(
        per_source_limit=10,
        sources=["@test_source"],
        dataset_name="test_messages",
        reobserve_recent=True,
        reobserve_limit=5,
    )

    runner = TelegramIncrementalRunner(
        config=cfg,
        collector=mock_collector,
        repo_root=tmp_path,
    )

    manifest = await runner.run()

    assert manifest.sources_succeeded == 1
    assert manifest.observations_generated >= 1
    assert manifest.observations_persisted >= 1
    assert Path(manifest.observation_store_path).exists()

    stored_obs = read_engagement_observations(manifest.observation_store_path)
    assert len(stored_obs) >= 1
    assert stored_obs[0].canonical_id == "telegram:src:101"
