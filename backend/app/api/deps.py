from fastapi import Depends

from app.core.config import APISettings, get_settings
from app.repositories.artifact_repository import ArtifactRepository, get_artifact_repository
from app.services.analytics_service import AnalyticsService
from app.services.message_service import MessageService


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


__all__ = [
    "APISettings",
    "get_settings",
    "ArtifactRepository",
    "get_artifact_repository",
    "AnalyticsService",
    "get_analytics_service",
    "MessageService",
    "get_message_service",
]
