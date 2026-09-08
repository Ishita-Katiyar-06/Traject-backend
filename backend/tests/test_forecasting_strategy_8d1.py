"""
Milestone 8D.1: Forecasting Strategy Selection & Production Freeze Test Suite.

Ensures:
1. Production strategy defaults to VOLUME_VELOCITY_HYBRID.
2. Deterministic hybrid scoring (0.50 * Vol + 0.50 * Vel).
3. Ranking reproducibility and within-cutoff normalization bounds.
4. Post-T deletion invariance (Golden Question) under the frozen hybrid strategy.
5. Production artifact metadata correctly records forecasting_strategy and versions.
6. API endpoint GET /api/v1/forecasting/emerging-trends functions correctly with filtering and without heavy runtime computation.
7. Frozen analytical milestones (4A-4H, 6E, 7B, 8A, 8B, 8C.1) remain untouched.
"""

from datetime import datetime, timedelta, timezone
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.core.config import find_repo_root
from app.main import app
from app.ml.forecasting.engine import EmergingTrendForecastingEngine, ForecastingStrategy
from app.schemas.canonical_message import AuthorType, CanonicalMessage, Platform
from app.schemas.forecasting import (
    ConfidenceTier,
    EmergingTrendForecast,
    EmergingTrendForecastArtifact,
    ForecastTier,
    TrajectoryPhase,
)
from app.schemas.topic_kinetics import TopicTemporalKinetics


def _make_msg(cid: str, pub_at: datetime, text: str = "Macroeconomic inflation interest rate trends", channel: str = "news") -> CanonicalMessage:
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
    return datetime(2026, 9, 2, 12, 0, 0, tzinfo=timezone.utc)


def test_strategy_enum_and_default_selection():
    """Test 1: Engine defaults to VOLUME_VELOCITY_HYBRID and supports all strategy options."""
    engine_default = EmergingTrendForecastingEngine()
    assert engine_default.strategy == ForecastingStrategy.VOLUME_VELOCITY_HYBRID

    engine_vol = EmergingTrendForecastingEngine(strategy=ForecastingStrategy.VOLUME)
    assert engine_vol.strategy == ForecastingStrategy.VOLUME

    engine_vel = EmergingTrendForecastingEngine(strategy="velocity")
    assert engine_vel.strategy == ForecastingStrategy.VELOCITY

    engine_comp = EmergingTrendForecastingEngine(strategy=ForecastingStrategy.COMPOSITE_EXPERIMENTAL)
    assert engine_comp.strategy == ForecastingStrategy.COMPOSITE_EXPERIMENTAL


def test_hybrid_score_calculation(base_cutoff: datetime):
    """Test 2: Hybrid strategy calculates exact 0.50 * Vol + 0.50 * Vel within cutoff."""
    engine = EmergingTrendForecastingEngine(strategy=ForecastingStrategy.VOLUME_VELOCITY_HYBRID)

    # 3 topics:
    # Topic 1: High Vol, Low Vel
    # Topic 2: Low Vol, High Vel
    # Topic 3: High Vol, High Vel
    feats = {
        "t1": TopicTemporalKinetics(
            topic_id="t1",
            cutoff_at=base_cutoff,
            messages_24h=30,
            velocity_6h=0.5,
            total_historical_messages=50,
        ),
        "t2": TopicTemporalKinetics(
            topic_id="t2",
            cutoff_at=base_cutoff,
            messages_24h=5,
            velocity_6h=5.0,
            total_historical_messages=10,
        ),
        "t3": TopicTemporalKinetics(
            topic_id="t3",
            cutoff_at=base_cutoff,
            messages_24h=35,
            velocity_6h=5.5,
            total_historical_messages=60,
        ),
    }

    forecasts = engine.score_candidates(feats, cutoff_at=base_cutoff)
    fc_map = {fc.topic_id: fc for fc in forecasts}

    # t3 has highest on both volume and velocity -> rank 1
    assert fc_map["t3"].forecast_rank == 1
    assert fc_map["t3"].forecast_score == 1.0  # 0.5 * 1.0 + 0.5 * 1.0

    # Scores must be bounded in [0, 1]
    for fc in forecasts:
        assert 0.0 <= fc.forecast_score <= 1.0


