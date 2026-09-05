from fastapi.testclient import TestClient

from app.api.deps import get_artifact_repository
from app.main import create_app
from app.repositories.artifact_repository import ArtifactRepository


def test_invalid_query_parameter_validation_error(client):
    """Verify passing out-of-range parameter triggers 400 with ErrorEnvelope."""
    # page must be >= 1
    resp = client.get("/api/v1/narratives?page=0")
    assert resp.status_code == 400
    body = resp.json()

    assert "error" in body
    assert body["error"]["code"] == "INVALID_QUERY_PARAMETER"
    assert "page" in body["error"]["message"]
    assert "timestamp_utc" in body["error"]


def test_invalid_sort_by_rejected(client):
    """Verify passing invalid sort_by literal triggers 400 validation error."""
    resp = client.get("/api/v1/narratives?sort_by=non_existent_column")
    assert resp.status_code == 400
    body = resp.json()
    assert "error" in body
    assert body["error"]["code"] == "INVALID_QUERY_PARAMETER"


def test_service_unavailable_when_artifacts_missing():
    """Verify 503 Service Unavailable is returned when precomputed analytics are missing."""
    empty_repo = ArtifactRepository()
    app = create_app()
    app.dependency_overrides[get_artifact_repository] = lambda: empty_repo

    with TestClient(app) as uninit_client:
        resp = uninit_client.get("/api/v1/analytics")
        assert resp.status_code == 503
        body = resp.json()
        assert "error" in body
        assert body["error"]["code"] == "ARTIFACT_NOT_FOUND"
