from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field

from app.ml.features.models import (
    TopicEngagementFeatures,
    TopicEntity,
    TopicPropagationFeatures,
    TopicTemporalFeatures,
)
from app.schemas.api.common import PaginationMeta


# ------------------------------------------------------------------------------
# Trend Core Schemas
# ------------------------------------------------------------------------------

class TrendKeywordResponse(BaseModel):
    """Representative keyword with associated c-TF-IDF importance score."""
    model_config = ConfigDict(extra="forbid")

    keyword: str
    score: float = Field(ge=0.0, description="c-TF-IDF score")


class TrendChannelSummary(BaseModel):
    """Observed public channel/source participating in this Trend."""
    model_config = ConfigDict(extra="forbid")

    channel_id: str
    channel_title: str | None = None
    author_username: str | None = None
    message_count: int = Field(ge=1)
    total_views: int | None = None


class TrendSummaryResponse(BaseModel):
    """Compact trend representation for list and triage views."""
    model_config = ConfigDict(extra="forbid")

    trend_id: str = Field(description="Canonical trend cluster identifier (e.g. trend_000)")
    topic_id: str = Field(description="Compatibility topic cluster identifier (e.g. topic_000)")
    cluster_label: int = Field(ge=0, description="Internal integer cluster index from HDBSCAN")
    label: str = Field(description="Descriptive trend headline or keyword label")
    message_count: int = Field(ge=1, description="Total observed messages in cluster")
    percentage_of_dataset: float = Field(ge=0.0, le=100.0, description="Percentage of total dataset messages")
    representative_keywords: list[TrendKeywordResponse] = Field(default_factory=list)
    associated_narrative_ids: list[str] = Field(default_factory=list, description="Linked narrative identifiers")
    trend_name: str | None = Field(default=None, description="Human-readable trend name summarizing central subject")
    trend_summary: str | None = Field(default=None, description="Short evidence-grounded summary of what this trend represents")


class TrendListResponse(BaseModel):
    """Paginated collection response for GET /api/v1/trends."""
    model_config = ConfigDict(extra="forbid")

    data: list[TrendSummaryResponse]
    meta: PaginationMeta


class TrendDetailData(BaseModel):
    """Comprehensive trend analytical dossier joining cluster representation, contextual features, and sources."""
    model_config = ConfigDict(extra="forbid")

    trend_id: str
    topic_id: str
    cluster_label: int
    label: str
    message_count: int
    percentage_of_dataset: float
    representative_keywords: list[TrendKeywordResponse]
    representative_message_ids: list[str]
    sample_message_ids: list[str] = Field(default_factory=list)
    entities: list[TopicEntity] = Field(default_factory=list)
    engagement: TopicEngagementFeatures | None = None
    propagation: TopicPropagationFeatures | None = None
    temporal: TopicTemporalFeatures | None = None
    channels: list[TrendChannelSummary] = Field(default_factory=list)
    associated_narrative_ids: list[str] = Field(default_factory=list)
    trend_name: str | None = Field(default=None, description="Human-readable trend name summarizing central subject")
    trend_summary: str | None = Field(default=None, description="Short evidence-grounded summary of what this trend represents")


class TrendDetailResponse(BaseModel):
    """Response envelope for GET /api/v1/trends/{id}."""
    model_config = ConfigDict(extra="forbid")

    data: TrendDetailData


# ------------------------------------------------------------------------------
# Trend Node Graph Schemas
# ------------------------------------------------------------------------------

class GraphNode(BaseModel):
    """Single node in the converging trend relationship graph."""
    model_config = ConfigDict(extra="forbid")

    id: str = Field(description="Unique node identifier (e.g. trend:trend_089, channel:1011047399)")
    type: Literal["trend", "channel", "entity", "narrative", "message"] = Field(
        description="Analytical entity type"
    )
    label: str = Field(description="Human-readable node label")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Contextual analytical attributes")


class GraphEdge(BaseModel):
    """Directed edge representing observed relationship converging to or emerging from a trend."""
    model_config = ConfigDict(extra="forbid")

    id: str = Field(description="Unique edge identifier")
    source: str = Field(description="Origin node ID")
    target: str = Field(description="Destination node ID")
    relationship_type: Literal[
        "observed_in",
        "cited_in",
        "promoted_to",
        "contributes_evidence",
        "associated_with",
    ] = Field(description="Semantic relationship type backed by authentic data")
    label: str = Field(description="Human-readable edge label")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Traceable weight or frequency metrics")


class TrendGraphData(BaseModel):
    """Deterministic relationship graph for a trend."""
    model_config = ConfigDict(extra="forbid")

    trend_id: str
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    node_count: int
    edge_count: int


class TrendGraphResponse(BaseModel):
    """Response envelope for GET /api/v1/trends/{id}/graph."""
    model_config = ConfigDict(extra="forbid")

    data: TrendGraphData


# ------------------------------------------------------------------------------
# Sentiment Time-Series Schemas
# ------------------------------------------------------------------------------

class SentimentBucket(BaseModel):
    """Sentiment count and ratio metrics aggregated across a discrete temporal interval."""
    model_config = ConfigDict(extra="forbid")

    bucket_start_utc: str = Field(description="ISO-8601 UTC timestamp of interval start")
    bucket_end_utc: str = Field(description="ISO-8601 UTC timestamp of interval end")
    positive: int = Field(ge=0, description="Count of positive classified messages")
    neutral: int = Field(ge=0, description="Count of neutral classified messages")
    negative: int = Field(ge=0, description="Count of negative classified messages")
    unassigned: int = Field(ge=0, description="Count of messages without text or uncomputed sentiment")
    total: int = Field(ge=0, description="Total messages in bucket (pos + neu + neg + unassigned)")
    net_sentiment: float | None = Field(
        default=None,
        description="Net score (positive - negative) / evaluated if evaluated > 0 else null",
    )


class SentimentSummary(BaseModel):
    """Integrated sentiment distribution across all messages in entity."""
    model_config = ConfigDict(extra="forbid")

    total_messages: int = Field(ge=0)
    evaluated_messages: int = Field(ge=0)
    unassigned_messages: int = Field(ge=0)
    positive_ratio: float | None = Field(default=None, ge=0.0, le=1.0)
    neutral_ratio: float | None = Field(default=None, ge=0.0, le=1.0)
    negative_ratio: float | None = Field(default=None, ge=0.0, le=1.0)
    sentiment_model_id: str | None = Field(default=None)


class TrendSentimentData(BaseModel):
    """Complete temporal sentiment data for a Trend."""
    model_config = ConfigDict(extra="forbid")

    trend_id: str
    topic_id: str
    bucket_size: str = Field(description="Temporal resolution interval (e.g. 1h, 4h, 1d)")
    time_series: list[SentimentBucket]
    summary: SentimentSummary


class TrendSentimentResponse(BaseModel):
    """Response envelope for GET /api/v1/trends/{id}/sentiment."""
    model_config = ConfigDict(extra="forbid")

    data: TrendSentimentData


class NarrativeSentimentData(BaseModel):
    """Complete temporal sentiment data for a Narrative Candidate."""
    model_config = ConfigDict(extra="forbid")

    narrative_id: str
    promoted_from_trend_id: str
    bucket_size: str = Field(description="Temporal resolution interval (e.g. 1h, 4h, 1d)")
    time_series: list[SentimentBucket]
    summary: SentimentSummary


class NarrativeSentimentResponse(BaseModel):
    """Response envelope for GET /api/v1/narratives/{id}/sentiment."""
    model_config = ConfigDict(extra="forbid")

    data: NarrativeSentimentData