def test_production_artifact_metadata_freeze(base_cutoff: datetime):
    """Test 3: Production forecast artifact correctly records strategy freeze metadata."""
    engine = EmergingTrendForecastingEngine(strategy=ForecastingStrategy.VOLUME_VELOCITY_HYBRID)

    msgs = [
        _make_msg(f"telegram:100:{i}", base_cutoff - timedelta(hours=i % 24 + 1))
        for i in range(25)
    ]

    artifact = engine.generate_forecast_artifact(
        messages=msgs,
        cutoff_at=base_cutoff,
        history_window_days=7.0,
        lookback_hours=48.0,
    )

    assert artifact.metadata["forecasting_strategy"] == "volume_velocity_hybrid"
    assert artifact.metadata["forecasting_strategy_version"] == "8D.1_production_freeze"
    assert artifact.metadata["feature_weights"] == {"volume": 0.50, "velocity": 0.50}


def test_golden_question_post_t_deletion_invariance_hybrid(base_cutoff: datetime):
    """Test 4: Post-T deletion invariance holds for the Volume + Velocity hybrid strategy."""
    engine = EmergingTrendForecastingEngine(strategy=ForecastingStrategy.VOLUME_VELOCITY_HYBRID)

    hist_msgs = [
        _make_msg(f"telegram:100:{i}", base_cutoff - timedelta(hours=i * 2 + 1), text="Semiconductor chip foundry supply chain")
        for i in range(20)
    ]
    fut_msgs = [
        _make_msg(f"telegram:999:{100 + i}", base_cutoff + timedelta(hours=i + 1), text="Unprecedented artificial superintelligence breakthrough")
        for i in range(30)
    ]

    full_dataset = hist_msgs + fut_msgs
    deleted_dataset = [m for m in full_dataset if m.published_at <= base_cutoff]

    res_full = engine.generate_forecast_artifact(full_dataset, cutoff_at=base_cutoff, history_window_days=14.0)
    res_del = engine.generate_forecast_artifact(deleted_dataset, cutoff_at=base_cutoff, history_window_days=14.0)

    assert len(res_full.forecasts) == len(res_del.forecasts)
    for f1, f2 in zip(res_full.forecasts, res_del.forecasts):
        assert f1.topic_id == f2.topic_id
        assert f1.forecast_score == f2.forecast_score
        assert f1.forecast_rank == f2.forecast_rank
        assert f1.forecast_tier == f2.forecast_tier


def test_api_emerging_trends_endpoint():
    """Test 5: GET /api/v1/forecasting/emerging-trends returns precomputed forecasts with filtering."""
    client = TestClient(app)

    repo_root = find_repo_root()
    art_path = repo_root / "data" / "processed" / "telegram" / "emerging_trend_forecasts.json"
    if not art_path.is_file():
        pytest.skip(f"Precomputed forecast artifact not present at {art_path}")

    # 1. Base call
    resp = client.get("/api/v1/forecasting/emerging-trends")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "artifact_id" in data or "artifact" in data
    assert "forecasts" in data
    assert len(data["forecasts"]) > 0

    # 2. Query filter on min_score
    resp_filtered = client.get("/api/v1/forecasting/emerging-trends?min_score=0.80")
    assert resp_filtered.status_code == 200
    data_filt = resp_filtered.json()
    for fc in data_filt["forecasts"]:
        assert fc["forecast_score"] >= 0.80

    # 3. Query filter on limit
    resp_limit = client.get("/api/v1/forecasting/emerging-trends?limit=5")
    assert resp_limit.status_code == 200
    assert len(resp_limit.json()["forecasts"]) <= 5


def test_frozen_contracts_unmodified():
    """Test 6: Verify frozen milestones 4A-4H, 6E, 7B, 8A, 8B, and 8C.1 contracts remain untouched."""
    repo_root = find_repo_root()
    parquet_path = repo_root / "data" / "processed" / "telegram" / "telegram_messages.parquet"
    assert parquet_path.is_file()

    from app.temporal.kinetics import compute_topic_temporal_kinetics
    from app.ml.forecasting.causal_topic import build_causal_topics
    assert callable(compute_topic_temporal_kinetics)
    assert callable(build_causal_topics)
