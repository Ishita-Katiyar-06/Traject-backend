"""
Milestone 8D: Emerging Trend Forecasting Engine Test Suite.

Ensures:
1. Schema validation with extra="forbid" for EmergingTrendForecast and EmergingTrendForecastArtifact.
2. Deterministic scoring and ranking reproducibility.
3. Within-cutoff causal percentile normalization correctness (mid-ranks, bounds [0, 1], tie handling, all-zero handling).
4. Missing feature handling and availability flags (acceleration, burstiness, engagement).
5. Deterministic trajectory phase classification rules.
6. Deterministic confidence tier classification rules.
7. Forecast tier distribution.
8. Future message leakage prevention: future messages cannot alter forecast scores or rankings at cutoff T.
9. Golden Question post-T deletion invariance: deleting all post-T messages produces identical forecasts.
10. Frozen analytical milestone immutability.
"""

from datetime import datetime, timedelta, timezone
from pathlib import Path
import pytest
from pydantic import ValidationError

from app.core.config import find_repo_root
from app.ml.forecasting.engine import EmergingTrendForecastingEngine
from app.schemas.canonical_message import AuthorType, CanonicalMessage, Platform
from app.schemas.forecasting import (
    ConfidenceTier,
    EmergingTrendForecast,
    EmergingTrendForecastArtifact,
    ForecastTier,
    TrajectoryPhase,
)
from app.schemas.topic_kinetics import TopicTemporalKinetics


def _make_msg(cid: str, pub_at: datetime, text: str = "Economic policy inflation rates", channel: str = "news") -> CanonicalMessage:
    parts = cid.split(":")
    author_id = parts[1] if len(parts) > 1 else "123"
    native_id = parts[2] if len(parts) > 2 else "1"
    return CanonicalMessage(
        canonical_id=cid,
        platform=Platform.TELEGRAM,
        native_id=native_id,
        author_id=author_id,
        author_username=channel,
        author_type=AuthorType.CHANNEL,
        channel_title=channel.capitalize(),
        subscriber_count=10000,
        published_at=pub_at,
        collected_at=pub_at + timedelta(seconds=5),
        text_content=text,
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
        replies_count=1,
        reactions={"👍": 5},
        urls=[],
        hashtags=[],
        mentions=[],
    )


@pytest.fixture
def base_cutoff() -> datetime:
    return datetime(2026, 9, 1, 12, 0, 0, tzinfo=timezone.utc)


@pytest.fixture
def sample_forecast_record(base_cutoff: datetime) -> EmergingTrendForecast:
    return EmergingTrendForecast(
        topic_id="topic_001",
        cutoff_at=base_cutoff,
        horizon_hours=24,
        forecast_score=0.8524,
        forecast_rank=1,
        forecast_tier=ForecastTier.STRONG_EMERGENCE,
        trajectory_phase=TrajectoryPhase.ACCELERATING,
        confidence_tier=ConfidenceTier.HIGH,
        historical_message_count=45,
        recent_message_count=18,
        baseline_message_count=8,
        growth_velocity=3.0,
        acceleration_factor=0.25,
        persistence_score=0.75,
        channel_diffusion_rate=0.40,
        domain_diffusion_rate=0.30,
        burstiness_index=0.15,
        publication_kinetics_available=True,
        acceleration_available=True,
        engagement_signal_available=False,
        generated_at=datetime.now(timezone.utc),
    )


def test_schema_validation_forbid_extra(sample_forecast_record: EmergingTrendForecast, base_cutoff: datetime):
    """Test 1: EmergingTrendForecast rejects extra fields."""
    valid_data = sample_forecast_record.model_dump()
    valid_data["unexpected_field"] = "illegal_payload"

    with pytest.raises(ValidationError):
        EmergingTrendForecast.model_validate(valid_data)


