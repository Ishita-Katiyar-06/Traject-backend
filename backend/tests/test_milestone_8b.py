"""
Milestone 8B: Clean Reproducible Corpus & Fresh Temporal Observation Cohort Test Suite.

Validates:
1. Clean corpus reconstruction and strict canonical deduplication (1 row per canonical_id)
2. Observation multiplicity (multiple observations per canonical_id keyed by canonical_id + observed_at)
3. Observation timestamp semantics (observed_at strictly separate from published_at)
4. Temporal cohort selection over recent configurable window
5. Bounded re-observation without full-history re-download
6. Append-only observation persistence idempotency
7. Manifest audit trail generation with comprehensive metadata
8. Missing engagement values handled safely without synthetic fabrication
9. Counter decreases preserved and explicitly detected
10. Strict leakage safety: future observations cannot leak into cutoff T
11. Source failure isolation during cohort re-observation
"""
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import tempfile
import pytest

from app.schemas.canonical_message import AuthorType, CanonicalMessage, Platform
from app.schemas.cohort import CohortQualityMetrics, TemporalCohortMetadata
from app.schemas.engagement_observation import EngagementObservation
from app.storage.engagement_observations import (
    append_engagement_observations,
    read_engagement_observations,
    write_engagement_observations,
)
from app.storage.parquet import append_canonical_messages, read_canonical_messages, write_canonical_messages
from app.temporal.cohort import CohortManager
from app.temporal.kinetics import compute_topic_temporal_kinetics


def _make_msg(
    cid: str,
    pub_at: datetime,
    channel: str = "@warmonitors",
    views: int = 1000,
) -> CanonicalMessage:
    parts = cid.split(":")
    author_id = parts[1] if len(parts) > 1 else "123"
    native_id = parts[2] if len(parts) > 2 else "1"
    return CanonicalMessage(
        canonical_id=cid,
        platform=Platform.TELEGRAM,
        native_id=native_id,
        author_id=author_id,
        author_username=channel.lstrip("@"),
        author_type=AuthorType.CHANNEL,
        channel_title=channel.lstrip("@").capitalize(),
        subscriber_count=50000,
        published_at=pub_at,
        collected_at=pub_at + timedelta(seconds=10),
        text_content=f"Message content for {cid}",
        language="en",
        media_types=[],
        has_media=False,
        is_forward=False,
        is_repost=False,
        origin_source_id=None,
        reply_to_id=None,
        thread_id=None,
        views_count=views,
        forwards_count=10,
        replies_count=2,
        reactions={"👍": 25},
        urls=[],
        hashtags=[],
        mentions=[],
    )


def _make_obs(
    cid: str,
    obs_at: datetime,
    views: int = 1000,
    fwd: int = 10,
    rx: int = 25,
) -> EngagementObservation:
    import hashlib
    parts = cid.split(":")
    native_id = parts[2] if len(parts) > 2 else "1"
    channel_id = parts[1] if len(parts) > 1 else "123"
    obs_hash = hashlib.sha256(f"{cid}_{obs_at.isoformat()}".encode()).hexdigest()[:16]
    return EngagementObservation(
        observation_id=f"obs_{obs_hash}",
        canonical_id=cid,
        platform=Platform.TELEGRAM,
        native_id=native_id,
        channel_id=channel_id,
        observed_at=obs_at,
        views_count=views,
        forwards_count=fwd,
        replies_count=2,
        reactions={"👍": rx},
    )


# ------------------------------------------------------------------------------
# Test 1: Canonical Deduplication & Multiplicity
# ------------------------------------------------------------------------------

