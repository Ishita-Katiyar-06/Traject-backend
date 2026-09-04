import math
from typing import Mapping

from app.ml.features.models import EnrichedTopicCandidate
from app.ml.narratives.models import (
    NarrativeSentimentProfile,
    NarrativeSubScores,
    PriorityTier,
)

# Spread scoring constants (approved 4G implementation plan)
SPREAD_CROSS_CHANNEL_NORM: float = 3.0
SPREAD_AMPLIFIERS_NORM: float = 3.0
SPREAD_WEIGHT_CROSS: float = 0.50
SPREAD_WEIGHT_FWD: float = 0.30
SPREAD_WEIGHT_AMPLIFIERS: float = 0.20

# Coordination scoring constants (approved 4G implementation plan)
COORD_SYNDICATION_SCALE: float = 2.0
COORD_VELOCITY_NORM: float = 10.0
COORD_WEIGHT_SYNDICATION: float = 0.50
COORD_WEIGHT_BURSTINESS: float = 0.30
COORD_WEIGHT_VELOCITY: float = 0.20
COORD_DEFAULT_BURSTINESS: float = 0.50

# Reach scoring constants (approved 4G implementation plan)
REACH_VIEWS_LOG_NORM: float = 6.0
REACH_FWD_RATIO_NORM: float = 0.08
REACH_WEIGHT_VIEWS: float = 0.60
REACH_WEIGHT_FWD: float = 0.40

# Friction scoring constants (approved 4G implementation plan)
FRICTION_REPLY_RATIO_NORM: float = 0.04
FRICTION_WEIGHT_TEXT_NEG: float = 0.45
FRICTION_WEIGHT_EMOJI_NEG: float = 0.35
FRICTION_WEIGHT_REPLY: float = 0.20

# Composite priority weights (approved 4G implementation plan)
DEFAULT_SCORING_WEIGHTS: dict[str, float] = {
    "spread": 0.30,
    "coordination": 0.30,
    "reach": 0.20,
    "friction": 0.20,
}


def compute_spread_score(
    candidate: EnrichedTopicCandidate,
    cross_norm: float = SPREAD_CROSS_CHANNEL_NORM,
    amplifiers_norm: float = SPREAD_AMPLIFIERS_NORM,
    w_cross: float = SPREAD_WEIGHT_CROSS,
    w_fwd: float = SPREAD_WEIGHT_FWD,
    w_amplifiers: float = SPREAD_WEIGHT_AMPLIFIERS,
) -> float:
    """Compute observed multi-channel propagation and mobility score strictly in [0.0, 1.0].
    
    Exact Approved Formula:
        S_spread = w_cross * min(cross_channel_spread / cross_norm, 1.0)
                 + w_fwd * direct_forward_ratio
                 + w_amplifiers * min(len(unique_amplifying_channels) / amplifiers_norm, 1.0)
    Default constants:
        cross_norm = 3.0, amplifiers_norm = 3.0
        w_cross = 0.50, w_fwd = 0.30, w_amplifiers = 0.20
    """
    prop = candidate.propagation
    term_cross = min(max(prop.cross_channel_observed_spread / max(cross_norm, 1e-6), 0.0), 1.0)
    term_fwd_ratio = max(0.0, min(prop.direct_forward_ratio, 1.0))
    term_amplifiers = min(max(len(prop.unique_amplifying_channels) / max(amplifiers_norm, 1e-6), 0.0), 1.0)

    score = w_cross * term_cross + w_fwd * term_fwd_ratio + w_amplifiers * term_amplifiers
    return round(max(0.0, min(score, 1.0)), 4)


def compute_coordination_score(
    candidate: EnrichedTopicCandidate,
    synd_scale: float = COORD_SYNDICATION_SCALE,
    velocity_norm: float = COORD_VELOCITY_NORM,
    w_synd: float = COORD_WEIGHT_SYNDICATION,
    w_burst: float = COORD_WEIGHT_BURSTINESS,
    w_velocity: float = COORD_WEIGHT_VELOCITY,
    default_burst: float = COORD_DEFAULT_BURSTINESS,
) -> float:
    """Compute potential synchronization and arrival anomaly score strictly in [0.0, 1.0].
    
    Exact Approved Formula:
        syndication_ratio = min(uncredited_syndication_count / max(non_forward_count, 1), 1.0)
        B_term = max((burstiness_index + 1.0) / 2.0, 0.0) if burstiness is not None else default_burst
        V_term = min(channel_entry_velocity / velocity_norm, 1.0) if velocity is not None else 0.0
        S_coord = w_synd * min(syndication_ratio * synd_scale, 1.0)
                + w_burst * B_term
                + w_velocity * V_term
    Default constants:
        synd_scale = 2.0, velocity_norm = 10.0, default_burst = 0.50
        w_synd = 0.50, w_burst = 0.30, w_velocity = 0.20
    """
    prop = candidate.propagation
    temp = candidate.temporal

    # 1. Uncredited syndication ratio among non-forward messages, explicitly clamped in [0.0, 1.0]
    non_fwd_count = candidate.message_count - prop.observed_forward_count
    syndication_ratio = min(prop.uncredited_syndication_count / max(non_fwd_count, 1), 1.0)
    syndication_ratio = max(0.0, syndication_ratio)
    term_synd = min(max(syndication_ratio * synd_scale, 0.0), 1.0)

    # 2. Normalized burstiness: [-1, +1] mapped to [0, 1], with neutral default if unavailable
    if temp.burstiness_index is not None:
        term_burst = max(0.0, min((temp.burstiness_index + 1.0) / 2.0, 1.0))
    else:
        term_burst = default_burst

    # 3. Channel entry velocity: normalized against baseline
    if temp.channel_entry_velocity is not None:
        term_velocity = max(0.0, min(temp.channel_entry_velocity / max(velocity_norm, 1e-6), 1.0))
    else:
        term_velocity = 0.0

    score = w_synd * term_synd + w_burst * term_burst + w_velocity * term_velocity
    return round(max(0.0, min(score, 1.0)), 4)


