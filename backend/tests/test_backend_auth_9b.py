"""
Milestone 9B Security & Regression Test Suite.
TRAJECT / TESSERA — SIH 2026 PS 26152

Comprehensive test coverage for:
1. Missing, malformed, invalid, expired, and wrong-issuer JWT verification (401).
2. Cryptographic signature validation (401 on tampered tokens).
3. Public user vs. NTRO analyst role authorization (403 on NTRO endpoints for public_user).
4. Security attack regressions:
   - Query parameter role spoofing (?role=ntro_analyst)
   - Body payload role spoofing ({"role": "ntro_analyst"})
   - Custom header spoofing (X-Role: ntro_analyst)
   - Untrusted user_metadata spoofing (user_metadata: {"role": "ntro_analyst"})
   - Tampered payload without valid signature
5. Operational and health public endpoint preservation.
"""

import time
from datetime import datetime, timezone
import jwt
import pytest
from fastapi.testclient import TestClient

from app.core.auth import SupabaseJWTVerifier
from app.core.config import APISettings
from app.main import create_app
from app.repositories.artifact_repository import get_artifact_repository
from app.schemas.auth import UserRole

TEST_SECRET = "test-supa-secret-for-jwt-verification-9b-minimum-32-chars-long!"
TEST_ISSUER = "https://haccqlbymbjulkwtbpvd.supabase.co/auth/v1"
TEST_AUDIENCE = "authenticated"


def extract_error(resp) -> dict:
    """Helper to extract normalized error payload across ErrorEnvelope and HTTPException."""
    body = resp.json()
    if isinstance(body, dict):
        if "error" in body and isinstance(body["error"], dict):
            return body["error"]
        if "detail" in body and isinstance(body["detail"], dict):
            return body["detail"]
    return body


@pytest.fixture
def auth_settings():
    """Deterministic APISettings fixture for auth testing."""
    settings = APISettings()
    settings.supabase_jwt_secret = TEST_SECRET
    settings.supabase_issuer = TEST_ISSUER
    settings.supabase_audience = TEST_AUDIENCE
    settings.ntro_analyst_emails = {"whitelisted_analyst@ntro.gov.in"}
    # Clear JWKS URL in test so HS256 secret is strictly exercised locally
    settings.supabase_jwks_url = ""
    return settings


@pytest.fixture
def auth_verifier(auth_settings):
    """SupabaseJWTVerifier instance configured with test settings."""
    return SupabaseJWTVerifier(settings=auth_settings)


def create_test_jwt(
    payload_overrides: dict | None = None,
    secret: str = TEST_SECRET,
    alg: str = "HS256",
    expires_in: int = 3600,
) -> str:
    """Helper to generate signed test JWTs with predictable claims."""
    now = int(time.time())
    payload = {
        "sub": "usr-test-uuid-001",
        "iss": TEST_ISSUER,
        "aud": TEST_AUDIENCE,
        "iat": now,
        "exp": now + expires_in,
        "email": "user@example.com",
        "app_metadata": {"provider": "email"},
        "user_metadata": {"full_name": "Test User"},
    }
    if payload_overrides:
        payload.update(payload_overrides)
    return jwt.encode(payload, secret, algorithm=alg)


@pytest.fixture
def auth_app(auth_settings, populated_repository):
    """App instance with real JWT verifier and populated repository, NO auth overrides."""
    app = create_app()
    app.dependency_overrides[get_artifact_repository] = lambda: populated_repository
    # Inject real auth verifier configured with test secret
    from app.api.deps import get_jwt_verifier
    app.dependency_overrides[get_jwt_verifier] = lambda: SupabaseJWTVerifier(settings=auth_settings)
    return app


@pytest.fixture
def auth_client(auth_app):
    """FastAPI TestClient with active security dependencies."""
    with TestClient(auth_app) as client:
        yield client


# ==============================================================================
# PHASE 10: AUTHENTICATION ERROR TESTS (401)
# ==============================================================================


def test_missing_authorization_header_returns_401(auth_client):
    """Unauthenticated request to NTRO endpoint must yield 401 Unauthorized."""
    resp = auth_client.get("/api/v1/narratives")
    assert resp.status_code == 401
    err = extract_error(resp)
    assert err.get("code") == "UNAUTHORIZED"
    assert "Missing authorization header" in err.get("message", "")


