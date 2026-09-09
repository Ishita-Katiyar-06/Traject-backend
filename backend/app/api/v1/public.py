"""
Public Data API Endpoints (Milestone 9C).

Provides strictly public-safe data representations for Trends and Emerging Trends.
Never requires institutional NTRO clearance and guarantees zero leaks of sensitive
intelligence indicators, raw posts, author/channel identities, or internal features.
"""

from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import (
    AnalyticsService,
    EmergingTrendForecastService,
    get_analytics_service,
    get_forecast_service,
)
from app.schemas.api.common import PaginationMeta
from app.schemas.api.public import (
    PublicEmergingTrendsResponse,
    PublicTrendDetailResponse,
    PublicTrendForecast,
    PublicTrendListResponse,
    PublicTrendSummary,
)

router = APIRouter(prefix="/public", tags=["Public Trends & Forecasting"])


@router.get(
    "/trends",
    response_model=PublicTrendListResponse,
    summary="List public trends with sanitized summary metrics",
)
async def list_public_trends(
    page: int = Query(1, ge=1, description="1-indexed page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size limit"),
    min_messages: int | None = Query(None, ge=1, description="Minimum volume threshold"),
    sort_by: Literal["message_count", "percentage_of_dataset", "topic_id"] = Query(
        "message_count", description="Sorting field"
    ),
    order: Literal["asc", "desc"] = Query("desc", description="Sort order"),
    service: AnalyticsService = Depends(get_analytics_service),
) -> PublicTrendListResponse:
    """Retrieve public-safe paginated trends without internal cluster diagnostics."""
    try:
        topics, meta = service.get_topics(
            page=page,
            page_size=page_size,
            min_messages=min_messages,
            sort_by=sort_by,
            order=order,
        )

        public_items = [
            PublicTrendSummary(
                topic_id=t.topic_id,
                topic_name=t.trend_name or t.topic_id.replace("_", " ").title(),
                keywords=[k.keyword for k in t.representative_keywords[:8]],
                message_count=t.message_count,
                relative_volume=round(t.percentage_of_dataset / 100.0, 4),
                trajectory_phase="STABLE",
            )
            for t in topics
        ]

        return PublicTrendListResponse(data=public_items, meta=meta)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "TRENDS_UNAVAILABLE", "message": str(exc)},
        )


@router.get(
    "/trends/{topic_id}",
    response_model=PublicTrendDetailResponse,
    summary="Retrieve public-safe trend details",
)
async def get_public_trend(
    topic_id: str,
    service: AnalyticsService = Depends(get_analytics_service),
) -> PublicTrendDetailResponse:
    """Retrieve public-safe trend details stripping all raw messages, author IDs, and cascade topology."""
    try:
        detail = service.get_topic(topic_id)
        if not detail:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "RESOURCE_NOT_FOUND", "message": f"Trend '{topic_id}' was not found."},
            )

        keywords = [k.keyword for k in detail.representative_keywords[:10]]
        name = detail.trend_name or topic_id.replace("_", " ").title()
        desc = (
            detail.trend_summary
            or f"Public discourse trend focusing on {', '.join(keywords[:5])}."
        )

        temporal_buckets = []
        if detail.temporal and hasattr(detail.temporal, "hourly_bucket_counts"):
            for ts, count in detail.temporal.hourly_bucket_counts.items():
                temporal_buckets.append({"timestamp": ts, "volume": count})

        return PublicTrendDetailResponse(
            topic_id=detail.topic_id,
            topic_name=name,
            keywords=keywords,
            description=desc,
            message_count=detail.message_count,
            relative_volume=round(detail.percentage_of_dataset / 100.0, 4),
            trajectory_phase="STABLE",
            temporal_volume=temporal_buckets,
        )
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "TRENDS_UNAVAILABLE", "message": str(exc)},
        )


@router.get(
    "/forecasting/emerging-trends",
    response_model=PublicEmergingTrendsResponse,
    summary="Get sanitized public emerging trend forecasts",
)
async def get_public_emerging_trends(
    horizon_hours: int = Query(24, description="Forecast horizon in hours (24 or 6)"),
    min_score: float = Query(0.0, ge=0.0, le=1.0, description="Minimum Emerging Trend Score filter"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of ranked forecasts to return"),
    service: EmergingTrendForecastService = Depends(get_forecast_service),
) -> PublicEmergingTrendsResponse:
    """Public forecast endpoint exposing strictly sanitized forecasts.
    
    Zero exposure of internal velocity kinetics, channel diffusion rates, burstiness indices,
    or internal artifact hashes.
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
        raw_res = service.get_emerging_trends(
            horizon_hours=horizon_hours,
            min_score=min_score,
            tier=None,
            limit=limit,
        )

        sanitized_forecasts = []
        for f in raw_res.forecasts:
            activity = "High" if f.recent_message_count >= 10 else ("Moderate" if f.recent_message_count >= 3 else "Low")
            sanitized_forecasts.append(
                PublicTrendForecast(
                    topic_id=f.topic_id,
                    topic_name=f.topic_name or f.topic_id.replace("_", " ").title(),
                    topic_keywords=f.topic_keywords,
                    horizon_hours=f.horizon_hours,
                    forecast_score=round(f.forecast_score, 4),
                    forecast_rank=f.forecast_rank,
                    forecast_tier=str(f.forecast_tier.value if hasattr(f.forecast_tier, "value") else f.forecast_tier),
                    trajectory_phase=str(f.trajectory_phase.value if hasattr(f.trajectory_phase, "value") else f.trajectory_phase),
                    confidence_tier=str(f.confidence_tier.value if hasattr(f.confidence_tier, "value") else f.confidence_tier),
                    recent_activity_level=activity,
                    historical_message_count=f.historical_message_count,
                    cutoff_at=f.cutoff_at,
                    generated_at=f.generated_at,
                )
            )

        return PublicEmergingTrendsResponse(
            horizon_hours=raw_res.artifact.horizon_hours,
            generated_at_utc=raw_res.artifact.generated_at_utc,
            cutoff_at_utc=raw_res.artifact.cutoff_at_utc,
            total_emerging_trends=len(sanitized_forecasts),
            forecasts=sanitized_forecasts,
        )
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "FORECAST_UNAVAILABLE", "message": str(exc)},
        )
