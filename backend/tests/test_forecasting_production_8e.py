"""
Milestone 8E: Emerging Trend Forecasting Production Backend Test Suite.

Validates:
1. Production API contract (GET /api/v1/forecasting/emerging-trends).
2. Status endpoint (GET /api/v1/forecasting/status).
3. Canonical rank ordering (forecast_rank ascending, forecast_score non-increasing).
4. Query filters (min_score, tier, limit, horizon_hours).
5. Validation constraints (unsupported horizons, out-of-bound scores/limits).
6. Missing artifact handling (HTTP 503 FORECAST_ARTIFACT_NOT_FOUND).
7. Corrupted artifact handling (HTTP 500 FORECAST_ARTIFACT_CORRUPT).
8. ForecastArtifactRepository mtime caching and hot-reload.
9. Zero-runtime-inference product boundary verification.
"""

from datetime import datetime, timezone
import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_forecast_repository, get_forecast_service
from app.main import create_app
from app.repositories.forecast_repository import ForecastArtifactRepository
from app.schemas.forecasting import (
    ConfidenceTier,
    EmergingTrendForecast,
    EmergingTrendForecastArtifact,
    EmergingTrendsApiResponse,
    ForecastTier,
    ForecastingStatusResponse,
    TrajectoryPhase,
)
from app.services.forecast_service import EmergingTrendForecastService


@pytest.fixture
def sample_forecast_artifact():
    """Create a deterministic, schema-valid EmergingTrendForecastArtifact fixture."""
    now = datetime(2026, 9, 5, 12, 0, 0, tzinfo=timezone.utc)
    forecasts = [
        EmergingTrendForecast(
            topic_id="topic_alpha",
            cutoff_at=now,
            horizon_hours=24,
            forecast_score=0.92,
            forecast_rank=1,
            forecast_tier=ForecastTier.STRONG_EMERGENCE,
            trajectory_phase=TrajectoryPhase.ACCELERATING,
            confidence_tier=ConfidenceTier.HIGH,
            historical_message_count=120,
            recent_message_count=85,
            baseline_message_count=35,
            growth_velocity=12.0,
            persistence_score=0.85,
            channel_diffusion_rate=0.75,
            domain_diffusion_rate=0.60,
            burstiness_index=0.25,
            messages_24h=85,
            velocity_6h=12.0,
            publication_kinetics_available=True,
            acceleration_available=True,
            engagement_signal_available=False,
            generated_at=now,
        ),
        EmergingTrendForecast(
            topic_id="topic_beta",
            cutoff_at=now,
            horizon_hours=24,
            forecast_score=0.78,
            forecast_rank=2,
            forecast_tier=ForecastTier.MODERATE_EMERGENCE,
            trajectory_phase=TrajectoryPhase.GROWING,
            confidence_tier=ConfidenceTier.HIGH,
            historical_message_count=80,
            recent_message_count=42,
            baseline_message_count=38,
            growth_velocity=6.0,
            persistence_score=0.70,
            channel_diffusion_rate=0.50,
            domain_diffusion_rate=0.40,
            burstiness_index=0.10,
            messages_24h=42,
            velocity_6h=6.0,
            publication_kinetics_available=True,
            acceleration_available=True,
            engagement_signal_available=False,
            generated_at=now,
        ),
        EmergingTrendForecast(
            topic_id="topic_gamma",
            cutoff_at=now,
            horizon_hours=24,
            forecast_score=0.35,
            forecast_rank=3,
            forecast_tier=ForecastTier.EARLY_SIGNAL,
            trajectory_phase=TrajectoryPhase.PERSISTENT,
            confidence_tier=ConfidenceTier.MEDIUM,
            historical_message_count=30,
            recent_message_count=15,
            baseline_message_count=15,
            growth_velocity=1.5,
            persistence_score=0.40,
            channel_diffusion_rate=0.25,
            domain_diffusion_rate=0.20,
            burstiness_index=None,
            messages_24h=15,
            velocity_6h=1.5,
            publication_kinetics_available=True,
            acceleration_available=False,
            engagement_signal_available=False,
            generated_at=now,
        ),
    ]

    return EmergingTrendForecastArtifact(
        artifact_id="forecast_art_test_001",
        generated_at_utc=now,
        cutoff_at_utc=now,
        horizon_hours=24,
        causal_representation_version="8C.1_causal_hdbscan",
        feature_engine_version="8A_kinetics_v1",
        score_version="8D.1_vol_vel_hybrid_v1",
        total_candidate_topics=3,
        forecasts=forecasts,
        metadata={
            "forecasting_strategy": "volume_velocity_hybrid",
            "forecasting_strategy_version": "8D.1_production_freeze",
            "score_formula": "0.50 * within_cutoff_percentile(messages_24h) + 0.50 * within_cutoff_percentile(velocity_6h)",
        },
    )


