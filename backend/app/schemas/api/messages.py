from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.api.common import PaginationMeta
from app.schemas.canonical_message import AuthorType, CanonicalMessage, Platform


class MessageSummaryResponse(BaseModel):
    """Compact summary of a social media post for feed lists."""
    model_config = ConfigDict(extra="forbid")

    canonical_id: str
    platform: Platform
    native_id: str
    author_id: str
    channel_title: str | None = None
    published_at: datetime
    text_content: str
    language: str | None = None
    views_count: int | None = None
    forwards_count: int | None = None
    has_media: bool = False
    is_forward: bool = False


class MessageListResponse(BaseModel):
    """Paginated collection response for GET /api/v1/messages."""
    model_config = ConfigDict(extra="forbid")

    data: list[MessageSummaryResponse]
    meta: PaginationMeta


class MessageDetailData(CanonicalMessage):
    """Full canonical message record augmented with analytical context."""
    assigned_topic_id: str | None = Field(default=None, description="Discovered topic ID message is assigned to")


class MessageDetailResponse(BaseModel):
    """Top-level response envelope for GET /api/v1/messages/{id}."""
    model_config = ConfigDict(extra="forbid")

    data: MessageDetailData
