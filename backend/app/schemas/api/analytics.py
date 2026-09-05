from pydantic import BaseModel, ConfigDict, Field


class DatasetSummaryCounts(BaseModel):
    """High-level volume metrics for the ingested dataset."""
    model_config = ConfigDict(extra="forbid")

    total_messages: int = Field(ge=0, description="Total messages in the dataset")
    text_bearing_messages: int = Field(ge=0, description="Messages containing non-empty text")
    media_only_messages: int = Field(ge=0, description="Messages containing media attachments with empty text")
    total_topics: int = Field(ge=0, description="Total cohesive topic clusters discovered by HDBSCAN")
    total_narratives: int = Field(ge=0, description="Total prioritized narrative candidates synthesized")
    noise_messages: int = Field(ge=0, description="Messages classified as noise/outliers by HDBSCAN")


class SentimentDistribution(BaseModel):
    """Relative ratios of positive, neutral, and negative sentiment."""
    model_config = ConfigDict(extra="forbid")

    positive_ratio: float = Field(ge=0.0, le=1.0)
    neutral_ratio: float = Field(ge=0.0, le=1.0)
    negative_ratio: float = Field(ge=0.0, le=1.0)


class SentimentOverview(BaseModel):
    """Integrated textual sentiment statistics across evaluated messages."""
    model_config = ConfigDict(extra="forbid")

    sentiment_model_id: str | None = Field(description="Pretrained model identifier used for sentiment analysis")
    evaluated_messages_count: int = Field(ge=0, description="Total text messages evaluated for sentiment")
    distribution: SentimentDistribution


class PipelineExecutionSummary(BaseModel):
    """Summary of the upstream pipeline run that produced the precomputed analytics."""
    model_config = ConfigDict(extra="forbid")

    created_at_utc: str = Field(description="Artifact generation timestamp (ISO-8601)")
    total_runtime_seconds: float = Field(ge=0.0, description="Total pipeline execution time in seconds")
    cache_hit_rate: float = Field(ge=0.0, le=1.0, description="Inference cache hit rate achieved")


class AnalyticsOverviewData(BaseModel):
    """Top-level container for dashboard summary analytics."""
    model_config = ConfigDict(extra="forbid")

    dataset_source: str = Field(description="Identifier or path of source dataset")
    summary_counts: DatasetSummaryCounts
    priority_distribution: dict[str, int] = Field(description="Candidate counts grouped by priority tier")
    sentiment_overview: SentimentOverview
    pipeline_execution: PipelineExecutionSummary


class AnalyticsOverviewResponse(BaseModel):
    """Top-level response envelope for GET /api/v1/analytics."""
    model_config = ConfigDict(extra="forbid")

    data: AnalyticsOverviewData
