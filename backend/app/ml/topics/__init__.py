from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.ml.topics.clustering import cluster_embeddings
    from app.ml.topics.discovery import discover_topics
    from app.ml.topics.embeddings import SentenceEmbeddingAdapter
    from app.ml.topics.models import (
        ClusteringConfig,
        TopicDiscoveryResult,
        TopicKeyword,
        TopicRecord,
    )
    from app.ml.topics.representation import (
        build_topic_records,
        extract_cluster_keywords,
        find_representative_messages,
        tokenize_text,
    )


def __getattr__(name: str):
    import app.ml.topics.models as m
    if hasattr(m, name):
        return getattr(m, name)
    import app.ml.topics.embeddings as e
    if hasattr(e, name):
        return getattr(e, name)
    import app.ml.topics.clustering as c
    if hasattr(c, name):
        return getattr(c, name)
    import app.ml.topics.representation as r
    if hasattr(r, name):
        return getattr(r, name)
    import app.ml.topics.discovery as d
    if hasattr(d, name):
        return getattr(d, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "TopicKeyword",
    "TopicRecord",
    "ClusteringConfig",
    "TopicDiscoveryResult",
    "SentenceEmbeddingAdapter",
    "cluster_embeddings",
    "tokenize_text",
    "extract_cluster_keywords",
    "find_representative_messages",
    "build_topic_records",
    "discover_topics",
]