@pytest.fixture
def temp_repo_with_artifact(tmp_path, sample_forecast_artifact):
    """Provide a ForecastArtifactRepository pointing to an isolated temp json file."""
    art_file = tmp_path / "emerging_trend_forecasts.json"
    with open(art_file, "w", encoding="utf-8") as f:
        f.write(sample_forecast_artifact.model_dump_json(indent=2))
    return ForecastArtifactRepository(artifact_path=art_file)


@pytest.fixture
def custom_client(temp_repo_with_artifact):
    """FastAPI TestClient wired to isolated fixture repository."""
    app = create_app()
    app.dependency_overrides[get_forecast_repository] = lambda: temp_repo_with_artifact
    app.dependency_overrides[get_forecast_service] = lambda: EmergingTrendForecastService(repository=temp_repo_with_artifact)
    with TestClient(app) as test_client:
        yield test_client


# ==============================================================================
# 1. API SUCCESS & CONTRACT VERIFICATION
# ==============================================================================

def test_get_emerging_trends_api_success(custom_client):
    """Verify GET /api/v1/forecasting/emerging-trends returns valid EmergingTrendsApiResponse."""
    resp = custom_client.get("/api/v1/forecasting/emerging-trends")
    assert resp.status_code == 200

    data = resp.json()
    # Validate against strict Pydantic envelope model
    validated = EmergingTrendsApiResponse.model_validate(data)

    # Verify envelope artifact summary
    summary = validated.artifact
    assert summary.artifact_id == "forecast_art_test_001"
    assert summary.horizon_hours == 24
    assert summary.forecasting_strategy == "volume_velocity_hybrid"
    assert summary.forecasting_strategy_version == "8D.1_production_freeze"
    assert summary.score_version == "8D.1_vol_vel_hybrid_v1"
    assert summary.total_candidate_topics == 3
    assert summary.returned_topics_count == 3

    # Verify forecast items
    forecasts = validated.forecasts
    assert len(forecasts) == 3
    top = forecasts[0]
    assert top.topic_id == "topic_alpha"
    assert top.forecast_rank == 1
    assert top.forecast_score == 0.92
    assert top.forecast_tier == ForecastTier.STRONG_EMERGENCE
    assert top.trajectory_phase == TrajectoryPhase.ACCELERATING
    assert top.messages_24h == 85
    assert top.velocity_6h == 12.0
    assert top.channel_diffusion_rate == 0.75
    assert top.burstiness_index == 0.25
    assert top.publication_kinetics_available is True


def test_forecasts_canonical_ranking(custom_client):
    """Verify forecasts are strictly returned in canonical rank ascending order."""
    resp = custom_client.get("/api/v1/forecasting/emerging-trends")
    assert resp.status_code == 200
    forecasts = resp.json()["forecasts"]

    ranks = [fc["forecast_rank"] for fc in forecasts]
    scores = [fc["forecast_score"] for fc in forecasts]

    assert ranks == sorted(ranks), "Ranks must be in ascending order (1, 2, ...)"
    assert scores == sorted(scores, reverse=True), "Scores must be in non-increasing order"


# ==============================================================================
# 2. QUERY PARAMETER FILTERING
# ==============================================================================

def test_query_filter_min_score(custom_client):
    """Verify filtering by min_score returns only forecasts >= min_score."""
    resp = custom_client.get("/api/v1/forecasting/emerging-trends?min_score=0.70")
    assert resp.status_code == 200
    data = resp.json()

    assert data["artifact"]["returned_topics_count"] == 2
    for fc in data["forecasts"]:
        assert fc["forecast_score"] >= 0.70


