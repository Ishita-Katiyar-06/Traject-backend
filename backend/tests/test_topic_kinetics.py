"""Comprehensive test suite for Topic Temporal Kinetics & Cross-Channel Diffusion (Milestone 8A).

Verifies:
1. Strict cutoff enforcement (published_at > T messages are completely ignored).
2. Multi-window volume partitioning (1h, 3h, 6h, 12h, 24h).
3. Deterministic velocity calculations.
4. Acceleration calculation and explicit insufficiency handling (returns None + False when depth < window).
5. Persistence, discrete active hour counts, and consecutive active hours.
6. Cross-channel diffusion (distinct channels, new channels, adoption rate, message ratios).
7. Cross-domain diffusion (domain expansion and distinct domains).
8. Burstiness index calculation (Goh-Barabasi on >= 3 messages; None on < 3).
9. Engagement observation cutoff (observed_at > T observations are completely ignored).
10. Mathematical determinism (identical input produces byte-identical output).
"""

from datetime import datetime, timedelta, timezone
from pathlib import Path
import pytest

from app.schemas.canonical_message import AuthorType, CanonicalMessage, Platform
from app.schemas.engagement_observation import EngagementObservation
from app.schemas.topic_kinetics import TopicTemporalKinetics
from app.temporal.kinetics import (
    compute_all_topics_kinetics,
    compute_topic_temporal_kinetics,
)


def _make_msg(
    canonical_id: str,
    published_at: datetime,
    author_id: str | None = None,
    author_username: str | None = None,
) -> CanonicalMessage:
    parts = canonical_id.split(":")
    aid = author_id or (parts[1] if len(parts) == 3 else "channel_a")
    nid = parts[-1]
    cid = f"telegram:{aid}:{nid}"
    return CanonicalMessage(
        canonical_id=cid,
        platform=Platform.TELEGRAM,
        native_id=nid,
        author_id=aid,
        author_username=author_username or aid,
        author_type=AuthorType.CHANNEL,
        published_at=published_at,
        collected_at=published_at + timedelta(minutes=5),
        text_content=f"Message {cid}",
    )


# ------------------------------------------------------------------------------
# 1. Strict Cutoff Enforcement (Leakage Prevention)
# ------------------------------------------------------------------------------

def test_cutoff_enforcement_prevents_future_leakage():
    """Verify that messages published after cutoff T do NOT affect volume, velocity, or channels."""
    T = datetime(2026, 9, 8, 12, 0, 0, tzinfo=timezone.utc)

    # 3 messages in the past (<= T)
    m1 = _make_msg("telegram:10:1", T - timedelta(hours=2), author_id="ch1")
    m2 = _make_msg("telegram:10:2", T - timedelta(hours=30), author_id="ch1")
    m3 = _make_msg("telegram:20:3", T - timedelta(minutes=30), author_id="ch2")

    # 2 messages in the future (> T)
    m_future1 = _make_msg("telegram:30:4", T + timedelta(minutes=1), author_id="ch3")
    m_future2 = _make_msg("telegram:30:5", T + timedelta(hours=5), author_id="ch4")

    all_msgs = [m1, m2, m3, m_future1, m_future2]

    kinetics = compute_topic_temporal_kinetics("topic_01", all_msgs, cutoff_at=T)

    # Future messages MUST NOT be included
    assert kinetics.total_historical_messages == 3
    assert kinetics.sample_count == 3
    assert kinetics.messages_1h == 1  # only m3
    assert kinetics.messages_3h == 2  # m1 and m3
    assert kinetics.total_channels_history == 2  # ch1 and ch2 (ch3, ch4 must be excluded)
    assert kinetics.distinct_channels_1h == 1


# ------------------------------------------------------------------------------
# 2. Window Volume Partitioning
# ------------------------------------------------------------------------------

def test_window_volume_partitioning():
    """Verify exact count of messages across 1h, 3h, 6h, 12h, 24h, and baseline windows."""
    T = datetime(2026, 9, 8, 12, 0, 0, tzinfo=timezone.utc)

    msgs = [
        _make_msg("telegram:1:1", T - timedelta(minutes=15)),   # in 1h, 3h, 6h, 12h, 24h
        _make_msg("telegram:1:2", T - timedelta(hours=2)),      # in 3h, 6h, 12h, 24h
        _make_msg("telegram:1:3", T - timedelta(hours=5)),      # in 6h, 12h, 24h
        _make_msg("telegram:1:4", T - timedelta(hours=10)),     # in 12h, 24h (also in prior 6h: (T-12, T-6])
        _make_msg("telegram:1:5", T - timedelta(hours=20)),     # in 24h
        _make_msg("telegram:1:6", T - timedelta(hours=36)),     # in baseline (T-48, T-24]
        _make_msg("telegram:1:7", T - timedelta(hours=40)),     # in baseline (T-48, T-24]
        _make_msg("telegram:1:8", T - timedelta(hours=72)),     # prior to 48h
    ]

    kinetics = compute_topic_temporal_kinetics("topic_vol", msgs, cutoff_at=T)

    assert kinetics.messages_1h == 1
    assert kinetics.messages_3h == 2
    assert kinetics.messages_6h == 3
    assert kinetics.messages_12h == 4
    assert kinetics.messages_24h == 5
    assert kinetics.baseline_messages_24h == 2
    assert kinetics.total_historical_messages == 8
    assert kinetics.volume_ratio_24h == pytest.approx(5.0 / 2.0)


