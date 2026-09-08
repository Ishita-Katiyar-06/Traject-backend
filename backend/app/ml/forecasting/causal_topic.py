"""
Milestone 8C.1: Causal Topic Representation Engine.

Implements genuine causal topic discovery, representation, and future projection:
1. Strict entry gate: ONLY messages with published_at <= T are accepted for topic construction.
2. Causal clustering: Topic boundaries, vocabulary, and centroids are constructed
   strictly from historical messages <= T. Future messages (> T) never enter the clustering input.
3. Candidate topic selection: Topics active in (T - lookback_hours, T] are marked as candidates.
4. Causal centroids: Centroid vectors are constructed strictly as the normalized mean
   of historical message feature vectors in each cluster.
5. Future ground-truth projection: Future messages in (T, T+H] are projected onto the frozen
   historical centroids to evaluate future topic activity without leaking future data into features.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Sequence

import numpy as np
from sklearn.cluster import HDBSCAN
from sklearn.feature_extraction.text import TfidfVectorizer

from app.ml.topics.representation import tokenize_text
from app.schemas.canonical_message import CanonicalMessage
from app.schemas.forecasting import CausalTopicProfile

logger = logging.getLogger("traject.ml.forecasting.causal_topic")


@dataclass
class CausalTopicRepresentation:
    """Immutable causal snapshot of all discovered topics and feature spaces at cutoff T."""
    cutoff_at_utc: datetime
    total_input_messages: int
    historical_messages_count: int
    clustered_messages_count: int
    noise_messages_count: int
    topic_profiles: dict[str, CausalTopicProfile]
    topic_messages: dict[str, list[CanonicalMessage]]
    topic_centroids: dict[str, np.ndarray]
    vectorizer: TfidfVectorizer | None = None
    feature_names: list[str] = field(default_factory=list)


def build_causal_topics(
    messages: Sequence[CanonicalMessage],
    cutoff_at: datetime,
    history_window_days: float | None = 30.0,
    lookback_hours: float = 48.0,
    min_cluster_size: int = 3,
    top_keywords: int = 5,
) -> CausalTopicRepresentation:
    """Construct causal topic representations strictly from messages published <= cutoff_at.

    NON-NEGOTIABLE GUARANTEES:
    1. Input Gating: Any message with published_at > cutoff_at is strictly purged at line 1.
    2. Causal Construction: Topic discovery, cluster boundaries, vocabulary, and centroids
       are computed strictly from historical messages <= cutoff_at.
    3. Invariance: Deleting every message published after cutoff_at from `messages` yields
       the EXACT same topic representation, centroids, vocabulary, and candidates.
    """
    if cutoff_at.tzinfo is None:
        cutoff_at = cutoff_at.replace(tzinfo=timezone.utc)
    else:
        cutoff_at = cutoff_at.astimezone(timezone.utc)

    # 1. STRICT CAUSAL GATE: Filter input strictly to <= cutoff_at
    hist_messages = [m for m in messages if m.published_at <= cutoff_at]
    total_hist = len(hist_messages)

    # Apply historical clustering window if specified
    if history_window_days is not None:
        window_start = cutoff_at - timedelta(days=history_window_days)
        window_messages = [m for m in hist_messages if m.published_at >= window_start]
    else:
        window_messages = hist_messages

    # Filter messages that have non-empty text content
    valid_messages = [m for m in window_messages if m.text_content and m.text_content.strip()]
    n_valid = len(valid_messages)

    if n_valid < 2:
        return CausalTopicRepresentation(
            cutoff_at_utc=cutoff_at,
            total_input_messages=len(messages),
            historical_messages_count=total_hist,
            clustered_messages_count=0,
            noise_messages_count=total_hist,
            topic_profiles={},
            topic_messages={},
            topic_centroids={},
            vectorizer=None,
            feature_names=[],
        )

    # 2. Causal Feature Space Construction
    min_df = 1 if n_valid < 20 else 2
    vectorizer = TfidfVectorizer(
        max_features=1000,
        stop_words="english",
        min_df=min_df,
    )
    texts = [m.text_content for m in valid_messages]
    try:
        X = vectorizer.fit_transform(texts).toarray()
        feature_names = vectorizer.get_feature_names_out().tolist()
    except Exception as exc:
        logger.warning("Could not fit TF-IDF on historical messages: %s", exc)
        return CausalTopicRepresentation(
            cutoff_at_utc=cutoff_at,
            total_input_messages=len(messages),
            historical_messages_count=total_hist,
            clustered_messages_count=0,
            noise_messages_count=total_hist,
            topic_profiles={},
            topic_messages={},
            topic_centroids={},
            vectorizer=None,
            feature_names=[],
        )

    # 3. Causal HDBSCAN Clustering
    eff_min_cluster_size = min(min_cluster_size, max(2, n_valid // 3))
    hdb = HDBSCAN(
        min_cluster_size=eff_min_cluster_size,
        min_samples=1,
        metric="euclidean",
        cluster_selection_method="eom",
        copy=True,
    )
    labels = hdb.fit_predict(X)

    # Group messages and indices by cluster label
    cluster_indices: dict[int, list[int]] = defaultdict(list)
    cluster_msgs: dict[int, list[CanonicalMessage]] = defaultdict(list)
    noise_count = 0

    for idx, lbl in enumerate(labels):
        if lbl == -1:
            noise_count += 1
        else:
            cluster_indices[lbl].append(idx)
            cluster_msgs[lbl].append(valid_messages[idx])

    # 4. Build Causal Profiles and Centroids
    topic_profiles: dict[str, CausalTopicProfile] = {}
    topic_messages: dict[str, list[CanonicalMessage]] = {}
    topic_centroids: dict[str, np.ndarray] = {}
    cutoff_tag = cutoff_at.strftime("%Y%m%d_%H%M")
    start_lookback = cutoff_at - timedelta(hours=lookback_hours)

    for cluster_lbl, idx_list in sorted(cluster_indices.items()):
        topic_id = f"causal_{cutoff_tag}_{cluster_lbl:03d}"
        c_msgs = cluster_msgs[cluster_lbl]

        # Centroid: mean vector of member messages in causal feature space
        c_vec = np.mean(X[idx_list], axis=0)
        norm = np.linalg.norm(c_vec)
        norm_centroid = (c_vec / norm) if norm > 0 else c_vec
        topic_centroids[topic_id] = norm_centroid

        # Keywords: extracted strictly from member message text
        token_counts: Counter[str] = Counter()
        for m in c_msgs:
            if m.text_content:
                token_counts.update(tokenize_text(m.text_content))
        hist_keywords = [w for w, _ in token_counts.most_common(top_keywords)]

        # Candidate eligibility: published within lookback window
        is_candidate = any(start_lookback < m.published_at <= cutoff_at for m in c_msgs)
        first_seen = min(m.published_at for m in c_msgs)
        last_seen = max(m.published_at for m in c_msgs)

        profile = CausalTopicProfile(
            topic_id=topic_id,
            cutoff_at_utc=cutoff_at,
            historical_message_count=len(c_msgs),
            historical_message_ids=[m.canonical_id for m in c_msgs],
            historical_keywords=hist_keywords,
            historical_centroid=norm_centroid.tolist(),
            is_candidate=is_candidate,
            first_seen_at_utc=first_seen,
            last_seen_at_utc=last_seen,
        )

        topic_profiles[topic_id] = profile
        topic_messages[topic_id] = c_msgs

    clustered_count = sum(len(msgs) for msgs in topic_messages.values())
    total_noise = total_hist - clustered_count

    return CausalTopicRepresentation(
        cutoff_at_utc=cutoff_at,
        total_input_messages=len(messages),
        historical_messages_count=total_hist,
        clustered_messages_count=clustered_count,
        noise_messages_count=total_noise,
        topic_profiles=topic_profiles,
        topic_messages=topic_messages,
        topic_centroids=topic_centroids,
        vectorizer=vectorizer,
        feature_names=feature_names,
    )


def project_future_messages_to_causal_topics(
    future_messages: Sequence[CanonicalMessage],
    representation: CausalTopicRepresentation,
    similarity_threshold: float = 0.40,
) -> dict[str, list[CanonicalMessage]]:
    """Project future messages in (T, T+H] onto frozen causal topic centroids.

    Guarantees:
    - Uses ONLY the frozen historical vectorizer and centroids constructed at T.
    - Future messages cannot alter topic boundaries, centroids, or keywords.
    - Matches future messages to the nearest candidate topic exceeding `similarity_threshold`.
    """
    candidate_topic_ids = [
        t_id for t_id, p in representation.topic_profiles.items() if p.is_candidate
    ]
    assigned_future: dict[str, list[CanonicalMessage]] = {t_id: [] for t_id in candidate_topic_ids}

    if not candidate_topic_ids or representation.vectorizer is None or not future_messages:
        return assigned_future

    valid_future = [m for m in future_messages if m.text_content and m.text_content.strip()]
    if not valid_future:
        return assigned_future

    try:
        X_fut = representation.vectorizer.transform([m.text_content for m in valid_future]).toarray()
    except Exception as exc:
        logger.warning("Could not transform future messages: %s", exc)
        return assigned_future

    norms = np.linalg.norm(X_fut, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    X_fut_norm = X_fut / norms

    C_mat = np.stack([representation.topic_centroids[t_id] for t_id in candidate_topic_ids])
    sims = np.dot(X_fut_norm, C_mat.T)  # (n_future, n_cands)

    max_sims = np.max(sims, axis=1)
    best_cands = np.argmax(sims, axis=1)

    for j, f_msg in enumerate(valid_future):
        if max_sims[j] >= similarity_threshold:
            cand_id = candidate_topic_ids[best_cands[j]]
            assigned_future[cand_id].append(f_msg)

    return assigned_future
