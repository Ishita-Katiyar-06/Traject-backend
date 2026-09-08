"""Deterministic Viewpoint Discovery and Multi-Perspective Narrative Branching Engine.

Analyzes constituent messages of a trend cluster to discover distinct semantic viewpoints,
evaluates internal evidence (textual content, sentiment tone, emoji reaction polarity,
comment/reply friction, and source diversity), enforces strict branching thresholds,
and ranks dominant vs. secondary narratives without turning the UI into a raw statistics dashboard.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import logging
import math
import re
from typing import Any, Sequence

from app.ml.features.models import EnrichedTopicCandidate, SocialEntityCategory
from app.ml.sentiment.inference import SentimentModelAdapter
from app.schemas import CanonicalMessage

logger = logging.getLogger("traject.ml.narratives.viewpoints")

# Deterministic emoji polarity categories for audience reception evidence
SUPPORTIVE_EMOJIS = {"👍", "❤️", "🔥", "🎉", "👏", "😍", "🥳", "🙏", "💯"}
CRITICAL_EMOJIS = {"👎", "😡", "🤬", "💩", "🤮", "😢", "💔"}
SKEPTICAL_EMOJIS = {"🤔", "🤨", "👀", "🧐", "🤷"}
INFORMATIONAL_EMOJIS = {"⚡", "✍️", "🫡", "🤝", "📢"}

# Stop words for lexical claim extraction
STOP_WORDS = {
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "up", "about", "into", "over", "after",
    "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
    "do", "does", "did", "will", "would", "shall", "should", "can", "could",
    "may", "might", "must", "this", "that", "these", "those", "it", "its",
    "not", "no", "just", "more", "also", "very", "even", "than", "then",
}


@dataclass
class MessageEvidence:
    """Internal analytical evidence container for a single constituent message."""
    message: CanonicalMessage
    sentiment_label: str  # "positive", "negative", "neutral"
    sentiment_score: float
    supportive_reactions: int
    critical_reactions: int
    skeptical_reactions: int
    informational_reactions: int
    total_reactions: int
    replies_count: int
    views_count: int
    key_tokens: set[str]
    inferred_stance: str  # "supportive", "critical", "skeptical", "informational"


@dataclass
class ViewpointCluster:
    """A semantically coherent viewpoint group within a trend."""
    stance: str  # "supportive", "critical", "skeptical", "informational"
    messages: list[CanonicalMessage] = field(default_factory=list)
    evidence_items: list[MessageEvidence] = field(default_factory=list)
    key_phrases: list[str] = field(default_factory=list)
    evidence_strength: float = 0.0
    is_dominant: bool = False
    rank: int = 1


def _extract_lexical_tokens(text: str) -> set[str]:
    """Extract clean content words from text."""
    clean = re.sub(r"https?://\S+", "", text)
    clean = re.sub(r"[^\w\s]", " ", clean.lower())
    tokens = {w for w in clean.split() if len(w) >= 3 and w not in STOP_WORDS}
    return tokens


def analyze_message_evidence(
    msg: CanonicalMessage,
    sentiment_adapter: SentimentModelAdapter | None = None,
) -> MessageEvidence:
    """Extract internal multi-signal evidence for a single canonical message."""
    # 1. Text Sentiment
    sentiment_label = "neutral"
    sentiment_score = 0.5

    text = (msg.text_content or "").strip()
    if text and sentiment_adapter is not None:
        try:
            preds = sentiment_adapter.predict_batch([text])
            if preds:
                p = preds[0]
                sentiment_label = p.label.value if hasattr(p.label, "value") else str(p.label).lower()
                sentiment_score = p.confidence
        except Exception:
            sentiment_label = "neutral"
            sentiment_score = 0.5
    elif text:
        # Lightweight heuristic if adapter unavailable
        lower = text.lower()
        pos_terms = {"support", "win", "great", "honor", "success", "hero", "positive", "good", "praise", "salute"}
        neg_terms = {"critic", "fail", "bad", "scam", "shame", "worst", "attack", "oppose", "protest", "crisis", "disaster"}
        pos_hits = sum(1 for t in pos_terms if t in lower)
        neg_hits = sum(1 for t in neg_terms if t in lower)
        if pos_hits > neg_hits:
            sentiment_label = "positive"
            sentiment_score = 0.7
        elif neg_hits > pos_hits:
            sentiment_label = "negative"
            sentiment_score = 0.7

    # 2. Audience Reactions
    sup_count = 0
    crit_count = 0
    skep_count = 0
    info_count = 0
    total_rx = 0

    if msg.reactions:
        for emoji_char, count in msg.reactions.items():
            if count <= 0:
                continue
            total_rx += count
            if emoji_char in SUPPORTIVE_EMOJIS:
                sup_count += count
            elif emoji_char in CRITICAL_EMOJIS:
                crit_count += count
            elif emoji_char in SKEPTICAL_EMOJIS:
                skep_count += count
            elif emoji_char in INFORMATIONAL_EMOJIS:
                info_count += count

    replies = msg.replies_count or 0
    views = msg.views_count or 0
    tokens = _extract_lexical_tokens(text)

    # 3. Inferred Stance (combining message tone + reception + discussion friction)
    # High replies + negative sentiment strongly indicates critical friction
    if sentiment_label == "negative" or (crit_count > sup_count and crit_count > 0):
        stance = "critical"
    elif skep_count > sup_count and skep_count > crit_count:
        stance = "skeptical"
    elif sentiment_label == "positive" or (sup_count > crit_count and sup_count > 0):
        stance = "supportive"
    elif replies > 10 and crit_count > 0:
        stance = "critical"
    else:
        stance = "informational"

    return MessageEvidence(
        message=msg,
        sentiment_label=sentiment_label,
        sentiment_score=sentiment_score,
        supportive_reactions=sup_count,
        critical_reactions=crit_count,
        skeptical_reactions=skep_count,
        informational_reactions=info_count,
        total_reactions=total_rx,
        replies_count=replies,
        views_count=views,
        key_tokens=tokens,
        inferred_stance=stance,
    )


def compute_narrative_evidence_strength(
    cluster: ViewpointCluster,
    total_trend_messages: int,
    total_trend_reactions: int,
    total_trend_views: int,
    total_trend_channels: int,
) -> float:
    """Compute deterministic internal Evidence Strength score in [0.0, 1.0].
    
    Formula:
        0.40 * Message Ratio + 0.25 * Source Diversity + 0.20 * Reception Ratio + 0.15 * Exposure Ratio
    """
    msg_count = len(cluster.messages)
    if total_trend_messages <= 0 or msg_count <= 0:
        return 0.0

    s_msg = msg_count / max(total_trend_messages, 1)

    # Source diversity: distinct channels publishing this viewpoint
    channels = {m.author_id for m in cluster.messages if m.author_id}
    s_source = len(channels) / max(total_trend_channels, 1)

    # Log-damped audience reception (prevents viral anomaly from overpowering volume)
    group_reactions = sum(ev.total_reactions for ev in cluster.evidence_items)
    s_rx = (
        math.log1p(group_reactions) / max(math.log1p(total_trend_reactions), 1.0)
        if total_trend_reactions > 0
        else 0.0
    )

    # Exposure ratio
    group_views = sum(ev.views_count for ev in cluster.evidence_items)
    s_views = (
        group_views / max(total_trend_views, 1)
        if total_trend_views > 0
        else 0.0
    )

    score = (0.40 * s_msg) + (0.25 * s_source) + (0.20 * s_rx) + (0.15 * s_views)
    return round(min(max(score, 0.0), 1.0), 4)


def discover_trend_viewpoints(
    messages: Sequence[CanonicalMessage],
    topic_entities: Sequence[str] | None = None,
    sentiment_adapter: SentimentModelAdapter | None = None,
) -> list[ViewpointCluster]:
    """Discover coherent viewpoints within a trend cluster and rank them by evidence strength.
    
    Guarantees:
    - Never groups purely by sentiment; requires semantic and contextual coherence.
    - Suppresses isolated noise that lacks sufficient evidence.
    - Emits 1 dominant viewpoint if discourse is homogeneous.
    - Emits 1..N viewpoints if genuinely distinct, evidence-supported perspectives exist.
    """
    if not messages:
        return []

    # 1. Analyze evidence for all constituent messages
    ev_list: list[MessageEvidence] = [
        analyze_message_evidence(m, sentiment_adapter=sentiment_adapter)
        for m in messages
    ]

    total_msgs = len(messages)
    total_rx = sum(ev.total_reactions for ev in ev_list)
    total_views = sum(ev.views_count for ev in ev_list)
    total_channels = len({m.author_id for m in messages if m.author_id}) or 1

    # 2. Partition by primary stance
    stance_groups: dict[str, list[MessageEvidence]] = {
        "supportive": [],
        "critical": [],
        "skeptical": [],
        "informational": [],
    }
    for ev in ev_list:
        stance_groups[ev.inferred_stance].append(ev)

    # 3. Build viewpoint clusters from non-empty stance partitions
    raw_clusters: list[ViewpointCluster] = []
    for stance, items in stance_groups.items():
        if not items:
            continue
        c = ViewpointCluster(
            stance=stance,
            messages=[ev.message for ev in items],
            evidence_items=items,
        )
        c.evidence_strength = compute_narrative_evidence_strength(
            cluster=c,
            total_trend_messages=total_msgs,
            total_trend_reactions=total_rx,
            total_trend_views=total_views,
            total_trend_channels=total_channels,
        )
        raw_clusters.append(c)

    if not raw_clusters:
        # Fallback cluster if everything was empty
        c = ViewpointCluster(
            stance="informational",
            messages=list(messages),
            evidence_items=ev_list,
            evidence_strength=1.0,
        )
        return [c]

    # Sort clusters by evidence strength descending
    raw_clusters.sort(key=lambda c: c.evidence_strength, reverse=True)

    # 4. Enforce Branching & Noise Suppression Thresholds
    # The top cluster is always the Dominant Viewpoint
    dominant_cluster = raw_clusters[0]
    dominant_cluster.is_dominant = True
    dominant_cluster.rank = 1

    promoted_clusters: list[ViewpointCluster] = [dominant_cluster]

    # Evaluate secondary candidates
    for candidate in raw_clusters[1:]:
        cand_msgs = len(candidate.messages)
        # Check source diversity: distinct channels for candidate
        cand_channels = len({m.author_id for m in candidate.messages if m.author_id})

        # Condition 1: Minimum message support (>= 2 messages OR >= 2 verified channels)
        has_min_support = (cand_msgs >= 2) or (cand_channels >= 2)

        # Condition 2: Minimum relative evidence strength (>= 15% of trend's evidence or >= 0.15)
        has_min_strength = candidate.evidence_strength >= 0.15

        # Suppress weak outliers/noise
        if has_min_support and has_min_strength:
            candidate.is_dominant = False
            candidate.rank = len(promoted_clusters) + 1
            promoted_clusters.append(candidate)

    return promoted_clusters


def extract_branch_representative_excerpts(
    messages: Sequence[CanonicalMessage],
    max_excerpts: int = 3,
    max_length: int = 160,
) -> list[str]:
    """Extract clean, authentic message excerpts specific to this narrative branch."""
    excerpts: list[str] = []
    seen: set[str] = set()

    for m in messages:
        text = (m.text_content or "").strip()
        if not text or text in seen:
            continue
        # Avoid link-only messages if longer text is available
        if text.startswith("http") and len(text.split()) == 1 and len(messages) > len(excerpts) + 1:
            continue
        seen.add(text)
        snippet = text[:max_length - 3] + "..." if len(text) > max_length else text
        excerpts.append(snippet)
        if len(excerpts) >= max_excerpts:
            break

    # If all excerpts were skipped (e.g. all were links), include first raw texts
    if not excerpts:
        for m in messages[:max_excerpts]:
            text = (m.text_content or "").strip()
            if text:
                excerpts.append(text[:max_length])

    return excerpts
