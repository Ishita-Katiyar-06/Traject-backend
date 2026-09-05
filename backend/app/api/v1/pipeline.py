from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import ArtifactRepository, get_artifact_repository
from app.schemas.api.pipeline import PipelineMetricsResponse, PipelineStatusResponse

router = APIRouter()


@router.get(
    "/pipeline/status",
    response_model=PipelineStatusResponse,
    summary="Retrieve pipeline lifecycle and provenance metadata",
    tags=["Pipeline"],
)
async def get_pipeline_status(
    repository: ArtifactRepository = Depends(get_artifact_repository),
) -> PipelineStatusResponse:
    """Expose high-level pipeline provenance, completion timestamp, schema version,
    and inference cache operational state.
    """
    try:
        return repository.get_pipeline_status()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "PIPELINE_METRICS_UNAVAILABLE", "message": str(exc)},
        )


@router.get(
    "/pipeline/metrics",
    response_model=PipelineMetricsResponse,
    summary="Retrieve audit-ready performance, latency, and memory metrics",
    tags=["Pipeline"],
)
async def get_pipeline_metrics(
    repository: ArtifactRepository = Depends(get_artifact_repository),
) -> PipelineMetricsResponse:
    """Expose granular stage latencies, cold-start vs warm timings, throughputs,
    inference cache hit rates, Peak RSS, and Python heap memory usage recorded during
    the upstream ML pipeline run.
    """
    try:
        return repository.get_pipeline_metrics()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "PIPELINE_METRICS_UNAVAILABLE", "message": str(exc)},
        )
