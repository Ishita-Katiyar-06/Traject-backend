"""Topic Temporal Kinetics Schema (Milestone 8A).

Defines the typed domain contract for deterministic temporal, velocity, acceleration,
cross-channel diffusion, and observed engagement kinetics evaluated at an explicit cutoff timestamp.
This is a feature extraction contract for downstream forecasting models, NOT a predictive score.
"""

from datetime import datetime, timezone
from typing import Annotated
from pydantic import BaseModel, ConfigDict, Field, field_validator


class TopicTemporalKinetics(BaseModel):
    """Deterministic temporal kinetics and cross-channel diffusion features for a topic at cutoff T."""

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
        populate_by_name=True,
    )

    # 1. Identity and Cutoff
    topic_id: str = Field(description="Stable topic identifier (e.g. 'topic_042')")
    cutoff_at: datetime = Field(description="Strict evaluation cutoff timestamp (UTC). No data after this timestamp is used.")

    # 2. Activity Volume across Multiple Backward Windows
    messages_1h: Annotated[int, Field(ge=0)] = Field(default=0, description="Messages published in (T - 1h, T]")
    messages_3h: Annotated[int, Field(ge=0)] = Field(default=0, description="Messages published in (T - 3h, T]")
    messages_6h: Annotated[int, Field(ge=0)] = Field(default=0, description="Messages published in (T - 6h, T]")
    messages_12h: Annotated[int, Field(ge=0)] = Field(default=0, description="Messages published in (T - 12h, T]")
    messages_24h: Annotated[int, Field(ge=0)] = Field(default=0, description="Messages published in (T - 24h, T]")
    total_historical_messages: Annotated[int, Field(ge=0)] = Field(default=0, description="Cumulative messages published <= T")

    # 3. Historical Baseline & Relative Ratios
    baseline_messages_24h: Annotated[int, Field(ge=0)] = Field(
        default=0,
        description="Historical baseline volume in prior equivalent window (T - 48h, T - 24h]"
    )
    volume_ratio_24h: float = Field(
        default=0.0,
        ge=0.0,
        description="Ratio of current 24h messages to prior 24h baseline: messages_24h / max(baseline_24h, 1.0)"
    )

    # 4. Growth Velocity (messages / hour)
    velocity_1h: float = Field(default=0.0, ge=0.0, description="Hourly publication rate in last 1 hour: messages_1h / 1.0")
    velocity_3h: float = Field(default=0.0, ge=0.0, description="Hourly publication rate in last 3 hours: messages_3h / 3.0")
    velocity_6h: float = Field(default=0.0, ge=0.0, description="Hourly publication rate in last 6 hours: messages_6h / 6.0")
    velocity_12h: float = Field(default=0.0, ge=0.0, description="Hourly publication rate in last 12 hours: messages_12h / 12.0")
    velocity_24h: float = Field(default=0.0, ge=0.0, description="Hourly publication rate in last 24 hours: messages_24h / 24.0")
    velocity_change_6h: float = Field(
        default=0.0,
        description="Velocity change: velocity_6h - prior_velocity_6h (messages/hr difference)"
    )

    # 5. Acceleration (change in velocity / time)
    acceleration_6h: float | None = Field(
        default=None,
        description="Velocity rate of change over 6h window: (velocity_6h - velocity_prior_6h) / 6.0 (msgs/hr^2). None if insufficient history."
    )
    acceleration_24h: float | None = Field(
        default=None,
        description="Velocity rate of change over 24h window: (velocity_24h - velocity_prior_24h) / 24.0 (msgs/hr^2). None if insufficient history."
    )
    acceleration_available: bool = Field(
        default=False,
        description="True if historical depth before T is sufficient to evaluate non-trivial acceleration."
    )

    # 6. Persistence across Consecutive Windows
    active_last_1h: bool = Field(default=False, description="True if messages_1h > 0")
    active_last_3h: bool = Field(default=False, description="True if messages_3h > 0")
    active_last_6h: bool = Field(default=False, description="True if messages_6h > 0")
    active_last_12h: bool = Field(default=False, description="True if messages_12h > 0")
    active_last_24h: bool = Field(default=False, description="True if messages_24h > 0")
    active_window_count_6h: Annotated[int, Field(ge=0, le=6)] = Field(
        default=0,
        description="Number of discrete 1-hour buckets with >= 1 message in the last 6 hours (0 to 6)"
    )
    active_window_count_24h: Annotated[int, Field(ge=0, le=24)] = Field(
        default=0,
        description="Number of discrete 1-hour buckets with >= 1 message in the last 24 hours (0 to 24)"
    )
    consecutive_active_hours: Annotated[int, Field(ge=0)] = Field(
        default=0,
        description="Unbroken consecutive active 1-hour windows directly preceding cutoff T"
    )

    # 7. Cross-Channel Diffusion (Observed Channel Propagation)
    distinct_channels_1h: Annotated[int, Field(ge=0)] = Field(default=0, description="Unique publishing channels in (T - 1h, T]")
    distinct_channels_6h: Annotated[int, Field(ge=0)] = Field(default=0, description="Unique publishing channels in (T - 6h, T]")
    distinct_channels_24h: Annotated[int, Field(ge=0)] = Field(default=0, description="Unique publishing channels in (T - 24h, T]")
    total_channels_history: Annotated[int, Field(ge=0)] = Field(default=0, description="Cumulative unique channels in topic <= T")
    new_channels_1h: Annotated[int, Field(ge=0)] = Field(
        default=0,
        description="Channels in (T - 1h, T] that had never published in this topic prior to T - 1h"
    )
    new_channels_6h: Annotated[int, Field(ge=0)] = Field(
        default=0,
        description="Channels in (T - 6h, T] that had never published in this topic prior to T - 6h"
    )
    new_channels_24h: Annotated[int, Field(ge=0)] = Field(
        default=0,
        description="Channels in (T - 24h, T] that had never published in this topic prior to T - 24h"
    )
    channel_diffusion_rate_24h: float = Field(
        default=0.0,
        ge=0.0,
        description="Rate of new channel adoption per hour in last 24h: new_channels_24h / 24.0"
    )
    new_channel_message_ratio_24h: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Proportion of messages in last 24h originating from newly participating channels"
    )

    # 8. Cross-Domain Diffusion (Observed Strategic Domain Expansion)
    distinct_domains_24h: Annotated[int, Field(ge=0)] = Field(default=0, description="Unique strategic domains in (T - 24h, T]")
    new_domains_24h: Annotated[int, Field(ge=0)] = Field(
        default=0,
        description="Domains in (T - 24h, T] that had never appeared in this topic prior to T - 24h"
    )
    domains_represented_24h: list[str] = Field(
        default_factory=list,
        description="Alphabetically sorted list of distinct strategic domains active in last 24h"
    )

    # 9. Kinetics & Burstiness Signals
    burstiness_index: float | None = Field(
        default=None,
        ge=-1.0,
        le=1.0,
        description="Goh-Barabási burstiness index on message inter-arrivals <= T (None if < 3 messages or duration == 0)"
    )
    channel_entry_velocity: float | None = Field(
        default=None,
        ge=0.0,
        description="Total channels / total timespan hours <= T (None if duration == 0)"
    )

    # 10. Engagement Evolution (From 7B Observation Store with observed_at <= T)
    messages_with_observations: Annotated[int, Field(ge=0)] = Field(default=0)
    messages_with_multiple_observations: Annotated[int, Field(ge=0)] = Field(default=0)
    engagement_observation_coverage: float = Field(default=0.0, ge=0.0, le=1.0)
    total_observed_views: Annotated[int, Field(ge=0)] | None = Field(
        default=None,
        description="Sum of latest view counts observed <= T across topic messages"
    )
    view_velocity_per_hour: float | None = Field(
        default=None,
        description="Average hourly view growth across topic messages with multiple observations <= T (None if coverage insufficient)"
    )
    forward_velocity_per_hour: float | None = Field(
        default=None,
        description="Average hourly forward growth across topic messages with multiple observations <= T"
    )
    reaction_velocity_per_hour: float | None = Field(
        default=None,
        description="Average hourly reaction growth across topic messages with multiple observations <= T"
    )
    reply_velocity_per_hour: float | None = Field(
        default=None,
        description="Average hourly reply growth across topic messages with multiple observations <= T"
    )
    engagement_features_available: bool = Field(
        default=False,
        description="True if topic has >= 10% observation coverage and >= 2 messages with multiple observations <= T"
    )

    # 11. Data Quality & Trustworthiness Metadata
    sample_count: Annotated[int, Field(ge=0)] = Field(default=0, description="Count of messages available <= T")
    temporal_span_hours: float = Field(default=0.0, ge=0.0, description="Elapsed hours between earliest message and cutoff T")
    feature_availability: dict[str, bool] = Field(
        default_factory=dict,
        description="Audit flags indicating whether specific feature families have sufficient historical observations"
    )

    @field_validator("cutoff_at", mode="after")
    @classmethod
    def validate_utc_cutoff(cls, v: datetime) -> datetime:
        """Enforce timezone awareness and normalize to UTC."""
        if v.tzinfo is None:
            raise ValueError("cutoff_at must be timezone-aware (expected UTC).")
        return v.astimezone(timezone.utc)
