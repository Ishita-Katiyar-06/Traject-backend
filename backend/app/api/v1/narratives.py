from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import AnalyticsService, get_analytics_service, require_ntro_analyst
from app.schemas.api.narratives import (
    NarrativeDetailResponse,
    NarrativeListResponse,
)

router = APIRouter(dependencies=[Depends(require_ntro_analyst)])


@router.get(
    "/narratives",
    response_model=NarrativeListResponse,
    summary="List prioritized narrative candidates",
    tags=["Narratives"],
)
async def list_narratives(
    page: int = Query(1, ge=1, description="1-indexed page number"),
    page_size: int = Query(20, ge=1, le=1000, description="Page size limit"),
    query: str | None = Query(
        None, description="Search query across narrative IDs, names, summaries, and topics"
    ),
    priority_tier: Literal["critical", "high", "elevated", "routine"] | None = Query(
        None, description="Filter by triage priority classification tier"
    ),
    min_priority: float | None = Query(
        None, ge=0.0, le=1.0, description="Minimum Priority Signal Score threshold"
    ),
    has_coordination_signal: bool | None = Query(
        None, description="Filter to candidates with potential coordination anomalies"
    ),
    sort_by: Literal[
        "priority_signal_score",
        "spread_score",
        "coordination_score",
        "reach_score",
        "friction_score",
        "first_observed_at",
        "last_observed_at",
    ] = Query("priority_signal_score", description="Sorting field"),
    order: Literal["asc", "desc"] = Query("desc", description="Sort order"),
    service: AnalyticsService = Depends(get_analytics_service),
) -> NarrativeListResponse:
    """Retrieve a paginated, filterable collection of prioritized narrative candidates."""
    try:
        items, meta = service.get_narratives(
            page=page,
            page_size=page_size,
            query=query,
            priority_tier=priority_tier,
            min_priority=min_priority,
            has_coordination_signal=has_coordination_signal,
            sort_by=sort_by,
            order=order,
        )
        return NarrativeListResponse(data=items, meta=meta)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "ARTIFACT_NOT_FOUND", "message": str(exc)},
        )


@router.get(
    "/narratives/{narrative_id}",
    response_model=NarrativeDetailResponse,
    summary="Retrieve explainable details for a specific narrative candidate",
    tags=["Narratives"],
)
async def get_narrative(
    narrative_id: str,
    service: AnalyticsService = Depends(get_analytics_service),
) -> NarrativeDetailResponse:
    """Retrieve deep explainability details for a single narrative candidate:
    sub-scores, potential coordination heuristics, evidence coverage, entities,
    and audit attribution rationale.
    """
    try:
        candidate = service.get_narrative(narrative_id)
        if not candidate:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": "RESOURCE_NOT_FOUND",
                    "message": f"Narrative candidate '{narrative_id}' not found.",
                    "details": {"resource_type": "narrative", "identifier": narrative_id},
                },
            )
        return NarrativeDetailResponse(data=candidate)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "ARTIFACT_NOT_FOUND", "message": str(exc)},
        )


@router.get(
    "/narratives/{narrative_id}/sentiment",
    summary="Retrieve chronological sentiment time-series for a specific narrative candidate",
    tags=["Narratives"],
)
async def get_narrative_sentiment(
    narrative_id: str,
    bucket_size: str = Query("1d", description="Bucket size for time-series aggregation (1h, 4h, 6h, 1d)"),
    service: AnalyticsService = Depends(get_analytics_service),
):
    """Retrieve chronological sentiment time-series for a narrative candidate based on its constituent messages.
    Includes the frozen narrative sentiment profile metrics alongside the temporal bucket progression.
    """
    try:
        sentiment = service.get_narrative_sentiment(narrative_id, bucket_size=bucket_size)
        if not sentiment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": "RESOURCE_NOT_FOUND",
                    "message": f"Narrative candidate '{narrative_id}' not found for sentiment analysis.",
                    "details": {"resource_type": "narrative", "identifier": narrative_id},
                },
            )
        return {"data": sentiment}
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "ARTIFACT_NOT_FOUND", "message": str(exc)},
        )