# ------------------------------------------------------------------------------
# 3. Velocities
# ------------------------------------------------------------------------------

def test_velocity_calculations():
    """Verify velocity (messages / hour) across multiple backward windows."""
    T = datetime(2026, 9, 8, 12, 0, 0, tzinfo=timezone.utc)
    msgs = [
        _make_msg("telegram:1:1", T - timedelta(minutes=20)),
        _make_msg("telegram:1:2", T - timedelta(minutes=40)),
        _make_msg("telegram:1:3", T - timedelta(hours=2)),
        _make_msg("telegram:1:4", T - timedelta(hours=4)),
        _make_msg("telegram:1:5", T - timedelta(hours=5)),
        _make_msg("telegram:1:6", T - timedelta(hours=8)),  # in prior 6h (T-12, T-6]
    ]

    kinetics = compute_topic_temporal_kinetics("topic_vel", msgs, cutoff_at=T)

    assert kinetics.velocity_1h == pytest.approx(2.0 / 1.0)
    assert kinetics.velocity_3h == pytest.approx(3.0 / 3.0)
    assert kinetics.velocity_6h == pytest.approx(5.0 / 6.0, abs=1e-3)
    # Prior 6h has 1 message (msg 6): prior velocity = 1.0 / 6.0
    prior_v_6h = 1.0 / 6.0
    assert kinetics.velocity_change_6h == pytest.approx(5.0 / 6.0 - prior_v_6h, abs=1e-3)


# ------------------------------------------------------------------------------
# 4. Acceleration & Insufficient History Handling
# ------------------------------------------------------------------------------

def test_acceleration_when_sufficient_history():
    """Verify acceleration is computed when historical messages exist in comparative prior window."""
    T = datetime(2026, 9, 8, 12, 0, 0, tzinfo=timezone.utc)

    # 6 messages in last 6h (velocity = 1.0 msg/hr)
    msgs_recent = [
        _make_msg(f"telegram:1:{i}", T - timedelta(hours=i))
        for i in range(1, 7)
    ]
    # 2 messages in prior 6h (T-12 to T-6) (velocity = 2/6 = 0.333 msg/hr)
    msgs_prior = [
        _make_msg(f"telegram:1:10{i}", T - timedelta(hours=7 + i * 2))
        for i in range(2)
    ]

    kinetics = compute_topic_temporal_kinetics("topic_acc", msgs_recent + msgs_prior, cutoff_at=T)

    assert kinetics.acceleration_available
    assert kinetics.acceleration_6h is not None
    # acc_6h = (1.0 - 0.333) / 6.0 = 0.111 msgs/hr^2
    assert kinetics.acceleration_6h > 0


def test_acceleration_none_when_insufficient_history():
    """Verify acceleration is None (not zero) when topic did not exist before comparative window."""
    T = datetime(2026, 9, 8, 12, 0, 0, tzinfo=timezone.utc)

    # Topic only emerged 2 hours ago!
    msgs = [
        _make_msg("telegram:1:1", T - timedelta(minutes=30)),
        _make_msg("telegram:1:2", T - timedelta(hours=1)),
    ]

    kinetics = compute_topic_temporal_kinetics("topic_new", msgs, cutoff_at=T)

    assert kinetics.acceleration_6h is None
    assert kinetics.acceleration_24h is None
    assert not kinetics.acceleration_available


# ------------------------------------------------------------------------------
# 5. Persistence & Consecutive Active Hours
# ------------------------------------------------------------------------------

