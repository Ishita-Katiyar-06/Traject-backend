import math
import regex as re
from collections import Counter
from typing import Any, Sequence

import numpy as np

from app.ml.topics.models import TopicKeyword, TopicRecord

# Regex patterns for social media token extraction
URL_PATTERN = re.compile(r"https?://\S+|www\.\S+|t\.me/\S+", re.IGNORECASE)
MENTION_PATTERN = re.compile(r"@\w+", re.UNICODE)
# Word token pattern: match letters and combining marks (matras/accents) across Latin, Devanagari, Cyrillic, etc.
WORD_PATTERN = re.compile(r"#?\p{L}[\p{L}\p{M}\p{N}]*", re.UNICODE)


COMMON_STOPWORDS = {
    # English
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "with",
    "by", "about", "against", "between", "into", "through", "during", "before",
    "after", "above", "below", "from", "up", "down", "is", "are", "was", "were",
    "be", "been", "being", "have", "has", "had", "do", "does", "did", "can",
    "could", "shall", "should", "will", "would", "may", "might", "must", "of",
    "it", "its", "they", "them", "their", "this", "that", "these", "those",
    "i", "you", "he", "she", "we", "my", "your", "his", "her", "our", "as",
    "if", "each", "all", "both", "some", "few", "more", "most", "other", "than",
    "too", "very", "just", "so", "no", "not", "only", "same", "also", "then",
    # Hindi common function words
    "है", "हैं", "था", "थी", "थे", "हो", "होता", "होती", "होते", "हुए", "हुआ",
    "हुई", "का", "के", "की", "को", "में", "से", "पर", "ने", "लिए", "और", "या",
    "यह", "वह", "इस", "उस", "एक", "भी", "तो", "ही", "तक", "कर", "किया", "दिया",
    # Russian common function words
    "и", "в", "во", "не", "что", "он", "на", "я", "с", "со", "как", "а", "то",
    "все", "она", "так", "его", "но", "да", "ты", "к", "у", "же", "вы", "за",
    "бы", "по", "только", "ее", "мне", "было", "вот", "от", "меня", "еще", "нет",
}


def tokenize_text(text: str) -> list[str]:
    """Tokenize social text while stripping URLs, raw mentions, and standalone digits.
    
    Preserves hashtags and multilingual Unicode tokens.
    """
    # Remove URLs and raw user handles
    cleaned = URL_PATTERN.sub(" ", text)
    cleaned = MENTION_PATTERN.sub(" ", cleaned)

    tokens: list[str] = []
    for raw in WORD_PATTERN.findall(cleaned.lower()):
        # Strip '#' prefix if present for keyword analysis but preserve word
        word = raw.lstrip("#")
        if len(word) >= 2 and not word.isdigit() and word not in COMMON_STOPWORDS:
            tokens.append(word)

    return tokens


def extract_cluster_keywords(
    cluster_texts: list[str],
    all_cluster_texts: list[list[str]],
    top_k: int = 5,
) -> list[TopicKeyword]:
    """Extract representative keywords using class-based TF-IDF (c-TF-IDF).
    
    Formula:
        W_{t, c} = TF_{t, c} * log(1 + A / f_t)
    where A is the average words per cluster and f_t is total frequency across all clusters.
    """
    cluster_tokens = [token for text in cluster_texts for token in tokenize_text(text)]
    if not cluster_tokens:
        return []

    tf = Counter(cluster_tokens)
    cluster_sizes = [sum(len(tokenize_text(t)) for t in c) for c in all_cluster_texts]
    avg_words = (sum(cluster_sizes) / len(cluster_sizes)) if cluster_sizes else 1.0

    # Global term frequency across all clusters
    global_tf: Counter[str] = Counter()
    for c in all_cluster_texts:
        for t in c:
            global_tf.update(tokenize_text(t))

    scores: list[tuple[str, float]] = []
    for term, count in tf.items():
        freq_global = global_tf.get(term, count)
        # c-TF-IDF weight
        weight = count * math.log(1.0 + (avg_words / max(freq_global, 1)))
        scores.append((term, weight))

    # Sort descending by weight
    scores.sort(key=lambda x: x[1], reverse=True)

    max_score = scores[0][1] if scores else 1.0
    top_keywords: list[TopicKeyword] = []
    for term, score in scores[:top_k]:
        norm_score = round(score / max_score if max_score > 0 else 1.0, 4)
        top_keywords.append(TopicKeyword(keyword=term, score=norm_score))

    return top_keywords


