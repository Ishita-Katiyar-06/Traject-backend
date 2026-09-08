"""
Milestone 8E: Emerging Trend Forecasting API Router.

Production backend product boundary exposing precomputed emerging trend forecasts
and subsystem operational status via typed FastAPI endpoints. Zero runtime clustering,
embedding, or feature inference is performed inside request paths.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_forecast_service
from app.schemas.forecasting import (
    EmergingTrendsApiResponse,
    ForecastTier,
    ForecastingStatusResponse,
)
from app.services.forecast_service import EmergingTrendForecastService

logger = logging.getLogger("traject.api.v1.forecasting")

router = APIRouter(prefix="/forecasting", tags=["Forecasting"])


@router.get(
    "/emerging-trends",
    response_model=EmergingTrendsApiResponse,
    summary="Get precomputed emerging trend forecasts",
    response_description="Envelope containing artifact summary metadata and ranked emerging trend forecasts",
)
def get_emerging_trend_forecasts(
    horizon_hours: int = Query(24, description="Forecast horizon in hours. Supported: 24 (primary), 6 (auxiliary)"),
    min_score: float = Query(0.0, ge=0.0, le=1.0, description="Minimum Emerging Trend Score filter [0.0, 1.0]"),
    tier: ForecastTier | None = Query(None, description="Optional categorical tier filter (Emerging, Candidate, Developing, Low Activity)"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of ranked forecasts to return [1, 200]"),
    service: EmergingTrendForecastService = Depends(get_forecast_service),
) -> EmergingTrendsApiResponse:
    """Retrieve precomputed Emerging Trend Forecasts for currently active topics.
    
    Serves directly from the cached immutable batch forecast artifact.
    Topics are canonically sorted by forecast_rank (1 = highest emerging potential).
    """
    if horizon_hours not in (24, 6):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "UNSUPPORTED_HORIZON",
                "message": f"Unsupported horizon_hours: {horizon_hours}. Supported horizons: [24, 6]",
            },
        )

    try:
        return service.get_emerging_trends(
            horizon_hours=horizon_hours,
            min_score=min_score,
            tier=tier,
            limit=limit,
        )
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "FORECAST_ARTIFACT_NOT_FOUND",
                "message": f"Precomputed forecast artifact does not exist: {exc}",
            },
        ) from exc
    except ValueError as exc:
        err_msg = str(exc)
        if "Corrupted forecast artifact" in err_msg:
            logger.error("Forecast artifact corruption detected: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "code": "FORECAST_ARTIFACT_CORRUPT",
                    "message": f"Failed to load forecast artifact: {exc}",
                },
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "VALIDATION_ERROR", "message": err_msg},
        ) from exc


@router.get(
    "/status",
    response_model=ForecastingStatusResponse,
    summary="Get forecasting subsystem operational status and freshness",
    response_description="Forecasting subsystem availability, active artifact provenance, and horizons",
)
def get_forecasting_status(
    service: EmergingTrendForecastService = Depends(get_forecast_service),
) -> ForecastingStatusResponse:
    """Check whether precomputed forecast artifacts are available, valid, and fresh.
    
    Returns provenance metadata including cutoff_at_utc, generated_at_utc,
    strategy version, score version, and supported horizons.
    """
    return service.get_status()
