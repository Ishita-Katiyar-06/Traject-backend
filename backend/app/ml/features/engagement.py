from typing import Sequence

from app.ml.features.models import TopicEngagementFeatures
from app.schemas import CanonicalMessage

# Standardized deterministic emoji polarity categories
POSITIVE_EMOJIS = {"👍", "❤️", "🔥", "🎉", "👏", "😍", "🥳", "🙏"}
NEGATIVE_EMOJIS = {"👎", "😡", "🤬", "💩", "🤮", "😢", "💔"}
NEUTRAL_EMOJIS = {"🤔", "👀", "⚡", "✍️", "🫡", "🤝"}


def compute_engagement_features(
    messages: Sequence[CanonicalMessage],
) -> TopicEngagementFeatures:
    """Compute deterministic engagement metrics and mathematical ratios for a topic.
    
    Safe Division Guarantees:
    - Ratios guard against zero views using max(total_views, 1).
    - Polarity heuristic guards against zero reactions using max(total_reactions, 1).
    - Unmapped custom emojis contribute to total_reactions with neutral 0.0 weight.
    """
    total_views = 0
    total_forwards = 0
    total_replies = 0
    total_reactions = 0

    pos_reaction_count = 0
    neg_reaction_count = 0

    peak_views = -1
    peak_views_id: str | None = None

    for msg in messages:
        # Views
        if msg.views_count is not None:
            total_views += msg.views_count
            if msg.views_count > peak_views:
                peak_views = msg.views_count
                peak_views_id = msg.canonical_id

        # Forwards
        if msg.forwards_count is not None:
            total_forwards += msg.forwards_count

        # Replies
        if msg.replies_count is not None:
            total_replies += msg.replies_count

        # Reactions
        if msg.reactions:
            for emoji_char, count in msg.reactions.items():
                if count > 0:
                    total_reactions += count
                    if emoji_char in POSITIVE_EMOJIS:
                        pos_reaction_count += count
                    elif emoji_char in NEGATIVE_EMOJIS:
                        neg_reaction_count += count

    # Ratios
    denom_views = max(total_views, 1)
    fwd_ratio = round(total_forwards / denom_views, 4) if total_views > 0 else 0.0
    reply_ratio = round(total_replies / denom_views, 4) if total_views > 0 else 0.0
    reaction_ratio = round(total_reactions / denom_views, 4) if total_views > 0 else 0.0

    # Emoji Polarity Score (heuristic [-1.0, 1.0])
    if total_reactions > 0:
        polarity = round((pos_reaction_count - neg_reaction_count) / total_reactions, 4)
    else:
        polarity = 0.0

    return TopicEngagementFeatures(
        total_views=total_views,
        total_forwards=total_forwards,
        total_replies=total_replies,
        total_reactions=total_reactions,
        forward_to_view_ratio=fwd_ratio,
        reply_to_view_ratio=reply_ratio,
        reaction_to_view_ratio=reaction_ratio,
        emoji_polarity_score=polarity,
        peak_views_message_id=peak_views_id if peak_views >= 0 else None,
    )
