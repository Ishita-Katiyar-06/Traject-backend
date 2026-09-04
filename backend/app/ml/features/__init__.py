from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.ml.features.engagement import (
        NEGATIVE_EMOJIS,
        NEUTRAL_EMOJIS,
        POSITIVE_EMOJIS,
        compute_engagement_features,
    )
    from app.ml.features.enrichment import enrich_topics
    from app.ml.features.entities import (
        extract_domain_from_url,
        extract_social_entities,
    )
    from app.ml.features.models import (
        EnrichedTopicCandidate,
        SocialEntityCategory,
        TopicEngagementFeatures,
        TopicEnrichmentResult,
        TopicEntity,
        TopicPropagationFeatures,
        TopicTemporalFeatures,
    )
    from app.ml.features.propagation import (
        compute_propagation_features,
        parse_origin_channel,
    )
    from app.ml.features.temporal import compute_temporal_features


def __getattr__(name: str):
    import app.ml.features.models as m
    if hasattr(m, name):
        return getattr(m, name)
    import app.ml.features.entities as e
    if hasattr(e, name):
        return getattr(e, name)
    import app.ml.features.engagement as eng
    if hasattr(eng, name):
        return getattr(eng, name)
    import app.ml.features.propagation as p
    if hasattr(p, name):
        return getattr(p, name)
    import app.ml.features.temporal as t
    if hasattr(t, name):
        return getattr(t, name)
    import app.ml.features.enrichment as enr
    if hasattr(enr, name):
        return getattr(enr, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "SocialEntityCategory",
    "TopicEntity",
    "TopicEngagementFeatures",
    "TopicPropagationFeatures",
    "TopicTemporalFeatures",
    "EnrichedTopicCandidate",
    "TopicEnrichmentResult",
    "extract_domain_from_url",
    "extract_social_entities",
    "compute_engagement_features",
    "POSITIVE_EMOJIS",
    "NEGATIVE_EMOJIS",
    "NEUTRAL_EMOJIS",
    "parse_origin_channel",
    "compute_propagation_features",
    "compute_temporal_features",
    "enrich_topics",
]