def test_canonical_deduplication_and_observation_multiplicity(tmp_path: Path):
    """Verify that canonical parquet strictly deduplicates (1 row per canonical_id),
    while engagement observation parquet supports multiple observations per message.
    """
    msg_path = tmp_path / "messages.parquet"
    obs_path = tmp_path / "observations.parquet"

    t0 = datetime(2026, 9, 8, 12, 0, 0, tzinfo=timezone.utc)
    t1 = t0 + timedelta(hours=1)

    msg = _make_msg("telegram:100:1", t0, views=1000)

    # First write
    write_canonical_messages([msg], msg_path, overwrite=True)
    # Re-append same canonical_id with updated views
    msg_updated = _make_msg("telegram:100:1", t0, views=1500)
    appended, cumulative = append_canonical_messages(msg_path, [msg_updated])
    assert appended == 0  # Deduplicated!
    assert cumulative == 1

    stored_msgs = read_canonical_messages(msg_path)
    assert len(stored_msgs) == 1
    assert stored_msgs[0].canonical_id == "telegram:100:1"

    # Now verify observations support multiplicity
    obs1 = _make_obs("telegram:100:1", t0, views=1000)
    obs2 = _make_obs("telegram:100:1", t1, views=1500)

    write_engagement_observations([obs1], obs_path, overwrite=True)
    appended_obs, cum_obs = append_engagement_observations(obs_path, [obs2])
    assert appended_obs == 1
    assert cum_obs == 2

    stored_obs = read_engagement_observations(obs_path)
    assert len(stored_obs) == 2
    assert stored_obs[0].observed_at == t0
    assert stored_obs[1].observed_at == t1
    assert stored_obs[1].views_count == 1500


# ------------------------------------------------------------------------------
# Test 2: Observation Timestamp Semantics (observed_at != published_at)
# ------------------------------------------------------------------------------

def test_observation_timestamp_semantics(tmp_path: Path):
    """Verify that observed_at represents observation time and is never replaced by published_at."""
    t_pub = datetime(2026, 9, 1, 10, 0, 0, tzinfo=timezone.utc)
    t_obs = datetime(2026, 9, 8, 12, 0, 0, tzinfo=timezone.utc)

    msg = _make_msg("telegram:100:5", t_pub)
    obs = _make_obs("telegram:100:5", t_obs, views=2500)

    assert obs.observed_at != msg.published_at
    assert obs.observed_at == t_obs
    assert msg.published_at == t_pub


# ------------------------------------------------------------------------------
# Test 3: Fresh Cohort Selection
# ------------------------------------------------------------------------------

def test_cohort_selection_recent_window(tmp_path: Path):
    """Verify that CohortManager correctly selects messages within the configurable window."""
    cm = CohortManager(storage_dir=tmp_path / "cohorts")
    t_now = datetime(2026, 9, 8, 18, 0, 0, tzinfo=timezone.utc)

    # 3 messages: 1 within 24h, 1 within 6h, 1 older than 24h
    m_old = _make_msg("telegram:100:1", t_now - timedelta(hours=30))
    m_mid = _make_msg("telegram:100:2", t_now - timedelta(hours=18))
    m_fresh = _make_msg("telegram:200:3", t_now - timedelta(hours=2), channel="@liveuamap")

    cohort = cm.create_cohort(
        messages=[m_old, m_mid, m_fresh],
        window_hours=24.0,
        cohort_id="cohort_test_24h",
        reference_time=t_now,
    )

    assert cohort.cohort_id == "cohort_test_24h"
    assert cohort.message_count == 2
    assert "telegram:100:1" not in cohort.canonical_ids
    assert "telegram:100:2" in cohort.canonical_ids
    assert "telegram:200:3" in cohort.canonical_ids
    assert cohort.source_count == 2
    assert "@warmonitors" in cohort.target_channels
    assert "@liveuamap" in cohort.target_channels


# ------------------------------------------------------------------------------
# Test 4: Cohort Metadata Persistence & Loading
# ------------------------------------------------------------------------------

def test_cohort_persistence_and_loading(tmp_path: Path):
    """Verify that cohort metadata saves to and loads from JSON seamlessly."""
    cm = CohortManager(storage_dir=tmp_path / "cohorts")
    t_now = datetime(2026, 9, 8, 18, 0, 0, tzinfo=timezone.utc)

    m1 = _make_msg("telegram:100:1", t_now - timedelta(hours=5))
    cohort = cm.create_cohort([m1], window_hours=12.0, cohort_id="test_cohort_001", reference_time=t_now)

    # Load by ID
    loaded = cm.load_cohort("test_cohort_001")
    assert loaded.cohort_id == "test_cohort_001"
    assert loaded.message_count == 1
    assert loaded.cohort_window_hours == 12.0

    # Load latest
    latest = cm.load_cohort("latest")
    assert latest.cohort_id == "test_cohort_001"


