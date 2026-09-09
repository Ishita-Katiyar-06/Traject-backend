from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import MessageService, get_message_service, require_ntro_analyst
from app.schemas.api.messages import MessageDetailResponse, MessageListResponse

router = APIRouter(dependencies=[Depends(require_ntro_analyst)])


@router.get(
    "/messages",
    response_model=MessageListResponse,
    summary="List normalized canonical messages",
    tags=["Messages"],
)
async def list_messages(
    page: int = Query(1, ge=1, description="1-indexed page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size limit"),
    platform: str | None = Query(None, description="Filter by platform (e.g. 'telegram', 'x')"),
    channel_id: str | None = Query(None, description="Filter by author or channel ID"),
    topic_id: str | None = Query(None, description="Filter to messages belonging to a topic cluster"),
    has_media: bool | None = Query(None, description="Filter by media attachment presence"),
    is_forward: bool | None = Query(None, description="Filter by forward status"),
    language: str | None = Query(None, description="Filter by detected ISO language code"),
    sort_by: Literal["published_at", "views_count", "forwards_count"] = Query(
        "published_at", description="Sorting field"
    ),
    order: Literal["asc", "desc"] = Query("desc", description="Sort order"),
    service: MessageService = Depends(get_message_service),
) -> MessageListResponse:
    """Retrieve a paginated collection of normalized canonical social media posts."""
    try:
        items, meta = service.get_messages(
            page=page,
            page_size=page_size,
            platform=platform,
            channel_id=channel_id,
            topic_id=topic_id,
            has_media=has_media,
            is_forward=is_forward,
            language=language,
            sort_by=sort_by,
            order=order,
        )
        return MessageListResponse(data=items, meta=meta)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "DATASET_NOT_FOUND", "message": str(exc)},
        )


@router.get(
    "/messages/{message_id:path}",
    response_model=MessageDetailResponse,
    summary="Retrieve full canonical message by unique identifier",
    tags=["Messages"],
)
async def get_message(
    message_id: str,
    service: MessageService = Depends(get_message_service),
) -> MessageDetailResponse:
    """Retrieve the full forensic record of a canonical message by its identifier.
    
    Supports chat-scoped Telegram IDs (e.g. 'telegram:chan1:101' or 'telegram%3Achan1%3A101')
    and global X IDs (e.g. 'x:182938492').
    """
    try:
        msg = service.get_message(message_id)
        if not msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": "RESOURCE_NOT_FOUND",
                    "message": f"Message with canonical ID '{message_id}' not found.",
                    "details": {"resource_type": "message", "identifier": message_id},
                },
            )
        return MessageDetailResponse(data=msg)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "DATASET_NOT_FOUND", "message": str(exc)},
        )