def test_malformed_bearer_header_returns_401(auth_client):
    """Invalid authorization schemes (Basic, Token) or empty Bearer return 401."""
    resp_basic = auth_client.get("/api/v1/narratives", headers={"Authorization": "Basic dXNlcjpwYXNz"})
    assert resp_basic.status_code == 401

    resp_empty = auth_client.get("/api/v1/narratives", headers={"Authorization": "Bearer"})
    assert resp_empty.status_code == 401


def test_invalid_jwt_structure_returns_401(auth_client):
    """Malformed or non-JWT tokens must return 401."""
    resp = auth_client.get("/api/v1/narratives", headers={"Authorization": "Bearer not.a.valid.jwt"})
    assert resp.status_code == 401
    err = extract_error(resp)
    assert err.get("code") == "UNAUTHORIZED"


def test_expired_jwt_returns_401(auth_client):
    """Tokens with exp in the past must be rejected with 401."""
    expired_token = create_test_jwt(expires_in=-300)
    resp = auth_client.get("/api/v1/narratives", headers={"Authorization": f"Bearer {expired_token}"})
    assert resp.status_code == 401
    err = extract_error(resp)
    assert "expired" in err.get("message", "").lower()


def test_invalid_issuer_returns_401(auth_client):
    """Tokens issued by an untrusted or different issuer must return 401."""
    bad_issuer_token = create_test_jwt({"iss": "https://malicious-fake-auth.com"})
    resp = auth_client.get("/api/v1/narratives", headers={"Authorization": f"Bearer {bad_issuer_token}"})
    assert resp.status_code == 401
    err = extract_error(resp)
    assert "issuer" in err.get("message", "").lower()


def test_invalid_signature_returns_401(auth_client):
    """Tokens signed with wrong secret must return 401."""
    bad_sig_token = create_test_jwt(secret="wrong-secret-that-does-not-match-at-all-32chars")
    resp = auth_client.get("/api/v1/narratives", headers={"Authorization": f"Bearer {bad_sig_token}"})
    assert resp.status_code == 401
    err = extract_error(resp)
    assert "signature" in err.get("message", "").lower()


# ==============================================================================
# PHASE 10: ROLE AUTHORIZATION TESTS (403 vs 200)
# ==============================================================================


def test_valid_public_user_denied_on_ntro_endpoint(auth_client):
    """Authenticated public_user accessing NTRO narrative endpoint must get 403 Forbidden."""
    public_token = create_test_jwt({
        "sub": "pub-user-123",
        "email": "citizen@gmail.com",
        "app_metadata": {"role": "public_user"},
    })
    resp = auth_client.get("/api/v1/narratives", headers={"Authorization": f"Bearer {public_token}"})
    assert resp.status_code == 403
    err = extract_error(resp)
    assert err.get("code") == "FORBIDDEN"
    assert "NTRO analyst clearance required" in err.get("message", "")


def test_valid_ntro_analyst_allowed_on_ntro_endpoints(auth_client):
    """Authenticated ntro_analyst must have access to NTRO endpoints."""
    ntro_token = create_test_jwt({
        "sub": "ntro-officer-007",
        "email": "analyst@ntro.gov.in",
        "app_metadata": {"role": "ntro_analyst"},
    })
    # Narratives endpoint
    resp = auth_client.get("/api/v1/narratives", headers={"Authorization": f"Bearer {ntro_token}"})
    assert resp.status_code == 200
    assert "data" in resp.json()

    # Messages endpoint
    resp_msg = auth_client.get("/api/v1/messages", headers={"Authorization": f"Bearer {ntro_token}"})
    assert resp_msg.status_code == 200

    # Pipeline metrics endpoint
    resp_pipe = auth_client.get("/api/v1/pipeline/metrics", headers={"Authorization": f"Bearer {ntro_token}"})
    assert resp_pipe.status_code == 200


def test_email_whitelist_resolves_ntro_analyst(auth_client):
    """A user whose email is in ntro_analyst_emails whitelist gets NTRO role even without explicit claim."""
    whitelisted_token = create_test_jwt({
        "sub": "whitelisted-uuid",
        "email": "whitelisted_analyst@ntro.gov.in",
        "app_metadata": {},  # no role in app_metadata
    })
    resp = auth_client.get("/api/v1/narratives", headers={"Authorization": f"Bearer {whitelisted_token}"})
    assert resp.status_code == 200


# ==============================================================================
# PHASE 11: SECURITY ATTACK REGRESSION TESTS
# ==============================================================================


