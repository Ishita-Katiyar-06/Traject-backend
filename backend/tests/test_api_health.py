from fastapi.testclient import TestClient
import pytest

from app.main import create_app
from app.repositories.artifact_repository import ArtifactRepository


def test_api_health_degraded_when_no_artifacts():
    """Verify health endpoint returns 200 OK with 'degraded' status when no artifacts are loaded."""
    empty_repo = ArtifactRepository()
    app = create_app()
    app.dependency_overrides = {}

    with TestClient(app) as client:
        # Mock repository state
        client.app.dependency_overrides = {}
        resp = client.get("/api/v1/health")
        assert resp.status_code == 200
        data = resp.json()
        assert "status" in data
        assert "version" in data
        assert "artifacts_loaded" in data
        assert "timestamp_utc" in data
        assert data["version"] == "0.1.0"


def test_api_health_healthy_when_artifacts_loaded():
    """Verify health endpoint returns 'healthy' when repository has artifacts loaded."""
    repo = ArtifactRepository()
    repo.artifacts_loaded = True
    repo.dataset_source = "test_dataset.parquet"
    repo._messages = [None] * 10
    repo._narratives_by_id = {"n1": None, "n2": None}

    app = create_app()
    from app.api.deps import get_artifact_repository
    app.dependency_overrides[get_artifact_repository] = lambda: repo

    with TestClient(app) as client:
        resp = client.get("/api/v1/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert data["artifacts_loaded"] is True
        assert data["dataset_source"] == "test_dataset.parquet"
        assert data["active_records_count"] == 10
        assert data["active_narratives_count"] == 2