def test_query_filter_tier(custom_client):
    """Verify filtering by categorical ForecastTier."""
    resp = custom_client.get("/api/v1/forecasting/emerging-trends?tier=STRONG_EMERGENCE")
    assert resp.status_code == 200
    data = resp.json()

    assert data["artifact"]["returned_topics_count"] == 1
    assert data["forecasts"][0]["topic_id"] == "topic_alpha"
    assert data["forecasts"][0]["forecast_tier"] == "STRONG_EMERGENCE"


def test_query_filter_limit(custom_client):
    """Verify limiting the number of returned forecasts."""
    resp = custom_client.get("/api/v1/forecasting/emerging-trends?limit=1")
    assert resp.status_code == 200
    data = resp.json()

    assert data["artifact"]["returned_topics_count"] == 1
    assert len(data["forecasts"]) == 1
    assert data["forecasts"][0]["forecast_rank"] == 1


def test_query_filter_horizon_supported(custom_client):
    """Verify horizon_hours=24 succeeds."""
    resp = custom_client.get("/api/v1/forecasting/emerging-trends?horizon_hours=24")
    assert resp.status_code == 200
    assert resp.json()["artifact"]["horizon_hours"] == 24


# ==============================================================================
# 3. QUERY PARAMETER VALIDATION & ERROR BEHAVIOR
# ==============================================================================

def test_validation_unsupported_horizon(custom_client):
    """Verify unsupported horizon_hours raises HTTP 422 with clear message."""
    resp = custom_client.get("/api/v1/forecasting/emerging-trends?horizon_hours=12")
    assert resp.status_code == 422
    data = resp.json()
    assert data["error"]["code"] == "UNSUPPORTED_HORIZON"
    assert "Unsupported horizon_hours" in data["error"]["message"]


def test_validation_min_score_bounds(custom_client):
    """Verify min_score must be within [0.0, 1.0]."""
    resp_low = custom_client.get("/api/v1/forecasting/emerging-trends?min_score=-0.1")
    assert resp_low.status_code in (400, 422)
    assert resp_low.json()["error"]["code"] == "INVALID_QUERY_PARAMETER"

    resp_high = custom_client.get("/api/v1/forecasting/emerging-trends?min_score=1.5")
    assert resp_high.status_code in (400, 422)
    assert resp_high.json()["error"]["code"] == "INVALID_QUERY_PARAMETER"


def test_validation_limit_bounds(custom_client):
    """Verify limit must be within [1, 200]."""
    resp_zero = custom_client.get("/api/v1/forecasting/emerging-trends?limit=0")
    assert resp_zero.status_code in (400, 422)
    assert resp_zero.json()["error"]["code"] == "INVALID_QUERY_PARAMETER"

    resp_huge = custom_client.get("/api/v1/forecasting/emerging-trends?limit=250")
    assert resp_huge.status_code in (400, 422)
    assert resp_huge.json()["error"]["code"] == "INVALID_QUERY_PARAMETER"


# ==============================================================================
# 4. STATUS ENDPOINT VERIFICATION
# ==============================================================================

def test_forecasting_status_healthy(custom_client):
    """Verify GET /api/v1/forecasting/status returns healthy status response."""
    resp = custom_client.get("/api/v1/forecasting/status")
    assert resp.status_code == 200

    data = resp.json()
    status_obj = ForecastingStatusResponse.model_validate(data)

    assert status_obj.status == "healthy"
    assert status_obj.artifact_available is True
    assert status_obj.artifact_id == "forecast_art_test_001"
    assert status_obj.forecasting_strategy == "volume_velocity_hybrid"
    assert status_obj.forecasting_strategy_version == "8D.1_production_freeze"
    assert status_obj.score_version == "8D.1_vol_vel_hybrid_v1"
    assert status_obj.total_candidate_topics == 3
    assert status_obj.total_forecasts == 3
    assert status_obj.horizon_hours == 24
    assert status_obj.supported_horizons == [24, 6]
    assert status_obj.last_modified_utc is not None


# ==============================================================================
# 5. REPOSITORY & LIFECYCLE TESTS (MTIME CACHING, MISSING & CORRUPT)
# ==============================================================================

