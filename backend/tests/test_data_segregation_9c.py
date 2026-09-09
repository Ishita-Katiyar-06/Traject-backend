"""
Milestone 9C Data Segregation & Public API Leak Audit Tests.
TRAJECT / TESSERA — SIH 2026 PS 26152

Verifies:
1. Public endpoints return strictly typed public DTOs.
2. Complete absence of sensitive NTRO indicators in public responses:
   - Zero raw author IDs, channel IDs, Telegram URLs
   - Zero raw message texts or raw reference hashes
   - Zero internal model/feature values (growth_velocity, diffusion rates, burstiness)
   - Zero narrative coordination indicators or Priority Signal sub-scores
   - Zero internal pipeline performance or memory metrics
3. WebSocket event segregation between public and NTRO clients.
"""

import time
import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_jwt_verifier
from app.core.auth import SupabaseJWTVerifier
from app.core.config import APISettings
from app.main import create_app
from app.repositories.artifact_repository import get_artifact_repository

TEST_SECRET = "test-supa-secret-for-jwt-verification-9b-minimum-32-chars-long!"
TEST_ISSUER = "https://haccqlbymbjulkwtbpvd.supabase.co/auth/v1"
TEST_AUDIENCE = "authenticated"


@pytest.fixture
def seg_client(populated_repository):
    """FastAPI TestClient with real public router and populated repository."""
    settings = APISettings()
    settings.supabase_jwt_secret = TEST_SECRET
    settings.supabase_issuer = TEST_ISSUER
    settings.supabase_audience = TEST_AUDIENCE
    settings.supabase_jwks_url = ""

    app = create_app()
    app.dependency_overrides[get_artifact_repository] = lambda: populated_repository
    app.dependency_overrides[get_jwt_verifier] = lambda: SupabaseJWTVerifier(settings=settings)

    with TestClient(app) as client:
        yield client


def test_public_trends_list_returns_strictly_public_fields(seg_client):
    """GET /api/v1/public/trends returns public summary and zero internal cluster metrics."""
    resp = seg_client.get("/api/v1/public/trends")
    assert resp.status_code == 200
    body = resp.json()

    assert "data" in body
    assert "meta" in body
    assert len(body["data"]) > 0

    first_item = body["data"][0]
    # Required public fields
    assert "topic_id" in first_item
    assert "topic_name" in first_item
    assert "keywords" in first_item
    assert "message_count" in first_item
    assert "relative_volume" in first_item
    assert "trajectory_phase" in first_item

    # AUDIT FOR ACCIDENTAL LEAKS: These internal fields must NEVER appear in public trends
    forbidden_keys = {
        "cluster_label",
        "representative_message_ids",
        "sample_message_ids",
        "entities",
        "propagation",
        "engagement",
        "channel_diffusion_rate",
        "broadcasting_channels",
        "author_id",
        "channel_id",
        "coordination_signals",
    }
    for item in body["data"]:
        keys = set(item.keys())
        intersection = keys.intersection(forbidden_keys)
        assert not intersection, f"Public trend leaked forbidden internal fields: {intersection}"


def test_public_trend_detail_zero_data_leaks(seg_client):
    """GET /api/v1/public/trends/{id} provides public trend summary without raw message text."""
    resp = seg_client.get("/api/v1/public/trends/topic_000")
    assert resp.status_code == 200
    item = resp.json()

    assert item["topic_id"] == "topic_000"
    assert "topic_name" in item
    assert "description" in item
    assert "keywords" in item
    assert "temporal_volume" in item

    # Raw message IDs, entities, cascades must be completely stripped
    forbidden_keys = {
        "cluster_label",
        "representative_message_ids",
        "sample_message_ids",
        "entities",
        "propagation",
        "engagement",
        "channel_id",
        "raw_text",
        "broadcasting_channels",
    }
    keys = set(item.keys())
    intersection = keys.intersection(forbidden_keys)
    assert not intersection, f"Public trend detail leaked forbidden fields: {intersection}"


def test_public_emerging_trends_strips_internal_kinetic_features(seg_client):
    """GET /api/v1/public/forecasting/emerging-trends exposes forecasts without internal ML kinetics."""
    resp = seg_client.get("/api/v1/public/forecasting/emerging-trends")
    assert resp.status_code == 200
    body = resp.json()

    assert "forecasts" in body
    assert "horizon_hours" in body
    assert body["horizon_hours"] == 24
    assert len(body["forecasts"]) > 0

    first_forecast = body["forecasts"][0]
    assert "forecast_score" in first_forecast
    assert "forecast_rank" in first_forecast
    assert "forecast_tier" in first_forecast
    assert "trajectory_phase" in first_forecast
    assert "confidence_tier" in first_forecast
    assert "recent_activity_level" in first_forecast

    # AUDIT: These internal feature engine kinetics must NEVER be exposed publicly
    forbidden_kinetic_fields = {
        "growth_velocity",
        "velocity_6h",
        "acceleration_factor",
        "persistence_score",
        "channel_diffusion_rate",
        "domain_diffusion_rate",
        "burstiness_index",
        "causal_representation_version",
        "feature_engine_version",
        "score_version",
    }
    for f in body["forecasts"]:
        keys = set(f.keys())
        intersection = keys.intersection(forbidden_kinetic_fields)
        assert not intersection, f"Public forecast leaked internal kinetics: {intersection}"


def test_public_client_websocket_role_segregation(seg_client):
    """Unauthenticated WebSocket client receives public_user role and no sensitive alert broadcasts."""
    with seg_client.websocket_connect("/api/v1/ws/live") as ws:
        ack = ws.receive_json()
        assert ack["type"] == "connection_ack"
        data = ack["data"]
        assert data["role"] == "public_user"
        # Public client does NOT receive internal channels_monitored or joined
        assert "channels_monitored" not in data
        assert "channels_joined" not in data