def test_persistence_and_consecutive_hours():
    """Verify active hour buckets and consecutive active hours preceding cutoff T."""
    T = datetime(2026, 9, 8, 12, 0, 0, tzinfo=timezone.utc)

    # Active in [11-12], [10-11], [9-10] (3 consecutive hours), gap in [8-9], active in [7-8]
    msgs = [
        _make_msg("telegram:1:1", T - timedelta(minutes=10)),  # [11-12]
        _make_msg("telegram:1:2", T - timedelta(minutes=70)),  # [10-11]
        _make_msg("telegram:1:3", T - timedelta(hours=2, minutes=30)),  # [9-10]
        # Gap between T-3h and T-4h
        _make_msg("telegram:1:4", T - timedelta(hours=4, minutes=15)),  # [7-8]
    ]

    kinetics = compute_topic_temporal_kinetics("topic_persist", msgs, cutoff_at=T)

    assert kinetics.active_last_1h
    assert kinetics.active_last_3h
    assert kinetics.active_last_6h
    assert kinetics.consecutive_active_hours == 3
    assert kinetics.active_window_count_6h == 4  # 4 out of 6 discrete hour buckets


# ------------------------------------------------------------------------------
# 6. Cross-Channel Diffusion
# ------------------------------------------------------------------------------

def test_cross_channel_diffusion():
    """Verify distinct channels, new channel adoption, and new channel message ratio."""
    T = datetime(2026, 9, 8, 12, 0, 0, tzinfo=timezone.utc)

    # Historical channel prior to 24h
    m_old = _make_msg("telegram:src_a:0", T - timedelta(hours=30), author_id="src_a")

    # Recent 24h messages
    m1 = _make_msg("telegram:src_a:1", T - timedelta(hours=10), author_id="src_a")  # existing channel
    m2 = _make_msg("telegram:src_b:2", T - timedelta(hours=5), author_id="src_b")   # new channel 1
    m3 = _make_msg("telegram:src_c:3", T - timedelta(hours=1), author_id="src_c")   # new channel 2
    m4 = _make_msg("telegram:src_c:4", T - timedelta(minutes=20), author_id="src_c")# same new channel 2

    kinetics = compute_topic_temporal_kinetics("topic_diff", [m_old, m1, m2, m3, m4], cutoff_at=T)

    assert kinetics.distinct_channels_24h == 3  # src_a, src_b, src_c
    assert kinetics.total_channels_history == 3
    assert kinetics.new_channels_24h == 2      # src_b, src_c (src_a existed prior to 24h)
    assert kinetics.channel_diffusion_rate_24h == pytest.approx(2.0 / 24.0, abs=1e-3)

    # In 24h: 4 messages total (m1, m2, m3, m4), 3 of which are from new channels (m2, m3, m4)
    assert kinetics.new_channel_message_ratio_24h == pytest.approx(3.0 / 4.0)


# ------------------------------------------------------------------------------
# 7. Cross-Domain Diffusion
# ------------------------------------------------------------------------------

def test_cross_domain_diffusion():
    """Verify domain expansion and distinct domain tracking."""
    T = datetime(2026, 9, 8, 12, 0, 0, tzinfo=timezone.utc)
    domain_map = {
        "src_geopol": "geopolitics",
        "src_cyber": "cybersecurity",
        "src_finance": "business_finance",
    }

    # Old message in geopolitics prior to 24h
    m_old = _make_msg("telegram:src_geopol:0", T - timedelta(hours=30), author_id="src_geopol")

    # Recent messages in geopolitics and cybersecurity
    m1 = _make_msg("telegram:src_geopol:1", T - timedelta(hours=5), author_id="src_geopol")
    m2 = _make_msg("telegram:src_cyber:2", T - timedelta(hours=2), author_id="src_cyber")

    kinetics = compute_topic_temporal_kinetics(
        "topic_dom",
        [m_old, m1, m2],
        cutoff_at=T,
        source_domain_map=domain_map,
    )

    assert kinetics.distinct_domains_24h == 2
    assert kinetics.new_domains_24h == 1  # cybersecurity was not present prior to 24h
    assert kinetics.domains_represented_24h == ["cybersecurity", "geopolitics"]


# ------------------------------------------------------------------------------
# 8. Burstiness & Kinetics
# ------------------------------------------------------------------------------

def test_burstiness_index_goh_barabasi():
    """Verify Goh-Barabasi burstiness calculation on >= 3 messages."""
    T = datetime(2026, 9, 8, 12, 0, 0, tzinfo=timezone.utc)

    # 4 messages with varying inter-arrival times
    msgs = [
        _make_msg("telegram:1:1", T - timedelta(hours=6)),
        _make_msg("telegram:1:2", T - timedelta(hours=5)),  # delta = 1h
        _make_msg("telegram:1:3", T - timedelta(hours=2)),  # delta = 3h
        _make_msg("telegram:1:4", T - timedelta(hours=0)),  # delta = 2h
    ]

    kinetics = compute_topic_temporal_kinetics("topic_burst", msgs, cutoff_at=T)

    assert kinetics.burstiness_index is not None
    assert -1.0 <= kinetics.burstiness_index <= 1.0


