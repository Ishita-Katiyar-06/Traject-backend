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
    author_username: str | None = None
    url: str | None = None
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


class TriageRequest(BaseModel):
    """Payload for on-demand forensic triage of an incoming or forwarded message."""
    model_config = ConfigDict(extra="forbid")

    text: str = Field(..., min_length=2, max_length=15000, description="Raw or forwarded post text to analyze")
    author: str | None = Field(default=None, description="Author username or channel name if available")
    forward_origin: str | None = Field(default=None, description="Original source channel or user if forwarded")
    views: int | None = Field(default=None, ge=0, description="Observed view count if available")
    forwards: int | None = Field(default=None, ge=0, description="Observed forward count if available")


class TriageReportResponse(BaseModel):
    """Forensic report card returned by on-demand triage engine."""
    model_config = ConfigDict(extra="forbid")

    processed_text: str
    detected_language: str
    language_confidence: float
    sentiment_label: str
    sentiment_confidence: float
    negative_ratio: float
    matched_narrative_id: str | None = None
    matched_narrative_title: str | None = None
    similarity_percentage: float = 0.0
    estimated_priority_tier: str
    estimated_priority_score: float
    uncredited_syndication_detected: bool = False
    syndicated_channel_count: int = 0
    indicators: list[str] = Field(default_factory=list)
    triaged_at_utc: str