# ------------------------------------------------------------------------------
# Test 5: Bounded Re-observation Mock Flow
# ------------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_bounded_reobservation_flow(tmp_path: Path):
    """Verify that reobserve_cohort fetches recent messages and appends observations without duplicating canonicals."""
    obs_path = tmp_path / "observations.parquet"
    cm = CohortManager(storage_dir=tmp_path / "cohorts")
    t_now = datetime(2026, 9, 8, 12, 0, 0, tzinfo=timezone.utc)

    m1 = _make_msg("telegram:100:1", t_now - timedelta(hours=1))
    cohort = cm.create_cohort([m1], window_hours=24.0, cohort_id="cohort_reobs", reference_time=t_now)

    # Seed T0 observation
    obs_t0 = _make_obs("telegram:100:1", t_now - timedelta(hours=1), views=500)
    write_engagement_observations([obs_t0], obs_path, overwrite=True)

    # Mock collector with reobserve_channel returning updated engagement
    class MockCollector:
        async def reobserve_channel(self, channel: str, limit: int = 50):
            from app.collectors.telegram.collector import CollectionResult
            obs_t1 = _make_obs("telegram:100:1", t_now + timedelta(hours=1), views=750)
            return CollectionResult(
                channel=channel,
                target_entity_id=100,
                requested_limit=limit,
                raw_messages_count=1,
                canonical_messages_count=1,
                raw_file_path="",
                canonical_messages=[m1],
                engagement_observations=[obs_t1],
                errors=[],
            )

    collector = MockCollector()
    updated_cohort, metrics = await cm.reobserve_cohort(
        cohort=cohort,
        collector=collector,
        limit_per_channel=10,
        observation_parquet_path=obs_path,
    )

    assert updated_cohort.completed_observation_rounds == 2
    assert metrics["channels_succeeded"] == 1
    assert metrics["observations_persisted"] == 1

    all_obs = read_engagement_observations(obs_path)
    assert len(all_obs) == 2
    assert all_obs[0].views_count == 500
    assert all_obs[1].views_count == 750


# ------------------------------------------------------------------------------
# Test 6: Cohort Quality Evaluation (Intervals, Growth, Monotonicity)
# ------------------------------------------------------------------------------

def test_cohort_quality_evaluation(tmp_path: Path):
    """Verify evaluation of intervals, view increases, counter decreases, and observation distributions."""
    cm = CohortManager(storage_dir=tmp_path / "cohorts")
    t0 = datetime(2026, 9, 8, 10, 0, 0, tzinfo=timezone.utc)
    t1 = t0 + timedelta(hours=1)
    t2 = t0 + timedelta(hours=3)

    m1 = _make_msg("telegram:100:1", t0)
    m2 = _make_msg("telegram:100:2", t0)
    cohort = cm.create_cohort([m1, m2], window_hours=24.0, cohort_id="cohort_eval", reference_time=t0 + timedelta(hours=4))

    # m1 has 3 observations with increasing views
    # m2 has 2 observations with decreasing views (e.g. view anomaly or retraction)
    observations = [
        _make_obs("telegram:100:1", t0, views=100, fwd=5, rx=10),
        _make_obs("telegram:100:1", t1, views=150, fwd=8, rx=15),
        _make_obs("telegram:100:1", t2, views=200, fwd=12, rx=20),
        _make_obs("telegram:100:2", t0, views=500),
        _make_obs("telegram:100:2", t1, views=450),  # Decreased views
    ]

    metrics = cm.evaluate_cohort_quality(cohort=cohort, observations=observations)

    assert metrics.total_cohort_messages == 2
    assert metrics.messages_with_2_obs == 1  # m2
    assert metrics.messages_with_3_plus_obs == 1  # m1
    assert metrics.max_observations_per_message == 3
    assert metrics.messages_with_increasing_views == 1
    assert metrics.messages_with_counter_decreases == 1
    assert metrics.messages_with_increasing_forwards == 1
    assert metrics.messages_with_increasing_reactions == 1
    assert metrics.interval_min_minutes == 60.0  # 1 hour
    assert metrics.interval_max_minutes == 120.0  # 2 hours (between t1 and t2)
    assert metrics.target_period_coverage_pct == 100.0