def test_burstiness_none_on_less_than_3_messages():
    """Verify burstiness is None when fewer than 3 messages exist."""
    T = datetime(2026, 9, 8, 12, 0, 0, tzinfo=timezone.utc)
    msgs = [
        _make_msg("telegram:1:1", T - timedelta(hours=2)),
        _make_msg("telegram:1:2", T - timedelta(hours=1)),
    ]
    kinetics = compute_topic_temporal_kinetics("topic_burst_small", msgs, cutoff_at=T)
    assert kinetics.burstiness_index is None


# ------------------------------------------------------------------------------
# 9. Engagement Observation Cutoff (Leakage Prevention)
# ------------------------------------------------------------------------------

def test_engagement_observations_enforce_cutoff():
    """Verify that engagement observations with observed_at > T are excluded from all engagement metrics."""
    T = datetime(2026, 9, 8, 12, 0, 0, tzinfo=timezone.utc)

    m1 = _make_msg("telegram:1:1", T - timedelta(hours=10))
    m2 = _make_msg("telegram:1:2", T - timedelta(hours=8))

    # Observation 1 for m1 observed <= T
    obs1 = EngagementObservation(
        observation_id="obs_1",
        canonical_id="telegram:1:1",
        observed_at=T - timedelta(hours=6),
        views_count=500,
    )
    # Observation 2 for m1 observed <= T (1 hour later, +100 views)
    obs2 = EngagementObservation(
        observation_id="obs_2",
        canonical_id="telegram:1:1",
        observed_at=T - timedelta(hours=5),
        views_count=600,
    )
    # Observation 1 for m2 observed <= T
    obs3 = EngagementObservation(
        observation_id="obs_3",
        canonical_id="telegram:1:2",
        observed_at=T - timedelta(hours=4),
        views_count=1000,
    )
    # Observation 2 for m2 observed <= T (2 hours later, +200 views)
    obs4 = EngagementObservation(
        observation_id="obs_4",
        canonical_id="telegram:1:2",
        observed_at=T - timedelta(hours=2),
        views_count=1200,
    )

    # FUTURE observation observed > T! MUST BE EXCLUDED!
    obs_future = EngagementObservation(
        observation_id="obs_future",
        canonical_id="telegram:1:1",
        observed_at=T + timedelta(hours=2),  # Future!
        views_count=999999,
    )

    all_obs = [obs1, obs2, obs3, obs4, obs_future]

    kinetics = compute_topic_temporal_kinetics(
        "topic_eng",
        [m1, m2],
        cutoff_at=T,
        engagement_observations=all_obs,
    )

    assert kinetics.engagement_features_available
    # Future 999,999 views MUST NOT be included
    assert kinetics.total_observed_views == 600 + 1200  # latest observed <= T
    assert kinetics.total_observed_views < 900000
    assert kinetics.view_velocity_per_hour is not None
    assert kinetics.view_velocity_per_hour == pytest.approx(100.0)  # (100/hr + 100/hr) / 2


# ------------------------------------------------------------------------------
# 10. Mathematical Determinism
# ------------------------------------------------------------------------------

def test_kinetics_computation_is_deterministic():
    """Verify that repeated computation on identical data produces identical results."""
    T = datetime(2026, 9, 8, 12, 0, 0, tzinfo=timezone.utc)
    msgs = [
        _make_msg(f"telegram:ch_{i % 3}:{i}", T - timedelta(minutes=i * 15))
        for i in range(20)
    ]

    res1 = compute_topic_temporal_kinetics("topic_det", msgs, cutoff_at=T)
    res2 = compute_topic_temporal_kinetics("topic_det", msgs, cutoff_at=T)

    assert res1.model_dump() == res2.model_dump()


def test_batch_all_topics_kinetics():
    """Verify batch calculation across multiple topics."""
    T = datetime(2026, 9, 8, 12, 0, 0, tzinfo=timezone.utc)
    topics_msgs = {
        "topic_a": [_make_msg("telegram:1:1", T - timedelta(minutes=45))],
        "topic_b": [_make_msg("telegram:2:2", T - timedelta(hours=2))],
    }
    batch_res = compute_all_topics_kinetics(topics_msgs, cutoff_at=T)
    assert "topic_a" in batch_res
    assert "topic_b" in batch_res
    assert batch_res["topic_a"].messages_1h == 1
    assert batch_res["topic_b"].messages_1h == 0
    assert batch_res["topic_b"].messages_3h == 1