def test_attack_query_param_role_elevation(auth_client):
    """Attacker appends ?role=ntro_analyst to query string. Must remain 403."""
    public_token = create_test_jwt({
        "sub": "attacker-001",
        "email": "attacker@gmail.com",
        "app_metadata": {},
    })
    resp = auth_client.get(
        "/api/v1/narratives?role=ntro_analyst",
        headers={"Authorization": f"Bearer {public_token}"},
    )
    assert resp.status_code == 403
    err = extract_error(resp)
    assert err.get("code") == "FORBIDDEN"


def test_attack_request_body_role_elevation(auth_client):
    """Attacker injects {"role": "ntro_analyst"} in request body. Must remain 403."""
    public_token = create_test_jwt({
        "sub": "attacker-002",
        "email": "attacker@gmail.com",
    })
    resp = auth_client.post(
        "/api/v1/stream/simulate",
        json={"role": "ntro_analyst", "event_type": "alert"},
        headers={"Authorization": f"Bearer {public_token}"},
    )
    assert resp.status_code == 403
    err = extract_error(resp)
    assert err.get("code") == "FORBIDDEN"


def test_attack_custom_header_role_elevation(auth_client):
    """Attacker supplies custom headers like X-Role: ntro_analyst. Must remain 403."""
    public_token = create_test_jwt({"sub": "attacker-003"})
    resp = auth_client.get(
        "/api/v1/narratives",
        headers={
            "Authorization": f"Bearer {public_token}",
            "X-Role": "ntro_analyst",
            "X-User-Role": "ntro_analyst",
            "X-Clearance-Level": "4",
        },
    )
    assert resp.status_code == 403


def test_attack_untrusted_user_metadata_ignored(auth_client):
    """Attacker writes role: 'ntro_analyst' inside user_metadata.
    
    CRITICAL SECURITY CHECK: user_metadata is user-editable in Supabase and must NEVER
    be used as authorization authority. Must resolve to public_user and return 403.
    """
    spoofed_user_metadata_token = create_test_jwt({
        "sub": "spoofed-user-004",
        "email": "attacker@gmail.com",
        "app_metadata": {},  # empty server metadata
        "user_metadata": {"role": "ntro_analyst"},  # client-controlled spoof attempt
    })
    resp = auth_client.get(
        "/api/v1/narratives",
        headers={"Authorization": f"Bearer {spoofed_user_metadata_token}"},
    )
    assert resp.status_code == 403
    err = extract_error(resp)
    assert err.get("code") == "FORBIDDEN"


def test_attack_tampered_jwt_payload_rejected(auth_client):
    """Attacker modifies JWT payload string to elevate role without valid signature -> 401."""
    legit_token = create_test_jwt({"app_metadata": {"role": "public_user"}})
    parts = legit_token.split(".")
    # Tamper with the payload part
    tampered_token = f"{parts[0]}.eyJyZXBsYWNlZCI6InBheWxvYWQifQ.{parts[2]}"
    resp = auth_client.get(
        "/api/v1/narratives",
        headers={"Authorization": f"Bearer {tampered_token}"},
    )
    assert resp.status_code == 401


# ==============================================================================
# OPERATIONAL & PUBLIC ENDPOINTS PRESERVATION
# ==============================================================================


def test_health_endpoint_is_public(auth_client):
    """GET /api/v1/health must remain accessible without credentials."""
    resp = auth_client.get("/api/v1/health")
    assert resp.status_code == 200


def test_pipeline_status_is_public(auth_client):
    """GET /api/v1/pipeline/status must remain accessible without credentials."""
    resp = auth_client.get("/api/v1/pipeline/status")
    assert resp.status_code == 200
    assert "status" in resp.json()
    assert "pipeline_version" in resp.json()


def test_forecasting_status_is_public(auth_client):
    """GET /api/v1/forecasting/status must remain accessible without credentials."""
    resp = auth_client.get("/api/v1/forecasting/status")
    assert resp.status_code == 200


def test_forecasting_emerging_trends_is_accessible_to_public_users(auth_client):
    """GET /api/v1/forecasting/emerging-trends is accessible to public users and anonymous callers."""
    # Anonymous
    resp_anon = auth_client.get("/api/v1/forecasting/emerging-trends")
    assert resp_anon.status_code == 200

    # Authenticated public user
    public_token = create_test_jwt({"app_metadata": {"role": "public_user"}})
    resp_pub = auth_client.get(
        "/api/v1/forecasting/emerging-trends",
        headers={"Authorization": f"Bearer {public_token}"},
    )
    assert resp_pub.status_code == 200
    assert "artifact" in resp_pub.json()
    assert "forecasts" in resp_pub.json()