def compute_reach_score(
    candidate: EnrichedTopicCandidate,
    views_log_norm: float = REACH_VIEWS_LOG_NORM,
    fwd_ratio_norm: float = REACH_FWD_RATIO_NORM,
    w_views: float = REACH_WEIGHT_VIEWS,
    w_fwd: float = REACH_WEIGHT_FWD,
) -> float:
    """Compute observed exposure and forward velocity score strictly in [0.0, 1.0].
    
    Exact Approved Formula:
        S_reach = w_views * min(log10(max(total_views, 1)) / views_log_norm, 1.0)
                + w_fwd * min(forward_to_view_ratio / fwd_ratio_norm, 1.0)
    Default constants:
        views_log_norm = 6.0, fwd_ratio_norm = 0.08
        w_views = 0.60, w_fwd = 0.40
    """
    eng = candidate.engagement
    views_scaled = math.log10(max(eng.total_views, 1)) / max(views_log_norm, 1e-6)
    term_views = min(max(views_scaled, 0.0), 1.0)
    term_fwd_to_view = min(max(eng.forward_to_view_ratio / max(fwd_ratio_norm, 1e-6), 0.0), 1.0)

    score = w_views * term_views + w_fwd * term_fwd_to_view
    return round(max(0.0, min(score, 1.0)), 4)


def compute_friction_score(
    candidate: EnrichedTopicCandidate,
    sentiment: NarrativeSentimentProfile,
    reply_norm: float = FRICTION_REPLY_RATIO_NORM,
    w_text_neg: float = FRICTION_WEIGHT_TEXT_NEG,
    w_emoji_neg: float = FRICTION_WEIGHT_EMOJI_NEG,
    w_reply: float = FRICTION_WEIGHT_REPLY,
) -> float:
    """Compute observed polarization and controversy score strictly in [0.0, 1.0].
    
    Exact Approved Formula:
        emoji_negativity = max(-emoji_polarity_score, 0.0) in [0.0, 1.0]
        term_reply = min(reply_to_view_ratio / reply_norm, 1.0)
        
        If text sentiment is available:
            S_friction = w_text_neg * text_negative_ratio
                       + w_emoji_neg * emoji_negativity
                       + w_reply * term_reply
        If text sentiment is unavailable (is_available=False or text_negative_ratio is None):
            S_friction = (w_emoji_neg * emoji_negativity + w_reply * term_reply) / (w_emoji_neg + w_reply)
    Default constants:
        reply_norm = 0.04
        w_text_neg = 0.45, w_emoji_neg = 0.35, w_reply = 0.20
    """
    eng = candidate.engagement
    emoji_neg = max(-eng.emoji_polarity_score, 0.0)
    term_reply = min(max(eng.reply_to_view_ratio / max(reply_norm, 1e-6), 0.0), 1.0)

    if sentiment.is_available and sentiment.text_negative_ratio is not None:
        text_neg = max(0.0, min(sentiment.text_negative_ratio, 1.0))
        score = w_text_neg * text_neg + w_emoji_neg * emoji_neg + w_reply * term_reply
    else:
        # Renormalize over available components (w_emoji_neg + w_reply)
        avail_weight = w_emoji_neg + w_reply
        if avail_weight > 0:
            score = (w_emoji_neg * emoji_neg + w_reply * term_reply) / avail_weight
        else:
            score = 0.0

    return round(max(0.0, min(score, 1.0)), 4)


def compute_priority_signal_score(
    sub_scores: NarrativeSubScores,
    weights: Mapping[str, float] | None = None,
) -> float:
    """Compute explainable composite Priority/Narrative Signal Score strictly in [0.0, 1.0]."""
    w = dict(DEFAULT_SCORING_WEIGHTS)
    if weights:
        w.update(weights)

    w_spread = max(w.get("spread", DEFAULT_SCORING_WEIGHTS["spread"]), 0.0)
    w_coord = max(w.get("coordination", DEFAULT_SCORING_WEIGHTS["coordination"]), 0.0)
    w_reach = max(w.get("reach", DEFAULT_SCORING_WEIGHTS["reach"]), 0.0)
    w_friction = max(w.get("friction", DEFAULT_SCORING_WEIGHTS["friction"]), 0.0)

    total_w = w_spread + w_coord + w_reach + w_friction
    if total_w <= 0:
        return 0.0

    raw_score = (
        w_spread * sub_scores.spread_score
        + w_coord * sub_scores.coordination_score
        + w_reach * sub_scores.reach_score
        + w_friction * sub_scores.friction_score
    ) / total_w

    return round(max(0.0, min(raw_score, 1.0)), 4)


def assign_priority_tier(priority_score: float) -> PriorityTier:
    """Assign deterministic triage priority tier based on composite score."""
    if priority_score >= 0.75:
        return PriorityTier.CRITICAL
    elif priority_score >= 0.55:
        return PriorityTier.HIGH
    elif priority_score >= 0.35:
        return PriorityTier.ELEVATED
    return PriorityTier.ROUTINE
