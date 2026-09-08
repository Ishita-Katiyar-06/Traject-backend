"""Publication Cadence & Cross-Channel Diffusion Kinetics Engine (Milestone 8A).

Computes deterministic temporal activity, velocity, acceleration, persistence,
cross-channel diffusion, and observed engagement kinetics for topics evaluated
at an explicit cutoff timestamp. Strictly enforces information boundaries (no future leakage).
"""

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
import math
from typing import Mapping, Sequence

from functools import lru_cache

from app.collectors.telegram.registry import load_telegram_source_registry
from app.schemas.canonical_message import CanonicalMessage
from app.schemas.engagement_observation import EngagementObservation
from app.schemas.topic_kinetics import TopicTemporalKinetics
from app.temporal.observation_metrics import compute_engagement_delta


@lru_cache(maxsize=1)
def _build_default_domain_map() -> dict[str, str]:
    """Build channel username -> strategic domain lookup map from source registry."""
    domain_map: dict[str, str] = {}
    try:
        registry = load_telegram_source_registry()
        for src in registry.sources:
            clean_u = src.username.lstrip("@").lower()
            domain_map[clean_u] = src.domain
            domain_map[src.username.lower()] = src.domain
    except Exception:
        pass
    return domain_map


def compute_topic_temporal_kinetics(
    topic_id: str,
    messages: Sequence[CanonicalMessage],
    cutoff_at: datetime,
    engagement_observations: Sequence[EngagementObservation] | None = None,
    source_domain_map: Mapping[str, str] | None = None,
) -> TopicTemporalKinetics:
    """Compute deterministic temporal features and cross-channel diffusion kinetics at cutoff T.
    
    Args:
        topic_id: Identifier of the target topic cluster.
        messages: All canonical messages associated with the topic.
        cutoff_at: Strict evaluation timestamp (UTC). Any message published after T is excluded.
        engagement_observations: Optional point-in-time engagement observations (filtered to observed_at <= T).
        source_domain_map: Optional mapping of channel username/ID to strategic domain name.
        
    Returns:
        TopicTemporalKinetics: Typed, strictly leakage-safe feature vector.
    """
    if cutoff_at.tzinfo is None:
        cutoff_at = cutoff_at.replace(tzinfo=timezone.utc)
    else:
        cutoff_at = cutoff_at.astimezone(timezone.utc)

    domain_map = source_domain_map if source_domain_map is not None else _build_default_domain_map()

    # 1. Strict Cutoff Filtering: only messages published <= cutoff_at
    filtered_msgs = [
        m for m in messages
        if m.published_at.astimezone(timezone.utc) <= cutoff_at
    ]

    # Handle zero-data edge case
    if not filtered_msgs:
        return TopicTemporalKinetics(
            topic_id=topic_id,
            cutoff_at=cutoff_at,
            sample_count=0,
            temporal_span_hours=0.0,
            feature_availability={
                "volume_1h": False,
                "volume_6h": False,
                "volume_24h": False,
                "velocity_6h": False,
                "acceleration_6h": False,
                "acceleration_24h": False,
                "channel_diffusion": False,
                "domain_diffusion": False,
                "burstiness": False,
                "engagement": False,
            },
        )

    # Sort strictly by publication timestamp
    sorted_msgs = sorted(filtered_msgs, key=lambda m: (m.published_at, m.canonical_id))
    first_pub = sorted_msgs[0].published_at.astimezone(timezone.utc)
    last_pub = sorted_msgs[-1].published_at.astimezone(timezone.utc)
    total_historical = len(sorted_msgs)
    timespan_sec = max((cutoff_at - first_pub).total_seconds(), 0.0)
    timespan_hours = round(timespan_sec / 3600.0, 2)

    # 2. Window Boundaries
    t_1h = cutoff_at - timedelta(hours=1)
    t_3h = cutoff_at - timedelta(hours=3)
    t_6h = cutoff_at - timedelta(hours=6)
    t_12h = cutoff_at - timedelta(hours=12)
    t_24h = cutoff_at - timedelta(hours=24)
    t_48h = cutoff_at - timedelta(hours=48)

    # 3. Message Volume Partitioning
    msgs_1h = [m for m in sorted_msgs if m.published_at > t_1h]
    msgs_3h = [m for m in sorted_msgs if m.published_at > t_3h]
    msgs_6h = [m for m in sorted_msgs if m.published_at > t_6h]
    msgs_12h = [m for m in sorted_msgs if m.published_at > t_12h]
    msgs_24h = [m for m in sorted_msgs if m.published_at > t_24h]

    # Prior comparative windows for acceleration and baseline
    msgs_prior_6h = [m for m in sorted_msgs if t_12h < m.published_at <= t_6h]
    msgs_prior_24h = [m for m in sorted_msgs if t_48h < m.published_at <= t_24h]
    msgs_prior_to_1h = [m for m in sorted_msgs if m.published_at <= t_1h]
    msgs_prior_to_6h = [m for m in sorted_msgs if m.published_at <= t_6h]
    msgs_prior_to_24h = [m for m in sorted_msgs if m.published_at <= t_24h]

    n_1h = len(msgs_1h)
    n_3h = len(msgs_3h)
    n_6h = len(msgs_6h)
    n_12h = len(msgs_12h)
    n_24h = len(msgs_24h)
    n_prior_6h = len(msgs_prior_6h)
    n_prior_24h = len(msgs_prior_24h)

    # 4. Velocities (messages / hour)
    v_1h = round(n_1h / 1.0, 3)
    v_3h = round(n_3h / 3.0, 3)
    v_6h = round(n_6h / 6.0, 3)
    v_12h = round(n_12h / 12.0, 3)
    v_24h = round(n_24h / 24.0, 3)
    v_prior_6h = round(n_prior_6h / 6.0, 3)
    v_prior_24h = round(n_prior_24h / 24.0, 3)

    v_change_6h = round(v_6h - v_prior_6h, 3)
    vol_ratio_24h = round(n_24h / max(n_prior_24h, 1.0), 3)

    # 5. Acceleration (Derivative of Velocity)
    # A topic can only have acceleration if historical depth precedes the comparative window
    acc_6h: float | None = None
    has_acc_history_6h = first_pub <= t_6h
    if has_acc_history_6h:
        acc_6h = round((v_6h - v_prior_6h) / 6.0, 4)

    acc_24h: float | None = None
    has_acc_history_24h = first_pub <= t_24h
    if has_acc_history_24h:
        acc_24h = round((v_24h - v_prior_24h) / 24.0, 4)

    acc_available = (acc_6h is not None or acc_24h is not None)

    # 6. Persistence across Discrete Buckets
    # Count discrete 1-hour active buckets in last 6h and 24h
    active_6h_count = 0
    for i in range(6):
        b_start = cutoff_at - timedelta(hours=i + 1)
        b_end = cutoff_at - timedelta(hours=i)
        if any(b_start < m.published_at <= b_end for m in msgs_6h):
            active_6h_count += 1

    active_24h_count = 0
    for i in range(24):
        b_start = cutoff_at - timedelta(hours=i + 1)
        b_end = cutoff_at - timedelta(hours=i)
        if any(b_start < m.published_at <= b_end for m in msgs_24h):
            active_24h_count += 1

    # Consecutive active hours directly preceding cutoff T
    consecutive_hrs = 0
    for i in range(24):
        b_start = cutoff_at - timedelta(hours=i + 1)
        b_end = cutoff_at - timedelta(hours=i)
        if any(b_start < m.published_at <= b_end for m in msgs_24h):
            consecutive_hrs += 1
        else:
            break

    # 7. Cross-Channel Diffusion
    def _channel_key(m: CanonicalMessage) -> str:
        return (m.author_username or m.channel_title or m.author_id or "unknown").lstrip("@").lower()

    channels_all = {_channel_key(m) for m in sorted_msgs}
    channels_1h = {_channel_key(m) for m in msgs_1h}
    channels_6h = {_channel_key(m) for m in msgs_6h}
    channels_24h = {_channel_key(m) for m in msgs_24h}

    prior_channels_1h = {_channel_key(m) for m in msgs_prior_to_1h}
    prior_channels_6h = {_channel_key(m) for m in msgs_prior_to_6h}
    prior_channels_24h = {_channel_key(m) for m in msgs_prior_to_24h}

    new_ch_1h = {ch for ch in channels_1h if ch not in prior_channels_1h}
    new_ch_6h = {ch for ch in channels_6h if ch not in prior_channels_6h}
    new_ch_24h = {ch for ch in channels_24h if ch not in prior_channels_24h}

    diffusion_rate_24h = round(len(new_ch_24h) / 24.0, 3)

    # Proportion of 24h messages published by new channels
    new_ch_msgs_24h = sum(1 for m in msgs_24h if _channel_key(m) in new_ch_24h)
    new_ch_ratio_24h = round(new_ch_msgs_24h / max(n_24h, 1), 3) if n_24h > 0 else 0.0

    # 8. Cross-Domain Diffusion
    def _domain_key(m: CanonicalMessage) -> str:
        ck = _channel_key(m)
        return domain_map.get(ck, domain_map.get(m.author_id, "general_news"))

    domains_24h = {_domain_key(m) for m in msgs_24h}
    prior_domains_24h = {_domain_key(m) for m in msgs_prior_to_24h}
    new_domains_24h = {d for d in domains_24h if d not in prior_domains_24h}

    # 9. Burstiness & Channel Entry Kinetics
    burstiness: float | None = None
    if len(sorted_msgs) >= 3 and timespan_sec > 0:
        intervals = [
            (sorted_msgs[i + 1].published_at - sorted_msgs[i].published_at).total_seconds()
            for i in range(len(sorted_msgs) - 1)
        ]
        mu = sum(intervals) / len(intervals)
        if mu > 0:
            var = sum((x - mu) ** 2 for x in intervals) / len(intervals)
            sigma = math.sqrt(var)
            if (sigma + mu) > 0:
                burstiness = round((sigma - mu) / (sigma + mu), 4)

    channel_velocity = round(len(channels_all) / max(timespan_hours, 0.1), 3) if timespan_hours > 0 else None

    # 10. Engagement Evolution (From 7B Observation Store with observed_at <= cutoff_at)
    msgs_with_obs = 0
    msgs_with_multi_obs = 0
    total_views_sum = 0
    any_view_observed = False
    v_rates: list[float] = []
    fwd_rates: list[float] = []
    rx_rates: list[float] = []
    rep_rates: list[float] = []

    if engagement_observations:
        # Strict observation cutoff filter
        valid_obs = [
            o for o in engagement_observations
            if o.observed_at.astimezone(timezone.utc) <= cutoff_at
        ]
        topic_msg_ids = {m.canonical_id for m in sorted_msgs}
        obs_by_cid: dict[str, list[EngagementObservation]] = defaultdict(list)
        for o in valid_obs:
            if o.canonical_id in topic_msg_ids:
                obs_by_cid[o.canonical_id].append(o)

        msgs_with_obs = len(obs_by_cid)
        for cid, o_list in obs_by_cid.items():
            o_list_sorted = sorted(o_list, key=lambda x: x.observed_at)
            latest_obs = o_list_sorted[-1]
            if latest_obs.views_count is not None:
                total_views_sum += latest_obs.views_count
                any_view_observed = True

            if len(o_list_sorted) >= 2:
                msgs_with_multi_obs += 1
                try:
                    delta = compute_engagement_delta(o_list_sorted[0], o_list_sorted[-1])
                    if delta.views_rate_per_hour is not None:
                        v_rates.append(delta.views_rate_per_hour)
                    if delta.forwards_rate_per_hour is not None:
                        fwd_rates.append(delta.forwards_rate_per_hour)
                    if delta.reactions_rate_per_hour is not None:
                        rx_rates.append(delta.reactions_rate_per_hour)
                    if delta.replies_rate_per_hour is not None:
                        rep_rates.append(delta.replies_rate_per_hour)
                except Exception:
                    pass

    obs_coverage = round(msgs_with_obs / max(total_historical, 1), 3)
    eng_available = (msgs_with_multi_obs >= 2 and obs_coverage >= 0.10)

    avg_v_rate = round(sum(v_rates) / len(v_rates), 3) if (eng_available and v_rates) else None
    avg_fwd_rate = round(sum(fwd_rates) / len(fwd_rates), 3) if (eng_available and fwd_rates) else None
    avg_rx_rate = round(sum(rx_rates) / len(rx_rates), 3) if (eng_available and rx_rates) else None
    avg_rep_rate = round(sum(rep_rates) / len(rep_rates), 3) if (eng_available and rep_rates) else None
    tot_views_out = total_views_sum if any_view_observed else None

    # 11. Feature Availability Flags
    availability = {
        "volume_1h": n_1h > 0 or timespan_hours >= 1.0,
        "volume_6h": n_6h > 0 or timespan_hours >= 6.0,
        "volume_24h": n_24h > 0 or timespan_hours >= 24.0,
        "velocity_6h": n_6h > 0 or timespan_hours >= 6.0,
        "acceleration_6h": acc_6h is not None,
        "acceleration_24h": acc_24h is not None,
        "channel_diffusion": len(channels_24h) > 0,
        "domain_diffusion": len(domains_24h) > 0,
        "burstiness": burstiness is not None,
        "engagement": eng_available,
    }

    return TopicTemporalKinetics(
        topic_id=topic_id,
        cutoff_at=cutoff_at,
        messages_1h=n_1h,
        messages_3h=n_3h,
        messages_6h=n_6h,
        messages_12h=n_12h,
        messages_24h=n_24h,
        total_historical_messages=total_historical,
        baseline_messages_24h=n_prior_24h,
        volume_ratio_24h=vol_ratio_24h,
        velocity_1h=v_1h,
        velocity_3h=v_3h,
        velocity_6h=v_6h,
        velocity_12h=v_12h,
        velocity_24h=v_24h,
        velocity_change_6h=v_change_6h,
        acceleration_6h=acc_6h,
        acceleration_24h=acc_24h,
        acceleration_available=acc_available,
        active_last_1h=n_1h > 0,
        active_last_3h=n_3h > 0,
        active_last_6h=n_6h > 0,
        active_last_12h=n_12h > 0,
        active_last_24h=n_24h > 0,
        active_window_count_6h=active_6h_count,
        active_window_count_24h=active_24h_count,
        consecutive_active_hours=consecutive_hrs,
        distinct_channels_1h=len(channels_1h),
        distinct_channels_6h=len(channels_6h),
        distinct_channels_24h=len(channels_24h),
        total_channels_history=len(channels_all),
        new_channels_1h=len(new_ch_1h),
        new_channels_6h=len(new_ch_6h),
        new_channels_24h=len(new_ch_24h),
        channel_diffusion_rate_24h=diffusion_rate_24h,
        new_channel_message_ratio_24h=new_ch_ratio_24h,
        distinct_domains_24h=len(domains_24h),
        new_domains_24h=len(new_domains_24h),
        domains_represented_24h=sorted(domains_24h),
        burstiness_index=burstiness,
        channel_entry_velocity=channel_velocity,
        messages_with_observations=msgs_with_obs,
        messages_with_multiple_observations=msgs_with_multi_obs,
        engagement_observation_coverage=obs_coverage,
        total_observed_views=tot_views_out,
        view_velocity_per_hour=avg_v_rate,
        forward_velocity_per_hour=avg_fwd_rate,
        reaction_velocity_per_hour=avg_rx_rate,
        reply_velocity_per_hour=avg_rep_rate,
        engagement_features_available=eng_available,
        sample_count=total_historical,
        temporal_span_hours=timespan_hours,
        feature_availability=availability,
    )


def compute_all_topics_kinetics(
    topics_messages: Mapping[str, Sequence[CanonicalMessage]],
    cutoff_at: datetime,
    engagement_observations: Sequence[EngagementObservation] | None = None,
    source_domain_map: Mapping[str, str] | None = None,
) -> dict[str, TopicTemporalKinetics]:
    """Compute temporal kinetics features across a dictionary of topics at cutoff T."""
    results: dict[str, TopicTemporalKinetics] = {}
    domain_map = source_domain_map if source_domain_map is not None else _build_default_domain_map()

    for topic_id, msgs in topics_messages.items():
        results[topic_id] = compute_topic_temporal_kinetics(
            topic_id=topic_id,
            messages=msgs,
            cutoff_at=cutoff_at,
            engagement_observations=engagement_observations,
            source_domain_map=domain_map,
        )

    return results