def find_representative_messages(
    cluster_embeddings: np.ndarray,
    canonical_ids: list[str],
    top_m: int = 3,
) -> list[str]:
    """Find canonical IDs of messages closest to the cluster centroid in embedding space."""
    if len(cluster_embeddings) == 0:
        return []

    # Calculate cluster centroid
    centroid = np.mean(cluster_embeddings, axis=0)
    norm = np.linalg.norm(centroid)
    if norm > 0:
        centroid = centroid / norm

    # Calculate cosine distances to centroid: 1 - cos_sim
    # Assuming embeddings are already L2 normalized:
    similarities = np.dot(cluster_embeddings, centroid)
    # Rank descending by similarity
    ranked_indices = np.argsort(-similarities)

    return [canonical_ids[i] for i in ranked_indices[:top_m]]


def build_topic_records(
    canonical_ids: list[str],
    texts: list[str],
    embeddings: np.ndarray,
    labels: np.ndarray,
    top_keywords: int = 5,
    top_representative_messages: int = 3,
) -> tuple[list[TopicRecord], list[str]]:
    """Construct structured TopicRecords and isolate noise message IDs.
    
    Args:
        canonical_ids: Parallel list of canonical IDs.
        texts: Parallel list of message texts.
        embeddings: 2D numpy array of embeddings.
        labels: 1D array of HDBSCAN cluster labels (-1 is noise).
        top_keywords: Number of keywords per topic.
        top_representative_messages: Number of centroid-proximal message IDs.
        
    Returns:
        tuple[list[TopicRecord], list[str]]: (sorted_topic_records, noise_ids).
    """
    total_messages = len(canonical_ids)
    unique_labels = sorted(set(labels))
    cluster_labels = [l for l in unique_labels if l != -1]

    # Pre-aggregate texts for all clusters to compute c-TF-IDF
    cluster_texts_map: dict[int, list[str]] = {
        l: [texts[i] for i in range(total_messages) if labels[i] == l]
        for l in cluster_labels
    }
    all_cluster_text_lists = list(cluster_texts_map.values())

    topic_records: list[TopicRecord] = []
    noise_ids: list[str] = [canonical_ids[i] for i in range(total_messages) if labels[i] == -1]

    for label in cluster_labels:
        indices = [i for i in range(total_messages) if labels[i] == label]
        c_ids = [canonical_ids[i] for i in indices]
        c_texts = [texts[i] for i in indices]
        c_embeddings = embeddings[indices]

        keywords = extract_cluster_keywords(
            cluster_texts=c_texts,
            all_cluster_texts=all_cluster_text_lists,
            top_k=top_keywords,
        )

        rep_ids = find_representative_messages(
            cluster_embeddings=c_embeddings,
            canonical_ids=c_ids,
            top_m=top_representative_messages,
        )

        pct = round((len(indices) / total_messages) * 100.0, 2) if total_messages > 0 else 0.0

        record = TopicRecord(
            topic_id=f"topic_{label:03d}",
            cluster_label=label,
            message_count=len(indices),
            percentage_of_dataset=pct,
            representative_keywords=keywords,
            representative_message_ids=rep_ids,
            sample_message_ids=c_ids,
        )
        topic_records.append(record)

    # Sort topics descending by message count
    topic_records.sort(key=lambda r: r.message_count, reverse=True)
    return topic_records, noise_ids
