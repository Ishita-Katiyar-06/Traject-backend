from typing import Sequence

import numpy as np

from app.ml.features.models import TopicPropagationFeatures
from app.schemas import AuthorType, CanonicalMessage


def parse_origin_channel(origin_source_id: str | None) -> str | None:
    """Extract clean origin channel identifier from canonical origin_source_id.
    
    Examples:
    - 'telegram:3190072493:1082' -> '3190072493'
    - 'telegram:channel_news' -> 'channel_news'
    """
    if not origin_source_id:
        return None
    parts = origin_source_id.split(":")
    if len(parts) >= 3:
        return parts[1]
    elif len(parts) == 2:
        return parts[1]
    return origin_source_id


def extract_broadcasting_channel_id(msg: CanonicalMessage) -> str | None:
    """Extract broadcasting channel identifier only if reliably known to be a channel.
    
    Returns:
        Channel identifier string if author_type is AuthorType.CHANNEL, else None.
    """
    if msg.author_type == AuthorType.CHANNEL:
        return msg.author_id
    return None


def compute_propagation_features(
    messages: Sequence[CanonicalMessage],
    embeddings: np.ndarray | None = None,
    syndication_similarity_threshold: float = 0.92,
) -> TopicPropagationFeatures:
    """Compute platform-observed forwarding and uncredited syndication features.
    
    Args:
        messages: CanonicalMessages belonging to a topic.
        embeddings: Optional parallel 2D numpy array of L2-normalized sentence embeddings.
        syndication_similarity_threshold: Cosine similarity cutoff for uncredited duplication.
        
    Returns:
        TopicPropagationFeatures: Deterministic propagation metrics.
    """
    total_messages = len(messages)
    if total_messages == 0:
        return TopicPropagationFeatures()

    observed_forward_count = 0
    cross_channel_spread = 0
    origin_channels: set[str] = set()
    amplifying_channels: set[str] = set()

    for msg in messages:
        if msg.is_forward and msg.origin_source_id:
            observed_forward_count += 1

            origin_chan = parse_origin_channel(msg.origin_source_id)
            if origin_chan:
                origin_channels.add(origin_chan)

            broadcasting_chan = extract_broadcasting_channel_id(msg)
            if broadcasting_chan:
                amplifying_channels.add(broadcasting_chan)

            # Cross-channel spread is counted ONLY when BOTH:
            # 1. the origin channel ID is reliably known
            # 2. the actual broadcasting/source channel ID is reliably known
            # Then compare: broadcasting_channel_id != origin_channel_id
            if origin_chan is not None and broadcasting_chan is not None:
                if broadcasting_chan != origin_chan:
                    cross_channel_spread += 1

    direct_fwd_ratio = round(observed_forward_count / total_messages, 4)

    # Detect uncredited textual syndication (near-duplicates across different authors/channels without forward tag)
    uncredited_syndication_count = 0
    non_forward_indices = [
        i for i, m in enumerate(messages)
        if not m.is_forward and not m.origin_source_id and len(m.text_content.strip()) > 0
    ]

    if embeddings is not None and len(non_forward_indices) >= 2:
        # Check pairwise cosine similarities among non-forward messages
        flagged_as_duplicate: set[int] = set()
        for idx_a in range(len(non_forward_indices)):
            i = non_forward_indices[idx_a]
            if i in flagged_as_duplicate:
                continue
            vec_i = embeddings[i]
            for idx_b in range(idx_a + 1, len(non_forward_indices)):
                j = non_forward_indices[idx_b]
                if j in flagged_as_duplicate:
                    continue
                # Syndication occurs across different authors/channels
                if messages[i].author_id == messages[j].author_id:
                    continue
                vec_j = embeddings[j]
                # Assuming embeddings are L2 normalized, cosine sim is dot product
                sim = float(np.dot(vec_i, vec_j))
                if sim >= syndication_similarity_threshold:
                    flagged_as_duplicate.add(j)
                    uncredited_syndication_count += 1
    elif len(non_forward_indices) >= 2:
        # Fallback: exact or near-verbatim token Jaccard similarity across different authors
        flagged_as_duplicate: set[int] = set()
        for idx_a in range(len(non_forward_indices)):
            i = non_forward_indices[idx_a]
            if i in flagged_as_duplicate:
                continue
            words_i = set(messages[i].text_content.lower().split())
            if not words_i:
                continue
            for idx_b in range(idx_a + 1, len(non_forward_indices)):
                j = non_forward_indices[idx_b]
                if j in flagged_as_duplicate:
                    continue
                if messages[i].author_id == messages[j].author_id:
                    continue
                words_j = set(messages[j].text_content.lower().split())
                if not words_j:
                    continue
                jaccard = len(words_i & words_j) / len(words_i | words_j)
                if jaccard >= syndication_similarity_threshold:
                    flagged_as_duplicate.add(j)
                    uncredited_syndication_count += 1

    return TopicPropagationFeatures(
        observed_forward_count=observed_forward_count,
        direct_forward_ratio=direct_fwd_ratio,
        unique_origin_channels=sorted(origin_channels),
        unique_amplifying_channels=sorted(amplifying_channels),
        cross_channel_observed_spread=cross_channel_spread,
        uncredited_syndication_count=uncredited_syndication_count,
    )
