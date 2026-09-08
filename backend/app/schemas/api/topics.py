from pydantic import BaseModel, ConfigDict, Field

from app.ml.features.models import (
    TopicEngagementFeatures,
    TopicEntity,
    TopicPropagationFeatures,
    TopicTemporalFeatures,
)
from app.schemas.api.common import PaginationMeta


class TopicKeywordResponse(BaseModel):
    """Keyword with associated c-TF-IDF importance score."""
    model_config = ConfigDict(extra="forbid")

    keyword: str
    score: float = Field(ge=0.0, description="c-TF-IDF score")


class TopicSummaryResponse(BaseModel):
    """Compact topic representation for list views."""
    model_config = ConfigDict(extra="forbid")

    topic_id: str = Field(description="Neutral topic cluster identifier (e.g. topic_000)")
    cluster_label: int = Field(ge=0, description="Internal integer cluster index from HDBSCAN")
    message_count: int = Field(ge=1, description="Total messages in cluster")
    percentage_of_dataset: float = Field(ge=0.0, le=100.0, description="Percentage of total dataset messages")
    representative_keywords: list[TopicKeywordResponse] = Field(default_factory=list)
    trend_name: str | None = Field(default=None, description="Human-readable trend name summarizing central subject")
    trend_summary: str | None = Field(default=None, description="Short evidence-grounded summary of what this trend represents")


class TopicListResponse(BaseModel):
    """Paginated collection response for GET /api/v1/topics."""
    model_config = ConfigDict(extra="forbid")

    data: list[TopicSummaryResponse]
    meta: PaginationMeta


class TopicDetailData(BaseModel):
    """Detailed topic descriptor coupling 4E cluster records with 4F contextual features."""
    model_config = ConfigDict(extra="forbid")

    topic_id: str
    cluster_label: int
    message_count: int
    percentage_of_dataset: float
    representative_keywords: list[TopicKeywordResponse]
    representative_message_ids: list[str]
    sample_message_ids: list[str] = Field(default_factory=list)
    entities: list[TopicEntity] = Field(default_factory=list)
    engagement: TopicEngagementFeatures | None = None
    propagation: TopicPropagationFeatures | None = None
    temporal: TopicTemporalFeatures | None = None
    trend_name: str | None = Field(default=None, description="Human-readable trend name summarizing central subject")
    trend_summary: str | None = Field(default=None, description="Short evidence-grounded summary of what this trend represents")


class TopicDetailResponse(BaseModel):
    """Top-level response envelope for GET /api/v1/topics/{id}."""
    model_config = ConfigDict(extra="forbid")

    data: TopicDetailData
