from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import AnalyticsService, get_analytics_service
from app.schemas.api.topics import TopicDetailResponse, TopicListResponse

router = APIRouter()


@router.get(
    "/topics",
    response_model=TopicListResponse,
    summary="List discovered semantic topic clusters",
    tags=["Topics"],
)
async def list_topics(
    page: int = Query(1, ge=1, description="1-indexed page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size limit"),
    min_messages: int | None = Query(None, ge=1, description="Minimum messages in cluster"),
    sort_by: Literal["message_count", "percentage_of_dataset", "topic_id"] = Query(
        "message_count", description="Sorting field"
    ),
    order: Literal["asc", "desc"] = Query("desc", description="Sort order"),
    service: AnalyticsService = Depends(get_analytics_service),
) -> TopicListResponse:
    """Retrieve a paginated collection of discovered semantic topic clusters."""
    try:
        items, meta = service.get_topics(
            page=page,
            page_size=page_size,
            min_messages=min_messages,
            sort_by=sort_by,
            order=order,
        )
        return TopicListResponse(data=items, meta=meta)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "ARTIFACT_NOT_FOUND", "message": str(exc)},
        )


@router.get(
    "/topics/{topic_id}",
    response_model=TopicDetailResponse,
    summary="Retrieve diagnostic details for a specific topic cluster",
    tags=["Topics"],
)
async def get_topic(
    topic_id: str,
    service: AnalyticsService = Depends(get_analytics_service),
) -> TopicDetailResponse:
    """Retrieve deep topic intelligence joining 4E representation with 4F contextual
    features: entities, engagement ratios, propagation cascades, and temporal metrics.
    """
    try:
        detail = service.get_topic(topic_id)
        if not detail:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": "RESOURCE_NOT_FOUND",
                    "message": f"Topic cluster '{topic_id}' not found.",
                    "details": {"resource_type": "topic", "identifier": topic_id},
                },
            )
        return TopicDetailResponse(data=detail)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "ARTIFACT_NOT_FOUND", "message": str(exc)},
        )
