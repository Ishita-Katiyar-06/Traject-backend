"""Milestone 9B: Backend JWT Verification & Trusted Role Resolution.

Provides cryptographic verification of Supabase access tokens, validates issuers
and signatures, extracts trusted user identity, and resolves application roles.
Client-controlled metadata (such as user_metadata) is strictly rejected as an
authorization authority.
"""

import logging
from typing import Any
import jwt
from jwt.exceptions import (
    ExpiredSignatureError,
    InvalidAudienceError,
    InvalidIssuerError,
    InvalidSignatureError,
    InvalidTokenError,
    PyJWKClientError,
)

from app.core.config import APISettings, get_settings
from app.schemas.auth import AuthenticatedUser, UserRole

logger = logging.getLogger("traject.core.auth")


class AuthenticationError(Exception):
    """Generic authentication failure with safe error message."""
    def __init__(self, message: str = "Invalid or expired authentication credentials") -> None:
        super().__init__(message)
        self.message = message


class SupabaseJWTVerifier:
    """Cryptographically verifies Supabase access tokens."""

    def __init__(self, settings: APISettings | None = None) -> None:
        self.settings = settings or get_settings()
        self._jwk_client: jwt.PyJWKClient | None = None
        
        if self.settings.supabase_jwks_url:
            try:
                self._jwk_client = jwt.PyJWKClient(
                    self.settings.supabase_jwks_url,
                    cache_jwk_set=True,
                    lifespan=3600,
                )
            except Exception as e:
                logger.warning("Failed to initialize PyJWKClient: %s", type(e).__name__)

    def _get_signing_key(self, token: str) -> Any:
        """Fetch matching JWK signing key or fallback to configured secret."""
        try:
            unverified_header = jwt.get_unverified_header(token)
        except Exception as e:
            raise AuthenticationError("Malformed authentication token header") from e

        alg = unverified_header.get("alg", "HS256")

        # Asymmetric signature verification via JWKS (RS256, ES256, etc.)
        if alg.startswith("RS") or alg.startswith("ES"):
            if not self._jwk_client:
                raise AuthenticationError("JWKS key client not configured on server")
            try:
                signing_key = self._jwk_client.get_signing_key_from_jwt(token)
                return signing_key.key, alg
            except PyJWKClientError as e:
                logger.warning("JWKS key lookup failed: %s", type(e).__name__)
                raise AuthenticationError("Authentication signature verification failed") from e
            except Exception as e:
                logger.warning("JWKS resolution error: %s", type(e).__name__)
                raise AuthenticationError("Authentication signature verification failed") from e

        # Symmetric signature verification via Supabase JWT Secret (HS256)
        if self.settings.supabase_jwt_secret:
            return self.settings.supabase_jwt_secret, "HS256"

        # If JWKS client is available, try it even for other algs
        if self._jwk_client:
            try:
                signing_key = self._jwk_client.get_signing_key_from_jwt(token)
                return signing_key.key, alg
            except Exception:
                pass

        raise AuthenticationError("No verification key available for algorithm")

    def verify_token(self, token: str) -> dict[str, Any]:
        """Verify token signature, issuer, expiration, and return verified claims."""
        if not token or not isinstance(token, str):
            raise AuthenticationError("Missing or invalid token format")

        key, alg = self._get_signing_key(token)

        decode_kwargs: dict[str, Any] = {
            "algorithms": [alg],
            "options": {
                "verify_signature": True,
                "verify_exp": True,
                "require": ["sub", "exp"],
            },
        }

        if self.settings.supabase_issuer:
            decode_kwargs["issuer"] = self.settings.supabase_issuer
            decode_kwargs["options"]["verify_iss"] = True
        else:
            decode_kwargs["options"]["verify_iss"] = False

        if self.settings.supabase_audience:
            decode_kwargs["audience"] = self.settings.supabase_audience
            decode_kwargs["options"]["verify_aud"] = True
        else:
            decode_kwargs["options"]["verify_aud"] = False

        try:
            payload: dict[str, Any] = jwt.decode(token, key=key, **decode_kwargs)
            return payload
        except ExpiredSignatureError as e:
            logger.info("Authentication rejected: Token expired")
            raise AuthenticationError("Authentication token has expired") from e
        except InvalidIssuerError as e:
            logger.warning("Authentication rejected: Invalid issuer")
            raise AuthenticationError("Invalid token issuer") from e
        except InvalidAudienceError as e:
            logger.warning("Authentication rejected: Invalid audience")
            raise AuthenticationError("Invalid token audience") from e
        except InvalidSignatureError as e:
            logger.warning("Authentication rejected: Invalid cryptographic signature")
            raise AuthenticationError("Invalid token signature") from e
        except InvalidTokenError as e:
            logger.warning("Authentication rejected: Invalid token structure: %s", type(e).__name__)
            raise AuthenticationError("Invalid authentication token") from e
        except Exception as e:
            logger.error("Unexpected error during token verification: %s", type(e).__name__)
            raise AuthenticationError("Authentication verification failure") from e

    def resolve_role(self, claims: dict[str, Any]) -> UserRole:
        """Resolve application role strictly from trusted authority.
        
        Security Invariants:
        1. user_metadata is untrusted and strictly ignored.
        2. Primary authority is Supabase server-controlled app_metadata.
        3. Secondary authority is backend settings ntro_analyst_emails whitelist.
        4. Default role is public_user.
        """
        app_metadata = claims.get("app_metadata", {})
        if isinstance(app_metadata, dict):
            # Check app_metadata.role
            meta_role = app_metadata.get("role")
            if isinstance(meta_role, str) and meta_role.lower() in ("ntro_analyst", "ntro", "analyst"):
                return UserRole.NTRO_ANALYST

            # Check app_metadata.roles (list)
            meta_roles = app_metadata.get("roles")
            if isinstance(meta_roles, list):
                clean_roles = {str(r).lower() for r in meta_roles}
                if "ntro_analyst" in clean_roles or "ntro" in clean_roles:
                    return UserRole.NTRO_ANALYST

        # Email whitelist check (if configured in settings)
        email = claims.get("email")
        if email and isinstance(email, str):
            clean_email = email.strip().lower()
            if clean_email in self.settings.ntro_analyst_emails:
                return UserRole.NTRO_ANALYST

        return UserRole.PUBLIC_USER

    def authenticate(self, token: str) -> AuthenticatedUser:
        """Full pipeline: verify token and return trusted AuthenticatedUser."""
        claims = self.verify_token(token)
        
        user_id = claims.get("sub")
        if not user_id or not isinstance(user_id, str):
            raise AuthenticationError("Token missing required subject claim")

        email = claims.get("email") if isinstance(claims.get("email"), str) else None
        role = self.resolve_role(claims)
        app_metadata = claims.get("app_metadata", {}) if isinstance(claims.get("app_metadata"), dict) else {}

        return AuthenticatedUser(
            user_id=user_id,
            email=email,
            role=role,
            app_metadata=app_metadata,
            raw_claims=claims,
        )


_cached_verifier: SupabaseJWTVerifier | None = None


def get_jwt_verifier() -> SupabaseJWTVerifier:
    """Retrieve singleton JWT verifier instance."""
    global _cached_verifier
    if _cached_verifier is None:
        _cached_verifier = SupabaseJWTVerifier()
    return _cached_verifier