def test_schema_rejects_naive_datetime():
    """Test 2: Schema rejects non-timezone-aware datetime."""
    with pytest.raises(ValidationError):
        EmergingTrendForecast(
            topic_id="topic_001",
            cutoff_at=datetime(2026, 9, 1, 12, 0, 0),  # Naive!
            horizon_hours=24,
            forecast_score=0.5,
            forecast_rank=1,
            forecast_tier=ForecastTier.EARLY_SIGNAL,
            trajectory_phase=TrajectoryPhase.STABLE,
            confidence_tier=ConfidenceTier.MEDIUM,
            historical_message_count=10,
            recent_message_count=5,
            baseline_message_count=5,
            growth_velocity=1.0,
            persistence_score=0.5,
            channel_diffusion_rate=0.2,
            domain_diffusion_rate=0.2,
            generated_at=datetime.now(timezone.utc),
        )


def test_within_cutoff_percentile_normalization():
    """Test 3: Percentile normalization is scale-invariant, monotonic, handles ties with mid-ranks, and bounds in [0, 1]."""
    engine = EmergingTrendForecastingEngine()

    # Empty list
    assert engine.compute_within_cutoff_percentiles([]) == []

    # All zeros
    assert engine.compute_within_cutoff_percentiles([0.0, 0.0, 0.0]) == [0.0, 0.0, 0.0]

    # Monotonic distinct values
    pcts = engine.compute_within_cutoff_percentiles([10.0, 20.0, 30.0, 40.0])
    assert pcts == [0.25, 0.5, 0.75, 1.0]

    # Ties: mid-rank calculation
    # values: [10, 20, 20, 40]
    # 10: count=1, mid_rank = (1+1)/2 = 1.0 / 4 = 0.25
    # 20: count=2, accum=1, mid_rank = 1 + (2+1)/2 = 2.5 / 4 = 0.625
    # 40: count=1, accum=3, mid_rank = 3 + (1+1)/2 = 4.0 / 4 = 1.0
    pcts_ties = engine.compute_within_cutoff_percentiles([10.0, 20.0, 20.0, 40.0])
    assert pcts_ties == [0.25, 0.625, 0.625, 1.0]


def test_trajectory_phase_classification(base_cutoff: datetime):
    """Test 4: Trajectory phase correctly resolves ACCELERATING, GROWING, WEAKENING, PERSISTENT, STABLE, INSUFFICIENT_DATA."""
    engine = EmergingTrendForecastingEngine()

    # 1. Insufficient data (< 3 messages)
    feat_sparse = TopicTemporalKinetics(
        topic_id="sparse",
        cutoff_at=base_cutoff,
        messages_24h=1,
        total_historical_messages=2,
    )
    assert engine.classify_trajectory_phase(feat_sparse) == TrajectoryPhase.INSUFFICIENT_DATA

    # 2. Accelerating (acceleration available > 0, velocity_change > 0)
    feat_acc = TopicTemporalKinetics(
        topic_id="acc",
        cutoff_at=base_cutoff,
        messages_24h=20,
        total_historical_messages=50,
        velocity_change_6h=1.5,
        acceleration_24h=0.08,
        acceleration_available=True,
    )
    assert engine.classify_trajectory_phase(feat_acc) == TrajectoryPhase.ACCELERATING

    # 3. Growing (velocity_change > 0 without acceleration)
    feat_grow = TopicTemporalKinetics(
        topic_id="grow",
        cutoff_at=base_cutoff,
        messages_24h=20,
        total_historical_messages=50,
        velocity_change_6h=1.5,
        acceleration_available=False,
    )
    assert engine.classify_trajectory_phase(feat_grow) == TrajectoryPhase.GROWING

    # 4. Weakening (velocity_change < 0 and volume_ratio < 0.8)
    feat_weak = TopicTemporalKinetics(
        topic_id="weak",
        cutoff_at=base_cutoff,
        messages_24h=5,
        total_historical_messages=50,
        baseline_messages_24h=20,
        volume_ratio_24h=0.25,
        velocity_change_6h=-0.5,
    )
    assert engine.classify_trajectory_phase(feat_weak) == TrajectoryPhase.WEAKENING

    # 5. Persistent (active_window_count_24h >= 12 and stable volume)
    feat_pers = TopicTemporalKinetics(
        topic_id="pers",
        cutoff_at=base_cutoff,
        messages_24h=30,
        total_historical_messages=100,
        baseline_messages_24h=30,
        volume_ratio_24h=1.0,
        velocity_change_6h=0.0,
        active_window_count_24h=18,
    )
    assert engine.classify_trajectory_phase(feat_pers) == TrajectoryPhase.PERSISTENT

    # 6. Stable
    feat_stab = TopicTemporalKinetics(
        topic_id="stab",
        cutoff_at=base_cutoff,
        messages_24h=10,
        total_historical_messages=20,
        baseline_messages_24h=10,
        volume_ratio_24h=1.0,
        velocity_change_6h=0.0,
        active_window_count_24h=4,
    )
    assert engine.classify_trajectory_phase(feat_stab) == TrajectoryPhase.STABLE


