"""
Public-Safe Analytical Schemas and DTOs (Milestone 9C).

Provides strict, sanitized Pydantic contracts for public users.
Guarantees zero leakage of:
- Raw author IDs, channel IDs, or Telegram URLs
- Exact message texts or raw reference hashes
- Propagation network topologies or cascade graphs
- Narrative coordination indicators or Priority Signal sub-scores
- Model debug metrics, memory profiles, or internal pipeline latencies
"""

from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.api.common import PaginationMeta


class PublicTrendSummary(BaseModel):
    """Sanitized public overview of a circulating discourse topic/trend."""
    model_config = ConfigDict(extra="forbid")

    topic_id: str = Field(description="Normalized trend identifier")
    topic_name: str = Field(description="Human-readable trend name derived from top terms")
    keywords: list[str] = Field(default_factory=list, description="Top representative public terms")
    message_count: int = Field(ge=0, description="Total observed discussion volume")
    relative_volume: float = Field(ge=0.0, le=1.0, description="Normalized proportion of public discussion")
    first_observed_at: datetime | None = Field(default=None, description="Earliest recorded observation timestamp")
    last_observed_at: datetime | None = Field(default=None, description="Most recent observation timestamp")
    trajectory_phase: str = Field(default="STABLE", description="Observed momentum classification")


class PublicTrendListResponse(BaseModel):
    """Paginated collection of public-safe trends."""
    model_config = ConfigDict(extra="forbid")

    data: list[PublicTrendSummary]
    meta: PaginationMeta


class PublicTrendDetailResponse(BaseModel):
    """Detailed public-safe view of a specific trend without internal forensic indicators."""
    model_config = ConfigDict(extra="forbid")

    topic_id: str
    topic_name: str
    keywords: list[str]
    description: str = Field(description="High-level public summary of the trend discussion")
    message_count: int
    relative_volume: float
    first_observed_at: datetime | None = None
    last_observed_at: datetime | None = None
    trajectory_phase: str = "STABLE"
    temporal_volume: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Public time-series bucket volume progression"
    )


class PublicTrendForecast(BaseModel):
    """Public-safe emerging trend forecast record."""
    model_config = ConfigDict(extra="forbid")

    topic_id: str = Field(description="Trend identifier")
    topic_name: str = Field(description="Display name for the emerging trend")
    topic_keywords: list[str] = Field(default_factory=list, description="Characteristic keywords")
    horizon_hours: int = Field(default=24, description="Forecast horizon window (e.g. 24h)")
    forecast_score: float = Field(
        ge=0.0, le=1.0,
        description="Emerging trend likelihood score in [0.0, 1.0]"
    )
    forecast_rank: int = Field(ge=1, description="Relative emergence ranking (1 = highest)")
    forecast_tier: str = Field(description="Categorical emergence tier (e.g. STRONG_EMERGENCE)")
    trajectory_phase: str = Field(description="Interpretable trajectory (ACCELERATING, GROWING, etc.)")
    confidence_tier: str = Field(description="Historical data continuity confidence")
    recent_activity_level: str = Field(description="Qualitative activity indicator (High, Moderate, Low)")
    historical_message_count: int = Field(ge=0, description="Total observed volume leading up to forecast")
    cutoff_at: datetime = Field(description="Cutoff timestamp of observation")
    generated_at: datetime = Field(description="Timestamp when forecast was produced")


class PublicEmergingTrendsResponse(BaseModel):
    """Public-facing emerging trend forecast envelope."""
    model_config = ConfigDict(extra="forbid")

    horizon_hours: int
    generated_at_utc: datetime
    cutoff_at_utc: datetime
    total_emerging_trends: int
    forecasts: list[PublicTrendForecast]