def test_repository_mtime_caching_and_hot_reload(tmp_path, sample_forecast_artifact):
    """Verify repository in-memory caching and hot-reload on mtime update."""
    art_file = tmp_path / "test_artifact.json"
    with open(art_file, "w", encoding="utf-8") as f:
        f.write(sample_forecast_artifact.model_dump_json(indent=2))

    repo = ForecastArtifactRepository(artifact_path=art_file)

    # 1. Initial load
    art1 = repo.get_artifact()
    assert art1.artifact_id == "forecast_art_test_001"
    assert repo._cached_artifact is art1

    # 2. Subsequent load without file touch returns cached object identity
    art2 = repo.get_artifact()
    assert art2 is art1

    # 3. Modify artifact file with new ID
    modified_data = sample_forecast_artifact.model_dump(mode="json")
    modified_data["artifact_id"] = "forecast_art_test_updated"
    import time
    time.sleep(0.05)  # Ensure filesystem mtime differs
    with open(art_file, "w", encoding="utf-8") as f:
        json.dump(modified_data, f)

    # 4. Reload should detect mtime change and refresh cached object
    art3 = repo.get_artifact()
    assert art3 is not art1
    assert art3.artifact_id == "forecast_art_test_updated"


def test_missing_artifact_behavior(tmp_path):
    """Verify behavior when artifact file does not exist."""
    missing_path = tmp_path / "non_existent_forecasts.json"
    repo = ForecastArtifactRepository(artifact_path=missing_path)

    # 1. Status endpoint returns degraded status without crashing
    status = repo.get_status()
    assert status.status == "degraded"
    assert status.artifact_available is False
    assert status.total_candidate_topics == 0

    # 2. API endpoint returns 503 SERVICE_UNAVAILABLE
    app = create_app()
    app.dependency_overrides[get_forecast_repository] = lambda: repo
    app.dependency_overrides[get_forecast_service] = lambda: EmergingTrendForecastService(repository=repo)

    with TestClient(app) as test_client:
        resp = test_client.get("/api/v1/forecasting/emerging-trends")
        assert resp.status_code == 503
        data = resp.json()
        assert data["error"]["code"] == "FORECAST_ARTIFACT_NOT_FOUND"


def test_corrupt_artifact_behavior(tmp_path):
    """Verify behavior when artifact file contains invalid/corrupted JSON."""
    corrupt_path = tmp_path / "corrupt_forecasts.json"
    with open(corrupt_path, "w", encoding="utf-8") as f:
        f.write("{ invalid_json: broken ")

    repo = ForecastArtifactRepository(artifact_path=corrupt_path)

    # 1. Status endpoint returns error status
    status = repo.get_status()
    assert status.status == "error"
    assert status.artifact_available is False

    # 2. API endpoint returns 500 INTERNAL_SERVER_ERROR
    app = create_app()
    app.dependency_overrides[get_forecast_repository] = lambda: repo
    app.dependency_overrides[get_forecast_service] = lambda: EmergingTrendForecastService(repository=repo)

    with TestClient(app) as test_client:
        resp = test_client.get("/api/v1/forecasting/emerging-trends")
        assert resp.status_code == 500
        data = resp.json()
        assert data["error"]["code"] == "FORECAST_ARTIFACT_CORRUPT"


# ==============================================================================
# 6. ZERO RUNTIME INFERENCE CONTRACT GUARANTEE
# ==============================================================================

def test_zero_runtime_clustering_guarantee(custom_client, monkeypatch):
    """Verify that serving forecasts NEVER triggers clustering, vectorizers, or causal discovery."""
    import sklearn.cluster
    import sklearn.feature_extraction.text

    def prohibited_call(*args, **kwargs):
        raise AssertionError("Prohibited ML/clustering call executed inside API request path!")

    monkeypatch.setattr(sklearn.cluster, "HDBSCAN", prohibited_call)
    monkeypatch.setattr(sklearn.feature_extraction.text, "TfidfVectorizer", prohibited_call)

    # Request path must execute purely from cached disk artifact
    resp = custom_client.get("/api/v1/forecasting/emerging-trends")
    assert resp.status_code == 200
    assert len(resp.json()["forecasts"]) == 3