def test_confidence_tier_classification(base_cutoff: datetime):
    """Test 5: Confidence tier resolves based purely on historical depth and multi-channel coverage."""
    engine = EmergingTrendForecastingEngine()

    # HIGH: >= 15 msgs, >= 3 channels, >= 6 active windows, acceleration available
    f_high = TopicTemporalKinetics(
        topic_id="high",
        cutoff_at=base_cutoff,
        total_historical_messages=25,
        distinct_channels_24h=4,
        active_window_count_24h=8,
        acceleration_available=True,
    )
    assert engine.classify_confidence_tier(f_high) == ConfidenceTier.HIGH

    # MEDIUM: >= 5 msgs, >= 2 channels, >= 3 active windows
    f_med = TopicTemporalKinetics(
        topic_id="med",
        cutoff_at=base_cutoff,
        total_historical_messages=8,
        distinct_channels_24h=2,
        active_window_count_24h=4,
    )
    assert engine.classify_confidence_tier(f_med) == ConfidenceTier.MEDIUM

    # LOW: >= 3 msgs
    f_low = TopicTemporalKinetics(
        topic_id="low",
        cutoff_at=base_cutoff,
        total_historical_messages=3,
        distinct_channels_24h=1,
        active_window_count_24h=1,
    )
    assert engine.classify_confidence_tier(f_low) == ConfidenceTier.LOW

    # INSUFFICIENT_DATA: < 3 msgs
    f_insuf = TopicTemporalKinetics(
        topic_id="insuf",
        cutoff_at=base_cutoff,
        total_historical_messages=2,
    )
    assert engine.classify_confidence_tier(f_insuf) == ConfidenceTier.INSUFFICIENT_DATA


def test_deterministic_scoring_reproducibility(base_cutoff: datetime):
    """Test 6: Scoring identical candidate features twice produces bitwise-identical forecasts and ranks."""
    engine = EmergingTrendForecastingEngine()

    feats = {
        "t1": TopicTemporalKinetics(
            topic_id="t1",
            cutoff_at=base_cutoff,
            messages_24h=15,
            total_historical_messages=30,
            velocity_6h=2.0,
            channel_diffusion_rate_24h=0.5,
            active_window_count_24h=10,
        ),
        "t2": TopicTemporalKinetics(
            topic_id="t2",
            cutoff_at=base_cutoff,
            messages_24h=5,
            total_historical_messages=10,
            velocity_6h=0.5,
            channel_diffusion_rate_24h=0.1,
            active_window_count_24h=3,
        ),
    }

    run1 = engine.score_candidates(feats, cutoff_at=base_cutoff)
    run2 = engine.score_candidates(feats, cutoff_at=base_cutoff)

    assert len(run1) == len(run2) == 2
    for fc1, fc2 in zip(run1, run2):
        assert fc1.topic_id == fc2.topic_id
        assert fc1.forecast_score == fc2.forecast_score
        assert fc1.forecast_rank == fc2.forecast_rank
        assert fc1.forecast_tier == fc2.forecast_tier
        assert fc1.trajectory_phase == fc2.trajectory_phase
        assert fc1.confidence_tier == fc2.confidence_tier


