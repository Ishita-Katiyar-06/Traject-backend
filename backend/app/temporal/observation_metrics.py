"""Derived Temporal Metrics and Delta Utilities for Engagement Observations (Milestone 7B).

Provides deterministic calculations of changes in engagement metrics across time-separated
observations of the same message without introducing predictive or forecasting assumptions.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Sequence

from app.schemas.engagement_observation import EngagementObservation


@dataclass
class EngagementDelta:
    """Deterministic delta between two chronological observations of the same message."""

    canonical_id: str
    t0: datetime
    t1: datetime
    elapsed_seconds: float

    # Metric Deltas (None if either observation lacked the metric)
    delta_views: int | None = None
    delta_forwards: int | None = None
    delta_replies: int | None = None
    delta_reactions_total: int = 0

    # Detailed Reaction Deltas (emoji -> delta count)
    delta_reactions_by_emoji: dict[str, int] = field(default_factory=dict)

    # Rates of change per hour (None if metric is None or elapsed_seconds <= 0)
    views_rate_per_hour: float | None = None
    forwards_rate_per_hour: float | None = None
    replies_rate_per_hour: float | None = None
    reactions_rate_per_hour: float | None = None

    # Anomaly / Data Quality Flags (Preserved faithfully, never clamped or fabricated)
    is_views_decrease: bool = False
    is_forwards_decrease: bool = False
    is_replies_decrease: bool = False
    is_reactions_decrease: bool = False
    anomalies: list[str] = field(default_factory=list)


def calculate_total_reactions(reactions: dict[str, int]) -> int:
    """Calculate the scalar sum of all reactions in an emoji-count map."""
    return sum(reactions.values())


def calculate_reaction_deltas(
    reactions_early: dict[str, int],
    reactions_late: dict[str, int],
) -> dict[str, int]:
    """Calculate per-emoji reaction changes across two snapshots.
    
    Treats absent emojis as 0 so that newly appearing or disappearing emojis
    are correctly reflected as positive or negative deltas.
    """
    all_emojis = set(reactions_early.keys()) | set(reactions_late.keys())
    deltas: dict[str, int] = {}
    for emoji in sorted(all_emojis):
        c_early = reactions_early.get(emoji, 0)
        c_late = reactions_late.get(emoji, 0)
        delta = c_late - c_early
        if delta != 0:
            deltas[emoji] = delta
    return deltas


def compute_engagement_delta(
    obs_early: EngagementObservation,
    obs_late: EngagementObservation,
) -> EngagementDelta:
    """Compute the deterministic engagement change from obs_early to obs_late.
    
    Args:
        obs_early: The earlier observation snapshot.
        obs_late: The later observation snapshot.
        
    Returns:
        EngagementDelta: Factual differences and rates of change.
    """
    if obs_early.canonical_id != obs_late.canonical_id:
        raise ValueError(
            f"Cannot compute delta across different canonical IDs: "
            f"'{obs_early.canonical_id}' vs '{obs_late.canonical_id}'"
        )

    t0 = obs_early.observed_at.astimezone(timezone.utc)
    t1 = obs_late.observed_at.astimezone(timezone.utc)
    elapsed_seconds = (t1 - t0).total_seconds()

    anomalies: list[str] = []
    if elapsed_seconds < 0:
        anomalies.append(f"Negative elapsed time: t1 ({t1.isoformat()}) precedes t0 ({t0.isoformat()})")

    # 1. Views
    delta_views: int | None = None
    views_rate: float | None = None
    is_views_dec = False
    if obs_early.views_count is not None and obs_late.views_count is not None:
        delta_views = obs_late.views_count - obs_early.views_count
        if delta_views < 0:
            is_views_dec = True
            anomalies.append(f"Views decreased from {obs_early.views_count} to {obs_late.views_count}")
        if elapsed_seconds > 0:
            views_rate = (delta_views / elapsed_seconds) * 3600.0

    # 2. Forwards
    delta_forwards: int | None = None
    forwards_rate: float | None = None
    is_forwards_dec = False
    if obs_early.forwards_count is not None and obs_late.forwards_count is not None:
        delta_forwards = obs_late.forwards_count - obs_early.forwards_count
        if delta_forwards < 0:
            is_forwards_dec = True
            anomalies.append(f"Forwards decreased from {obs_early.forwards_count} to {obs_late.forwards_count}")
        if elapsed_seconds > 0:
            forwards_rate = (delta_forwards / elapsed_seconds) * 3600.0

    # 3. Replies
    delta_replies: int | None = None
    replies_rate: float | None = None
    is_replies_dec = False
    if obs_early.replies_count is not None and obs_late.replies_count is not None:
        delta_replies = obs_late.replies_count - obs_early.replies_count
        if delta_replies < 0:
            is_replies_dec = True
            anomalies.append(f"Replies decreased from {obs_early.replies_count} to {obs_late.replies_count}")
        if elapsed_seconds > 0:
            replies_rate = (delta_replies / elapsed_seconds) * 3600.0

    # 4. Reactions
    total_rx_early = obs_early.total_reactions
    total_rx_late = obs_late.total_reactions
    delta_rx_total = total_rx_late - total_rx_early
    is_rx_dec = delta_rx_total < 0
    if is_rx_dec:
        anomalies.append(f"Total reactions decreased from {total_rx_early} to {total_rx_late}")

    rx_rate: float | None = None
    if elapsed_seconds > 0:
        rx_rate = (delta_rx_total / elapsed_seconds) * 3600.0

    emoji_deltas = calculate_reaction_deltas(obs_early.reactions, obs_late.reactions)

    return EngagementDelta(
        canonical_id=obs_early.canonical_id,
        t0=t0,
        t1=t1,
        elapsed_seconds=elapsed_seconds,
        delta_views=delta_views,
        delta_forwards=delta_forwards,
        delta_replies=delta_replies,
        delta_reactions_total=delta_rx_total,
        delta_reactions_by_emoji=emoji_deltas,
        views_rate_per_hour=views_rate,
        forwards_rate_per_hour=forwards_rate,
        replies_rate_per_hour=replies_rate,
        reactions_rate_per_hour=rx_rate,
        is_views_decrease=is_views_dec,
        is_forwards_decrease=is_forwards_dec,
        is_replies_decrease=is_replies_dec,
        is_reactions_decrease=is_rx_dec,
        anomalies=anomalies,
    )


def compute_observation_series(
    observations: Sequence[EngagementObservation],
) -> list[EngagementDelta]:
    """Compute step-by-step consecutive deltas along a chronological sequence of observations.
    
    Args:
        observations: Sequence of observations for the same canonical_id.
        
    Returns:
        list[EngagementDelta]: Consecutive pairwise deltas ordered by observed_at.
    """
    if len(observations) < 2:
        return []

    # Sort strictly by observed_at
    sorted_obs = sorted(observations, key=lambda o: o.observed_at)
    deltas: list[EngagementDelta] = []

    for i in range(len(sorted_obs) - 1):
        delta = compute_engagement_delta(sorted_obs[i], sorted_obs[i + 1])
        deltas.append(delta)

    return deltas
