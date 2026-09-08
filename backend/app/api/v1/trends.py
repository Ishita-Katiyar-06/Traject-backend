from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import AnalyticsService, get_analytics_service
from app.schemas.api.trends import (
    TrendDetailResponse,
    TrendGraphResponse,
    TrendListResponse,
    TrendSentimentResponse,
)

router = APIRouter()


@router.get(
    "/trends",
    response_model=TrendListResponse,
    summary="List discovered semantic trend clusters",
    tags=["Trends"],
)
async def list_trends(
    page: int = Query(1, ge=1, description="1-indexed page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size limit"),
    min_messages: int | None = Query(None, ge=1, description="Minimum messages in cluster"),
    sort_by: Literal["message_count", "percentage_of_dataset", "trend_id", "topic_id"] = Query(
        "message_count", description="Sorting field"
    ),
    order: Literal["asc", "desc"] = Query("desc", description="Sort order"),
    service: AnalyticsService = Depends(get_analytics_service),
) -> TrendListResponse:
    """Retrieve a paginated collection of discovered semantic trend clusters."""
    try:
        items, meta = service.get_trends(
            page=page,
            page_size=page_size,
            min_messages=min_messages,
            sort_by=sort_by,
            order=order,
        )
        return TrendListResponse(data=items, meta=meta)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "ARTIFACT_NOT_FOUND", "message": str(exc)},
        )


@router.get(
    "/trends/{trend_id}",
    response_model=TrendDetailResponse,
    summary="Retrieve analytical details for a specific trend cluster",
    tags=["Trends"],
)
async def get_trend(
    trend_id: str,
    service: AnalyticsService = Depends(get_analytics_service),
) -> TrendDetailResponse:
    """Retrieve deep trend intelligence: representative keywords, entities, engagement ratios,
    propagation patterns, observed channels, and linked narrative candidates.
    Supports either 'trend_XXX' or 'topic_XXX' identifiers interchangeably.
    """
    try:
        detail = service.get_trend(trend_id)
        if not detail:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": "RESOURCE_NOT_FOUND",
                    "message": f"Trend cluster '{trend_id}' not found.",
                    "details": {"resource_type": "trend", "identifier": trend_id},
                },
            )
        return TrendDetailResponse(data=detail)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "ARTIFACT_NOT_FOUND", "message": str(exc)},
        )


@router.get(
    "/trends/{trend_id}/graph",
    response_model=TrendGraphResponse,
    summary="Retrieve converging node graph for a specific trend cluster",
    tags=["Trends"],
)
async def get_trend_graph(
    trend_id: str,
    service: AnalyticsService = Depends(get_analytics_service),
) -> TrendGraphResponse:
    """Retrieve deterministic converging relationship graph translating authentic Telegram channel sources,
    extracted domain/hashtag entities, and promoted narrative intelligence into a centralized trend topology.
    """
    try:
        graph = service.get_trend_graph(trend_id)
        if not graph:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": "RESOURCE_NOT_FOUND",
                    "message": f"Trend cluster '{trend_id}' not found for graph generation.",
                    "details": {"resource_type": "trend", "identifier": trend_id},
                },
            )
        return TrendGraphResponse(data=graph)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "ARTIFACT_NOT_FOUND", "message": str(exc)},
        )


@router.get(
    "/trends/{trend_id}/sentiment",
    response_model=TrendSentimentResponse,
    summary="Retrieve chronological sentiment time-series for a trend cluster",
    tags=["Trends"],
)
async def get_trend_sentiment(
    trend_id: str,
    service: AnalyticsService = Depends(get_analytics_service),
) -> TrendSentimentResponse:
    """Retrieve chronological sentiment time-series based on authentic message timestamps and RoBERTa classifications.
    Messages without text or unassigned sentiment are transparently tracked as unassigned without synthetic neutrality.
    """
    try:
        sentiment = service.get_trend_sentiment(trend_id)
        if not sentiment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": "RESOURCE_NOT_FOUND",
                    "message": f"Trend cluster '{trend_id}' not found for sentiment analysis.",
                    "details": {"resource_type": "trend", "identifier": trend_id},
                },
            )
        return TrendSentimentResponse(data=sentiment)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "ARTIFACT_NOT_FOUND", "message": str(exc)},
        )
