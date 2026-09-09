from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import AnalyticsService, get_analytics_service, require_ntro_analyst
from app.schemas.api.analytics import AnalyticsOverviewResponse

router = APIRouter(dependencies=[Depends(require_ntro_analyst)])


@router.get(
    "/analytics",
    response_model=AnalyticsOverviewResponse,
    summary="Retrieve high-level dashboard analytics summary",
    tags=["Analytics"],
)
async def get_analytics(
    service: AnalyticsService = Depends(get_analytics_service),
) -> AnalyticsOverviewResponse:
    """Provide dashboard-oriented summary metrics: message counts, topic totals,
    priority tier distribution, sentiment overview, and pipeline execution metadata.
    """
    try:
        overview_data = service.get_overview()
        return AnalyticsOverviewResponse(data=overview_data)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "ARTIFACT_NOT_FOUND",
                "message": str(exc),
            },
        )
