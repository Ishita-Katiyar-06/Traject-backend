from typing import Sequence

from app.ml.features.models import EnrichedTopicCandidate, SocialEntityCategory
from app.ml.narratives.models import (
    EvidenceDensityTier,
    NarrativeDataCoverage,
)
from app.schemas import CanonicalMessage


def compute_data_coverage(
    candidate: EnrichedTopicCandidate,
    messages: Sequence[CanonicalMessage],
) -> NarrativeDataCoverage:
    """Compute evidence-density and data quality coverage metadata.
    
    CRITICAL POLICY:
    EvidenceDensityTier represents an observational density heuristic (sample size, 
    channel breadth, timespan), NOT statistical confidence. Missing reactions alone 
    do NOT downgrade a sufficiently observed candidate to sparse.
    """
    total = len(messages)
    if total == 0:
        return NarrativeDataCoverage(
            message_count=0,
            channel_count=0,
            timespan_seconds=0.0,
            has_views_coverage=False,
            has_reactions_coverage=False,
            evidence_density=EvidenceDensityTier.SPARSE,
            data_quality_notes=["Empty candidate message collection."],
        )

    unique_channels = {m.author_id for m in messages}
    channel_count = len(unique_channels)
    timespan = candidate.temporal.timespan_seconds

    views_count_present = sum(1 for m in messages if m.views_count is not None)
    has_views = (views_count_present / total) >= 0.50

    reactions_present = sum(1 for m in messages if m.reactions and len(m.reactions) > 0)
    has_reactions = (reactions_present / total) >= 0.50

    notes: list[str] = []

    # Density grading
    if total >= 10 and channel_count >= 2 and timespan > 0.0:
        density = EvidenceDensityTier.HIGH
    elif total >= 3:
        density = EvidenceDensityTier.MODERATE
    else:
        density = EvidenceDensityTier.SPARSE

    if total < 3:
        notes.append("Sparse sample size (<3 messages); temporal dispersion and entry velocity are unmeasured.")
    if timespan == 0.0 and total > 1:
        notes.append("Zero elapsed duration; messages share identical timestamps.")
    if not has_views:
        notes.append("Observed views unavailable on >=50% of messages; exposure metric relies on available sample.")
    if not has_reactions:
        notes.append("Reaction emojis unavailable on >=50% of messages; friction metric relies on text/reply signals.")

    return NarrativeDataCoverage(
        message_count=total,
        channel_count=channel_count,
        timespan_seconds=timespan,
        has_views_coverage=has_views,
        has_reactions_coverage=has_reactions,
        evidence_density=density,
        data_quality_notes=notes,
    )


def synthesize_headline_claim(
    candidate: EnrichedTopicCandidate,
    stance: str | None = None,
    subject_context: str | None = None,
) -> str:
    """Synthesize deterministic, explainable headline framing without generative LLMs.
    
    Structure:
        "[Key Entities] Dominant c-TF-IDF Action/Topic Keywords [• Stance Framing]"
    """
    # 1. Prioritize Geopolitical / Org gazetteers, then hashtags, then handles
    geo_org = [
        e.text for e in candidate.entities
        if e.category in (SocialEntityCategory.GAZETTEER_GEO, SocialEntityCategory.GAZETTEER_ORG)
    ]
    hashtags = [
        f"#{e.text}" for e in candidate.entities
        if e.category == SocialEntityCategory.HASHTAG
    ]
    handles = [
        f"@{e.text}" for e in candidate.entities
        if e.category == SocialEntityCategory.HANDLE
    ]

    focus_entities: list[str] = []
    for ent in geo_org[:2] + hashtags[:2] + handles[:1]:
        if ent not in focus_entities:
            focus_entities.append(ent)

    if focus_entities:
        entity_prefix = f"[{', '.join(focus_entities[:3])}]"
    elif subject_context:
        entity_prefix = f"[{subject_context}]"
    else:
        entity_prefix = f"[{candidate.topic_id}]"

    # 2. Top discriminative c-TF-IDF keywords or stance framing
    keywords = candidate.representative_keywords[:5]
    if keywords:
        kw_str = ", ".join(keywords)
        if stance == "supportive" and "support" not in kw_str.lower():
            kw_str = f"{kw_str} • supportive reception"
        elif stance == "critical" and "critic" not in kw_str.lower():
            kw_str = f"{kw_str} • critical pushback"
        elif stance == "skeptical" and "question" not in kw_str.lower():
            kw_str = f"{kw_str} • skeptical inquiries"
    else:
        if stance == "supportive":
            kw_str = "supportive commentary and approval"
        elif stance == "critical":
            kw_str = "critical pushback and dissenting reactions"
        elif stance == "skeptical":
            kw_str = "skeptical inquiry and scrutiny"
        elif stance == "informational":
            kw_str = "broadcast updates and reporting"
        else:
            kw_str = "monitored discourse updates"

    return f"{entity_prefix} {kw_str}"


def extract_representative_excerpts(
    messages: Sequence[CanonicalMessage],
    max_excerpts: int = 3,
    max_length: int = 140,
) -> list[str]:
    """Extract clean, bounded text excerpts of representative centroid messages for analyst review."""
    excerpts: list[str] = []
    seen_texts: set[str] = set()

    for m in messages:
        text = m.text_content.strip()
        if not text or text in seen_texts:
            continue

        seen_texts.add(text)
        if len(text) > max_length:
            snippet = text[:max_length - 3] + "..."
        else:
            snippet = text

        excerpts.append(snippet)
        if len(excerpts) >= max_excerpts:
            break

    return excerpts
