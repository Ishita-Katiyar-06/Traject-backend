"""
Milestone 8B: Temporal Observation Cohort Schemas.

Defines typed data models for tracking fresh message cohorts,
configurable observation schedules, and cohort temporal quality metrics.
"""
from datetime import datetime, timezone
from typing import Any
from pydantic import BaseModel, ConfigDict, Field, field_validator


class TemporalCohortMetadata(BaseModel):
    """Metadata defining a fresh cohort of messages designated for repeated observation."""
    model_config = ConfigDict(extra="forbid")

    cohort_id: str = Field(..., description="Unique cohort identifier, e.g. cohort_20260908_230000")
    created_at_utc: datetime = Field(..., description="UTC creation timestamp of this cohort")
    cohort_window_hours: float = Field(default=24.0, description="Lookback window in hours used to select cohort")
    cohort_start_utc: datetime = Field(..., description="Earliest published_at included in this cohort")
    cohort_end_utc: datetime = Field(..., description="Latest published_at included in this cohort")
    source_count: int = Field(..., description="Number of distinct channels/sources represented in cohort")
    message_count: int = Field(..., description="Total canonical messages in cohort")
    target_channels: list[str] = Field(default_factory=list, description="List of channel handles/IDs in cohort")
    canonical_ids: list[str] = Field(default_factory=list, description="List of canonical_ids belonging to this cohort")
    observation_schedule: list[str] = Field(
        default_factory=lambda: ["T0", "T+1h", "T+2h", "T+4h", "T+6h", "T+12h", "T+24h"],
        description="Target observation cadence schedule",
    )
    observation_policy: str = Field(
        default="bounded_channel_reobservation",
        description="Mechanism used to re-observe cohort messages without full-history re-download",
    )
    manifest_reference: str | None = Field(
        default=None,
        description="Path or identifier of collection manifest linked to this cohort",
    )
    completed_observation_rounds: int = Field(
        default=1,
        description="Number of observation rounds completed (T0 = 1)",
    )
    latest_observation_utc: datetime | None = Field(
        default=None,
        description="Timestamp of most recently completed observation round",
    )

    @field_validator("created_at_utc", "cohort_start_utc", "cohort_end_utc", "latest_observation_utc")
    @classmethod
    def validate_utc(cls, v: datetime | None) -> datetime | None:
        if v is None:
            return None
        if v.tzinfo is None:
            raise ValueError(f"Datetime must be timezone-aware UTC, got {v}")
        return v.astimezone(timezone.utc)


class CohortQualityMetrics(BaseModel):
    """Quality and coverage metrics computed over a temporal observation cohort."""
    model_config = ConfigDict(extra="forbid")

    cohort_id: str
    evaluated_at_utc: datetime
    total_cohort_messages: int
    messages_with_1_obs: int
    messages_with_2_obs: int
    messages_with_3_plus_obs: int
    max_observations_per_message: int
    interval_min_minutes: float | None = None
    interval_p25_minutes: float | None = None
    interval_median_minutes: float | None = None
    interval_p75_minutes: float | None = None
    interval_p90_minutes: float | None = None
    interval_max_minutes: float | None = None
    messages_with_increasing_views: int = 0
    messages_with_increasing_forwards: int = 0
    messages_with_increasing_reactions: int = 0
    messages_with_increasing_replies: int = 0
    messages_with_counter_decreases: int = 0
    target_period_coverage_pct: float = 0.0

    @field_validator("evaluated_at_utc")
    @classmethod
    def validate_utc(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError(f"Datetime must be timezone-aware UTC, got {v}")
        return v.astimezone(timezone.utc)
