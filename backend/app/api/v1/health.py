from datetime import datetime, timezone
from fastapi import APIRouter, Depends

from app.api.deps import ArtifactRepository, get_artifact_repository
from app.schemas.api.health import HealthResponse

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Check API service operational readiness and artifact loading state",
    tags=["Health"],
)
async def get_health(
    repository: ArtifactRepository = Depends(get_artifact_repository),
) -> HealthResponse:
    """Evaluate liveness and readiness of the TRAJECT Backend Analytics API.
    
    Returns 'healthy' if analytics artifacts are loaded and available in memory,
    or 'degraded' if artifacts are missing or failed to initialize.
    """
    info = repository.get_health_data()
    return HealthResponse(
        status=info["status"],
        version=info["version"],
        artifacts_loaded=info["artifacts_loaded"],
        timestamp_utc=datetime.now(timezone.utc).isoformat(),
        dataset_source=info["dataset_source"],
        active_records_count=info["active_records_count"],
        active_narratives_count=info["active_narratives_count"],
    )
