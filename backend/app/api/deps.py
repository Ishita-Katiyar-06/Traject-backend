from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.auth import AuthenticationError, SupabaseJWTVerifier, get_jwt_verifier
from app.core.config import APISettings, get_settings
from app.repositories.artifact_repository import ArtifactRepository, get_artifact_repository
from app.repositories.forecast_repository import ForecastArtifactRepository, get_forecast_repository
from app.schemas.auth import AuthenticatedUser, UserRole
from app.services.analytics_service import AnalyticsService
from app.services.forecast_service import EmergingTrendForecastService
from app.services.message_service import MessageService

# HTTPBearer with auto_error=False gives us strict control over the error envelope
http_bearer_scheme = HTTPBearer(auto_error=False)


def get_analytics_service(
    repository: ArtifactRepository = Depends(get_artifact_repository),
) -> AnalyticsService:
    """Dependency provider injecting the active ArtifactRepository into AnalyticsService."""
    return AnalyticsService(repository=repository)


def get_message_service(
    repository: ArtifactRepository = Depends(get_artifact_repository),
) -> MessageService:
    """Dependency provider injecting the active ArtifactRepository into MessageService."""
    return MessageService(repository=repository)


def get_forecast_service(
    repository: ForecastArtifactRepository = Depends(get_forecast_repository),
) -> EmergingTrendForecastService:
    """Dependency provider injecting the active ForecastArtifactRepository into EmergingTrendForecastService."""
    return EmergingTrendForecastService(repository=repository)


# ==============================================================================
# Milestone 9B: Authentication & Role Authorization Dependencies
# ==============================================================================


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(http_bearer_scheme),
    verifier: SupabaseJWTVerifier = Depends(get_jwt_verifier),
) -> AuthenticatedUser:
    """Validate Bearer JWT and return trusted AuthenticatedUser.
    
    Rejects missing, malformed, expired, or invalid tokens with HTTP 401.
    """
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Missing authorization header"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    if credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Invalid authentication scheme, Bearer required"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user = verifier.authenticate(credentials.credentials)
        return user
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": exc.message},
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Invalid or expired authentication credentials"},
            headers={"WWW-Authenticate": "Bearer"},
        )


async def require_authenticated_user(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    """Ensure the caller has an authenticated session (any valid role)."""
    return current_user


async def require_public_or_ntro(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    """Ensure the caller is an authenticated public_user or ntro_analyst."""
    if current_user.role not in (UserRole.PUBLIC_USER, UserRole.NTRO_ANALYST):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Insufficient permissions"},
        )
    return current_user


async def require_ntro_analyst(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    """Enforce institutional NTRO clearance.
    
    Returns 403 Forbidden if user is authenticated as public_user.
    """
    if current_user.role != UserRole.NTRO_ANALYST:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "FORBIDDEN",
                "message": "Insufficient permissions: NTRO analyst clearance required",
            },
        )
    return current_user


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(http_bearer_scheme),
    verifier: SupabaseJWTVerifier = Depends(get_jwt_verifier),
) -> AuthenticatedUser | None:
    """Extract authenticated user if present; returns None if anonymous or invalid."""
    if credentials is None or not credentials.credentials:
        return None
    try:
        return verifier.authenticate(credentials.credentials)
    except Exception:
        return None


__all__ = [
    "APISettings",
    "get_settings",
    "ArtifactRepository",
    "get_artifact_repository",
    "ForecastArtifactRepository",
    "get_forecast_repository",
    "AnalyticsService",
    "get_analytics_service",
    "MessageService",
    "get_message_service",
    "EmergingTrendForecastService",
    "get_forecast_service",
    "get_jwt_verifier",
    "get_current_user",
    "require_authenticated_user",
    "require_public_or_ntro",
    "require_ntro_analyst",
    "get_optional_user",
]