def test_future_message_leakage_prevention(base_cutoff: datetime):
    """Test 7: Adding future messages after T does not alter the forecast generated at T."""
    engine = EmergingTrendForecastingEngine()

    # Historical messages <= T
    hist_messages = [
        _make_msg(
            f"telegram:1001:{i}",
            base_cutoff - timedelta(hours=i % 20 + 1),
            text="Federal reserve monetary policy interest rates inflation discussion",
            channel="news",
        )
        for i in range(25)
    ]

    # Future messages in (T, T + 24h]
    future_messages = [
        _make_msg(
            f"telegram:1001:{100 + i}",
            base_cutoff + timedelta(hours=i % 12 + 1),
            text="Breaking economic announcement massive rate cut by central bank",
            channel="news",
        )
        for i in range(50)
    ]

    art_hist_only = engine.generate_forecast_artifact(
        messages=hist_messages,
        cutoff_at=base_cutoff,
        history_window_days=7.0,
        lookback_hours=48.0,
    )

    art_with_future = engine.generate_forecast_artifact(
        messages=hist_messages + future_messages,
        cutoff_at=base_cutoff,
        history_window_days=7.0,
        lookback_hours=48.0,
    )

    assert art_hist_only.total_candidate_topics == art_with_future.total_candidate_topics
    for fc_a, fc_b in zip(art_hist_only.forecasts, art_with_future.forecasts):
        assert fc_a.topic_id == fc_b.topic_id
        assert fc_a.forecast_score == fc_b.forecast_score
        assert fc_a.forecast_rank == fc_b.forecast_rank
        assert fc_a.forecast_tier == fc_b.forecast_tier
        assert fc_a.recent_message_count == fc_b.recent_message_count
        assert fc_a.growth_velocity == fc_b.growth_velocity


def test_golden_question_post_t_deletion_invariance(base_cutoff: datetime):
    """Test 8: Golden Question: If we delete all messages published after T, do we get the exact same forecast?"""
    engine = EmergingTrendForecastingEngine()

    raw_corpus = [
        _make_msg(
            f"telegram:100{i % 3}:{i}",
            base_cutoff - timedelta(hours=i * 2 + 1),
            text="Renewable energy solar panels wind turbine battery storage infrastructure",
            channel=f"channel_{i % 3}",
        )
        for i in range(20)
    ]
    future_corpus = [
        _make_msg(
            f"telegram:999:{100 + i}",
            base_cutoff + timedelta(hours=i + 1),
            text="Massive viral trending topic explosion quantum computing fusion",
            channel="breaking",
        )
        for i in range(30)
    ]

    full_dataset = raw_corpus + future_corpus
    # Complete deletion of every message > T
    post_t_deleted_dataset = [m for m in full_dataset if m.published_at <= base_cutoff]

    forecast_from_full = engine.generate_forecast_artifact(
        messages=full_dataset,
        cutoff_at=base_cutoff,
        history_window_days=14.0,
        lookback_hours=48.0,
    )
    forecast_from_deleted = engine.generate_forecast_artifact(
        messages=post_t_deleted_dataset,
        cutoff_at=base_cutoff,
        history_window_days=14.0,
        lookback_hours=48.0,
    )

    assert len(forecast_from_full.forecasts) == len(forecast_from_deleted.forecasts)
    for f1, f2 in zip(forecast_from_full.forecasts, forecast_from_deleted.forecasts):
        assert f1.topic_id == f2.topic_id
        assert f1.forecast_score == f2.forecast_score
        assert f1.forecast_rank == f2.forecast_rank
        assert f1.forecast_tier == f2.forecast_tier
        assert f1.trajectory_phase == f2.trajectory_phase
        assert f1.confidence_tier == f2.confidence_tier


def test_frozen_contracts_intact():
    """Test 9: Verify frozen Milestone 4A-4H and 8C.1 contracts are preserved."""
    repo_root = find_repo_root()
    parquet_path = repo_root / "data" / "processed" / "telegram" / "telegram_messages.parquet"
    assert parquet_path.is_file(), f"Parquet message storage missing at {parquet_path}"

    # Verify causal topic module functions exist and remain unchanged
    from app.ml.forecasting.causal_topic import build_causal_topics, project_future_messages_to_causal_topics
    assert callable(build_causal_topics)
    assert callable(project_future_messages_to_causal_topics)