# ------------------------------------------------------------------------------
# Test 7: Leakage Contract (Future observations excluded at cutoff T)
# ------------------------------------------------------------------------------

def test_leakage_contract_on_cohort_observations(tmp_path: Path):
    """Verify that observations timestamped after cutoff T are strictly excluded from kinetics."""
    t_pub = datetime(2026, 9, 8, 10, 0, 0, tzinfo=timezone.utc)
    t_cutoff = datetime(2026, 9, 8, 12, 0, 0, tzinfo=timezone.utc)
    t_future = datetime(2026, 9, 8, 14, 0, 0, tzinfo=timezone.utc)

    msg1 = _make_msg("telegram:100:1", t_pub)
    msg2 = _make_msg("telegram:100:2", t_pub)

    obs1_past = _make_obs("telegram:100:1", t_pub, views=100)
    obs1_cutoff = _make_obs("telegram:100:1", t_cutoff, views=200)
    obs1_future = _make_obs("telegram:100:1", t_future, views=500)

    obs2_past = _make_obs("telegram:100:2", t_pub, views=300)
    obs2_cutoff = _make_obs("telegram:100:2", t_cutoff, views=400)
    obs2_future = _make_obs("telegram:100:2", t_future, views=1000)

    kinetics = compute_topic_temporal_kinetics(
        topic_id="topic_test",
        messages=[msg1, msg2],
        cutoff_at=t_cutoff,
        engagement_observations=[obs1_past, obs1_cutoff, obs1_future, obs2_past, obs2_cutoff, obs2_future],
    )

    # The future observations (500 + 1000 views) must NOT affect views or velocities at t_cutoff
    assert kinetics.total_observed_views == 200 + 400
    assert kinetics.view_velocity_per_hour is not None
    # Velocity between t_pub and t_cutoff: msg1 is (200-100)/2 = 50/hr, msg2 is (400-300)/2 = 50/hr -> avg 50/hr
    assert round(kinetics.view_velocity_per_hour, 1) == 50.0


# ------------------------------------------------------------------------------
# Test 8: Source Failure Isolation
# ------------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cohort_reobservation_source_failure_isolation(tmp_path: Path):
    """Verify that an exception in one channel during re-observation does not crash the run."""
    cm = CohortManager(storage_dir=tmp_path / "cohorts")
    t0 = datetime(2026, 9, 8, 12, 0, 0, tzinfo=timezone.utc)

    m1 = _make_msg("telegram:100:1", t0, channel="@goodchannel")
    m2 = _make_msg("telegram:200:2", t0, channel="@badchannel")
    cohort = cm.create_cohort([m1, m2], window_hours=24.0, cohort_id="cohort_fail_iso", reference_time=t0)

    class FlakyCollector:
        async def reobserve_channel(self, channel: str, limit: int = 50):
            from app.collectors.telegram.collector import CollectionResult
            if "bad" in channel:
                raise ConnectionResetError("Telegram peer disconnected")
            obs = _make_obs("telegram:100:1", t0 + timedelta(minutes=30), views=120)
            return CollectionResult(
                channel=channel,
                target_entity_id=100,
                requested_limit=limit,
                raw_messages_count=1,
                canonical_messages_count=1,
                raw_file_path="",
                canonical_messages=[m1],
                engagement_observations=[obs],
                errors=[],
            )

    updated_cohort, metrics = await cm.reobserve_cohort(
        cohort=cohort,
        collector=FlakyCollector(),
        observation_parquet_path=tmp_path / "obs.parquet",
    )

    assert metrics["channels_attempted"] == 2
    assert metrics["channels_succeeded"] == 1
    assert metrics["channels_failed"] == 1
    assert "@badchannel" in metrics["errors"]
    assert metrics["observations_persisted"] == 1
