"""
Milestone 8C: Emerging Trend Forecasting Schemas.

Defines typed contracts for walk-forward cutoffs, future prominence ground-truth
targets, baseline forecasting predictions, and classification/ranking evaluation metrics.
"""
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any
from pydantic import BaseModel, ConfigDict, Field, field_validator


class ForecastTier(StrEnum):
    """Categorical emergence prioritization tier."""
    STRONG_EMERGENCE = "STRONG_EMERGENCE"
    MODERATE_EMERGENCE = "MODERATE_EMERGENCE"
    EARLY_SIGNAL = "EARLY_SIGNAL"
    LOW_MOMENTUM = "LOW_MOMENTUM"


class TrajectoryPhase(StrEnum):
    """Interpretable temporal trajectory classification."""
    ACCELERATING = "ACCELERATING"
    GROWING = "GROWING"
    PERSISTENT = "PERSISTENT"
    STABLE = "STABLE"
    WEAKENING = "WEAKENING"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"


class ConfidenceTier(StrEnum):
    """Forecast confidence based on historical data depth and continuity."""
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"


class WalkForwardCutoff(BaseModel):
    """Specification of a single temporal walk-forward evaluation cutoff."""
    model_config = ConfigDict(extra="forbid")

    cutoff_id: str = Field(description="Unique cutoff identifier, e.g. cutoff_20260901_1200")
    cutoff_at_utc: datetime = Field(description="Historical evaluation cutoff timestamp T")
    horizon_hours: int = Field(default=24, description="Evaluation forecast horizon H in hours (e.g. 6 or 24)")
    candidate_topics_count: int = Field(description="Eligible candidate topics circulating at cutoff T")
    active_future_topics_count: int = Field(description="Topics with >=1 message during (T, T+H]")
    prominent_future_topics_count: int = Field(description="Topics meeting ground truth prominence criteria")
    known_topics_count: int = Field(default=0, description="Total known topics with >=1 message <= T")
    zero_future_topics_count: int = Field(default=0, description="Candidate topics with 0 messages in (T, T+H]")
    positive_percentage: float = Field(default=0.0, description="Percentage of candidate topics that are prominent")
    prominence_threshold: float = Field(default=0.80, description="Percentile threshold among active topics")

    total_messages_available: int = Field(default=0, description="Total corpus messages published <= T")
    candidate_messages_count: int = Field(default=0, description="Candidate topic messages published <= T")
    excluded_messages_count: int = Field(default=0, description="Noise or non-candidate messages <= T")
    future_messages_count: int = Field(default=0, description="Future messages in (T, T+H] used only for evaluation")

    @field_validator("cutoff_at_utc")
    @classmethod
    def validate_utc(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError(f"Cutoff must be timezone-aware UTC, got {v}")
        return v.astimezone(timezone.utc)


class CausalTopicProfile(BaseModel):
    """Immutable causal snapshot of a topic's representation at cutoff timestamp T."""
    model_config = ConfigDict(extra="forbid")

    topic_id: str
    cutoff_at_utc: datetime
    historical_message_count: int = Field(ge=0, description="Total messages published <= T")
    historical_message_ids: list[str] = Field(default_factory=list, description="Message IDs published <= T")
    historical_keywords: list[str] = Field(default_factory=list, description="Top representative keywords derived strictly from messages <= T")
    historical_centroid: list[float] | None = Field(default=None, description="Normalized dense embedding centroid derived strictly from messages <= T")
    is_candidate: bool = Field(description="True if topic has >= 1 message in (T - 48h, T]")
    first_seen_at_utc: datetime | None = None
    last_seen_at_utc: datetime | None = None


class TopicForecastTarget(BaseModel):
    """Ground-truth future outcome dimensions computed strictly over (T, T+H]."""
    model_config = ConfigDict(extra="forbid")

    topic_id: str
    cutoff_at_utc: datetime
    horizon_hours: int

    # Primary Outcome
    future_is_prominent: bool = Field(
        description="Primary binary target label: topic achieved prominent activity in future horizon"
    )
    future_prominence_rank: int = Field(
        description="1-based rank among eligible candidate topics by future volume"
    )
    future_prominence_percentile: float = Field(
        ge=0.0, le=1.0,
        description="Percentile rank (0.0 to 1.0) among eligible candidate topics"
    )

    # Supporting Outcome Dimensions (Section 5)
    future_message_count: int = Field(ge=0, description="Actual messages published in (T, T+H]")
    future_distinct_channels: int = Field(ge=0, description="Distinct channels publishing topic in (T, T+H]")
    future_is_persistent: bool = Field(description="Persistence indicator: future_message_count >= 1")
    future_is_growth: bool = Field(description="Growth indicator: future velocity exceeds historical baseline")
    future_is_diffused: bool = Field(description="Diffusion indicator: expanded to >= 2 channels in future horizon")

    @field_validator("cutoff_at_utc")
    @classmethod
    def validate_utc(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError(f"Datetime must be timezone-aware UTC, got {v}")
        return v.astimezone(timezone.utc)


class BaselineEvaluationReport(BaseModel):
    """Comprehensive evaluation metrics for a deterministic baseline over a walk-forward experiment."""
    model_config = ConfigDict(extra="forbid")

    baseline_name: str
    horizon_hours: int
    total_cutoffs: int
    total_samples: int
    positive_samples: int
    positive_rate: float

    # Classification Metrics
    precision: float
    recall: float
    f1: float
    roc_auc: float | None = None
    pr_auc: float | None = None

    # Ranking Metrics (Analyst Prioritization)
    precision_at_5: float
    precision_at_10: float
    precision_at_20: float
    recall_at_5: float
    recall_at_10: float
    recall_at_20: float

    # Coverage & Quality
    forecast_coverage_pct: float
    unavailable_feature_pct: float


class WalkForwardBacktestArtifact(BaseModel):
    """Complete, serializable artifact capturing the Milestone 8C walk-forward backtest."""
    model_config = ConfigDict(extra="forbid")

    artifact_id: str
    created_at_utc: str
    target_definition: str
    horizon_hours: int
    cutoffs: list[WalkForwardCutoff]
    baseline_results: dict[str, BaselineEvaluationReport]
    per_cutoff_baseline_results: dict[str, dict[str, BaselineEvaluationReport]] = Field(
        default_factory=dict, description="Cutoff-specific baseline evaluation reports"
    )
    leakage_checks_passed: bool
    data_quality_summary: dict[str, Any]
    limitations: list[str]
    forecasting_readiness_verdict: str


class EmergingTrendForecast(BaseModel):
    """Strict Pydantic v2 contract for an emerging trend topic forecast at cutoff T."""
    model_config = ConfigDict(extra="forbid")

    topic_id: str = Field(description="Forecasting topic identifier")
    topic_name: str | None = Field(default=None, description="Human-readable title or trend name for the emerging topic")
    topic_keywords: list[str] = Field(default_factory=list, description="Representative keywords characterizing the topic")
    cutoff_at: datetime = Field(description="Cutoff timestamp T for causal feature isolation (UTC)")
    horizon_hours: int = Field(default=24, description="Forecast horizon H in hours (e.g. 24)")
    forecast_score: float = Field(
        ge=0.0, le=1.0,
        description="Emerging Trend Score (relative momentum/prominence likelihood in [0.0, 1.0])"
    )
    forecast_rank: int = Field(ge=1, description="1-based forecast priority rank at cutoff T")
    forecast_tier: ForecastTier = Field(description="Categorical emergence tier (e.g. STRONG_EMERGENCE)")
    trajectory_phase: TrajectoryPhase = Field(description="Interpretable trajectory classification")
    confidence_tier: ConfidenceTier = Field(description="Forecast confidence based on historical data depth")

    # Supporting Temporal Features (derived strictly from messages <= T)
    historical_message_count: int = Field(ge=0, description="Total messages published in topic <= T")
    recent_message_count: int = Field(ge=0, description="Messages published in recent window (T - 24h, T]")
    messages_24h: int = Field(ge=0, default=0, description="Messages published in last 24 hours (T - 24h, T]")
    baseline_message_count: int = Field(ge=0, description="Messages published in baseline window (T - 48h, T - 24h]")
    growth_velocity: float = Field(ge=0.0, description="Recent publication velocity (messages / hour)")
    velocity_6h: float = Field(ge=0.0, default=0.0, description="Recent 6-hour publication velocity (messages / hour)")
    acceleration_factor: float | None = Field(
        default=None,
        description="Observed velocity change rate (msgs/hr^2), None if insufficient history"
    )
    persistence_score: float = Field(
        ge=0.0, le=1.0,
        description="Fraction of active hourly windows in the recent window"
    )
    channel_diffusion_rate: float = Field(ge=0.0, description="Ratio of new channels publishing in recent window")
    domain_diffusion_rate: float = Field(
        ge=0.0,
        description="Diffusion rate across distinct source domains / platform channels"
    )
    burstiness_index: float | None = Field(
        default=None,
        description="Goh-Barabasi burstiness parameter (-1.0 to 1.0), None if insufficient data"
    )

    # Feature Availability Metadata
    publication_kinetics_available: bool = Field(default=True, description="True if publication kinetics signals are valid")
    acceleration_available: bool = Field(default=False, description="True if history is sufficient for acceleration")
    engagement_signal_available: bool = Field(default=False, description="True if temporal engagement observations are available")

    generated_at: datetime = Field(description="UTC timestamp when the forecast was generated")

    @field_validator("cutoff_at", "generated_at")
    @classmethod
    def validate_utc(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError(f"Timestamp must be timezone-aware UTC, got {v}")
        return v.astimezone(timezone.utc)


class EmergingTrendForecastArtifact(BaseModel):
    """Immutable batch artifact containing emerging trend forecasts for a specific cutoff."""
    model_config = ConfigDict(extra="forbid")

    artifact_id: str
    generated_at_utc: datetime
    cutoff_at_utc: datetime
    horizon_hours: int
    causal_representation_version: str = "8C.1_causal_hdbscan"
    feature_engine_version: str = "8A_kinetics_v1"
    score_version: str = "8D.1_vol_vel_hybrid_v1"
    total_candidate_topics: int
    forecasts: list[EmergingTrendForecast]
    metadata: dict[str, Any] = Field(default_factory=dict)


class ForecastArtifactSummary(BaseModel):
    """Provenance and lifecycle summary for a precomputed forecast artifact."""
    model_config = ConfigDict(extra="forbid")

    artifact_id: str
    generated_at_utc: datetime
    cutoff_at_utc: datetime
    horizon_hours: int
    forecasting_strategy: str
    forecasting_strategy_version: str
    score_version: str
    total_candidate_topics: int
    returned_topics_count: int
    metadata: dict[str, Any] = Field(default_factory=dict)


class EmergingTrendsApiResponse(BaseModel):
    """Frontend-ready typed API response envelope for emerging trend forecasts."""
    model_config = ConfigDict(extra="forbid")

    artifact: ForecastArtifactSummary
    forecasts: list[EmergingTrendForecast]


class ForecastingStatusResponse(BaseModel):
    """Operational health and freshness status of the forecasting subsystem."""
    model_config = ConfigDict(extra="forbid")

    status: str
    artifact_available: bool
    artifact_id: str | None = None
    cutoff_at_utc: datetime | None = None
    generated_at_utc: datetime | None = None
    total_candidate_topics: int = 0
    total_forecasts: int = 0
    forecasting_strategy: str | None = None
    forecasting_strategy_version: str | None = None
    score_version: str | None = None
    horizon_hours: int = 24
    supported_horizons: list[int] = Field(default_factory=lambda: [24, 6])
    last_modified_utc: datetime | None = None

