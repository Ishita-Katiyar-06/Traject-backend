"""TRAJECT Narrative Quality and Cross-Source Validation Engine.

Provides deterministic validation, evidence scoring, and cross-source / cross-domain
co-occurrence analytics over the frozen Milestone 4A-4H outputs without altering
model weights, schemas, or the Priority Signal Score formula.
"""

from collections import Counter, defaultdict
from datetime import datetime, timezone
from enum import StrEnum
import logging
from typing import Any, Sequence

from pydantic import BaseModel, ConfigDict, Field

from app.collectors.telegram.registry import TelegramSourceRegistry, load_telegram_source_registry
from app.ml.narratives.models import NarrativeCandidate
from app.ml.pipeline.orchestrator import MLPipelineResult
from app.schemas.canonical_message import CanonicalMessage

logger = logging.getLogger("traject.analytics.narrative_validation")


class NarrativeQualityClassification(StrEnum):
    """Deterministic observational evidence tiers for narrative candidates.
    
    Distinguishes data coverage and evidence robustness from priority/significance.
    Never combines with or replaces the Priority Signal Score.
    """
    STRONG_EVIDENCE = "strong_evidence"          # >= 5 messages across >= 2 distinct sources
    MODERATE_EVIDENCE = "moderate_evidence"      # >= 3 messages OR (>= 2 messages across >= 2 sources)
    LIMITED_EVIDENCE = "limited_evidence"        # 2 messages from a single source
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"  # < 2 messages or zero meaningful text


class NarrativeQualityMetrics(BaseModel):
    """Structured quality assessment and cross-source evidence for a single narrative candidate."""
    model_config = ConfigDict(extra="forbid")

    narrative_id: str = Field(description="Unique narrative candidate identifier (e.g. narrative_000)")
    topic_id: str = Field(description="Underlying 4E Topic cluster ID (e.g. topic_175)")
    headline_claim: str = Field(description="Deterministic framing claim from 4G")
    message_count: int = Field(ge=1, description="Total supporting messages in this narrative cluster")
    distinct_sources_count: int = Field(ge=1, description="Number of distinct Telegram channels publishing messages")
    distinct_domains_count: int = Field(ge=0, description="Number of distinct registry domains represented")
    is_cross_source: bool = Field(description="True if observed across >= 2 distinct sources")
    is_cross_domain: bool = Field(description="True if observed across >= 2 distinct strategic domains")
    sources_represented: list[str] = Field(default_factory=list, description="Sorted list of channel usernames")
    domains_represented: list[str] = Field(default_factory=list, description="Sorted list of domain identifiers")
    first_observed_utc: datetime = Field(description="Earliest publication timestamp in cluster")
    last_observed_utc: datetime = Field(description="Latest publication timestamp in cluster")
    time_span_seconds: float = Field(ge=0.0, description="Duration between earliest and latest message")
    text_bearing_count: int = Field(ge=0, description="Number of messages containing non-empty text")
    text_bearing_ratio: float = Field(ge=0.0, le=1.0, description="Ratio of text-bearing messages")
    quality_classification: NarrativeQualityClassification = Field(description="Observational evidence tier")
    priority_signal_score: float = Field(ge=0.0, le=1.0, description="Frozen 4G Priority Signal Score")
    priority_tier: str = Field(description="Frozen 4G triage priority tier (critical, high, elevated, routine)")
    sub_scores: dict[str, float] = Field(description="Explainable breakdown: spread, coordination, reach, friction")
    representative_keywords: list[str] = Field(default_factory=list, description="Top terms from 4E c-TF-IDF")
    key_entities: list[str] = Field(default_factory=list, description="Top named entities from 4F")
    validation_notes: list[str] = Field(default_factory=list, description="Deterministic observations and evidence factors")


class CrossSourceOverlapReport(BaseModel):
    """Aggregate cross-source and cross-domain overlap statistics."""
    model_config = ConfigDict(extra="forbid")

    total_narratives: int = Field(ge=0)
    single_source_narratives: int = Field(ge=0)
    multi_source_narratives: int = Field(ge=0, description="Narratives observed across >= 2 distinct sources")
    multi_domain_narratives: int = Field(ge=0, description="Narratives observed across >= 2 distinct domains")
    source_pair_overlaps: dict[str, int] = Field(default_factory=dict, description="Counts of shared narratives per source pair")
    domain_pair_overlaps: dict[str, int] = Field(default_factory=dict, description="Counts of shared narratives per domain pair")
    source_narrative_counts: dict[str, int] = Field(default_factory=dict, description="Narratives per source")
    domain_narrative_counts: dict[str, int] = Field(default_factory=dict, description="Narratives per domain")
    quality_classification_counts: dict[str, int] = Field(default_factory=dict)


class CorpusNarrativeValidationReport(BaseModel):
    """Comprehensive validation report evaluating narrative coherence, explainability, and quality."""
    model_config = ConfigDict(extra="forbid")

    dataset_source: str
    generated_at_utc: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    total_messages_analyzed: int
    total_topics_discovered: int
    total_narratives_promoted: int
    topic_to_narrative_ratio: float = Field(description="Ratio of promoted narratives to discovered topics")
    topic_size_distribution: dict[int, int] = Field(description="Histogram of messages per topic cluster")
    overlap_analysis: CrossSourceOverlapReport
    top_narratives_by_priority: list[NarrativeQualityMetrics]
    top_cross_source_narratives: list[NarrativeQualityMetrics]
    top_cross_domain_narratives: list[NarrativeQualityMetrics]
    weak_narrative_candidates: list[NarrativeQualityMetrics]
    narratives: list[NarrativeQualityMetrics]


class CorpusQualityValidator:
    """Validates narrative quality, coherence, and cross-source evidence across corpus outputs."""

    def __init__(self, registry: TelegramSourceRegistry | None = None) -> None:
        self.registry = registry or load_telegram_source_registry()

    def _resolve_source_domain(self, source_name: str) -> str:
        clean = source_name.strip().lstrip("@")
        entry = self.registry.get_by_username(f"@{clean}") or self.registry.get_by_username(clean)
        return entry.domain if entry else "unknown"

    def classify_evidence_quality(
        self,
        message_count: int,
        distinct_sources_count: int,
        text_bearing_count: int,
        time_span_seconds: float,
    ) -> tuple[NarrativeQualityClassification, list[str]]:
        """Deterministically classifies observational evidence density."""
        notes: list[str] = []

        if text_bearing_count == 0 or message_count < 2:
            notes.append("Insufficient observational messages or text content.")
            return NarrativeQualityClassification.INSUFFICIENT_EVIDENCE, notes

        if message_count >= 5 and distinct_sources_count >= 2:
            notes.append("Strong multi-source corroborated evidence with >=5 messages.")
            if time_span_seconds > 3600:
                notes.append("Temporal breadth extends beyond 1 hour.")
            return NarrativeQualityClassification.STRONG_EVIDENCE, notes

        if message_count >= 3 or (message_count >= 2 and distinct_sources_count >= 2):
            if distinct_sources_count >= 2:
                notes.append("Cross-source corroborated presence across >=2 distinct channels.")
            else:
                notes.append("Moderate cluster depth from single channel.")
            return NarrativeQualityClassification.MODERATE_EVIDENCE, notes

        if message_count == 2 and distinct_sources_count == 1:
            notes.append("Limited evidence: exactly 2 messages observed from a single source.")
            return NarrativeQualityClassification.LIMITED_EVIDENCE, notes

        return NarrativeQualityClassification.LIMITED_EVIDENCE, notes

    def evaluate_narrative(
        self,
        candidate: NarrativeCandidate,
        messages_in_cluster: Sequence[CanonicalMessage],
        topic_keywords: list[str] | None = None,
    ) -> NarrativeQualityMetrics:
        """Evaluates observational evidence and cross-source representation for a single candidate."""
        c_msgs = list(messages_in_cluster)
        msg_count = len(c_msgs) if c_msgs else candidate.data_coverage.message_count

        # Identify sources and domains
        sources_set = set()
        for m in c_msgs:
            src = (m.author_username or m.author_id or "").strip().lstrip("@")
            if src:
                sources_set.add(src)

        # Fallback to candidate broadcasting channels if c_msgs is empty
        if not sources_set:
            for ch in candidate.broadcasting_channels:
                clean_ch = ch.strip().lstrip("@")
                if clean_ch:
                    sources_set.add(clean_ch)

        sources_represented = sorted(sources_set)
        domains_set = {self._resolve_source_domain(s) for s in sources_represented if self._resolve_source_domain(s) != "unknown"}
        domains_represented = sorted(domains_set)

        distinct_sources_count = max(len(sources_represented), candidate.data_coverage.channel_count)
        distinct_domains_count = len(domains_represented)
        is_cross_source = (distinct_sources_count >= 2)
        is_cross_domain = (distinct_domains_count >= 2)

        # Temporal bounds
        if c_msgs:
            dates = [m.published_at for m in c_msgs if m.published_at]
            first_obs = min(dates) if dates else candidate.first_observed_at
            last_obs = max(dates) if dates else candidate.last_observed_at
            text_bearing = sum(1 for m in c_msgs if m.text_content and m.text_content.strip())
        else:
            first_obs = candidate.first_observed_at
            last_obs = candidate.last_observed_at
            text_bearing = candidate.sentiment_profile.total_text_messages_evaluated

        time_span = max(0.0, (last_obs - first_obs).total_seconds()) if (last_obs and first_obs) else 0.0
        text_ratio = round(text_bearing / max(msg_count, 1), 4)

        quality_tier, val_notes = self.classify_evidence_quality(
            message_count=msg_count,
            distinct_sources_count=distinct_sources_count,
            text_bearing_count=text_bearing,
            time_span_seconds=time_span,
        )

        if is_cross_source:
            val_notes.append(f"Spans {distinct_sources_count} distinct channels: {', '.join(sources_represented)}.")
        if is_cross_domain:
            val_notes.append(f"Spans {distinct_domains_count} distinct strategic domains: {', '.join(domains_represented)}.")

        return NarrativeQualityMetrics(
            narrative_id=candidate.narrative_id,
            topic_id=candidate.promoted_from_topic_id,
            headline_claim=candidate.headline_claim,
            message_count=msg_count,
            distinct_sources_count=distinct_sources_count,
            distinct_domains_count=distinct_domains_count,
            is_cross_source=is_cross_source,
            is_cross_domain=is_cross_domain,
            sources_represented=sources_represented,
            domains_represented=domains_represented,
            first_observed_utc=first_obs,
            last_observed_utc=last_obs,
            time_span_seconds=time_span,
            text_bearing_count=text_bearing,
            text_bearing_ratio=text_ratio,
            quality_classification=quality_tier,
            priority_signal_score=candidate.priority_signal_score,
            priority_tier=candidate.priority_tier.value,
            sub_scores={
                "spread_score": candidate.sub_scores.spread_score,
                "coordination_score": candidate.sub_scores.coordination_score,
                "reach_score": candidate.sub_scores.reach_score,
                "friction_score": candidate.sub_scores.friction_score,
            },
            representative_keywords=topic_keywords or [],
            key_entities=candidate.key_entities,
            validation_notes=val_notes,
        )

    def validate_corpus(
        self,
        messages: Sequence[CanonicalMessage],
        ml_result: MLPipelineResult,
    ) -> CorpusNarrativeValidationReport:
        """Executes full quality and cross-source validation over the corpus analytics outputs."""
        logger.info("Executing deterministic narrative quality validation over %d messages...", len(messages))
        messages_by_id = {m.canonical_id: m for m in messages}

        # Build topic -> constituent messages map
        topic_to_msgs: dict[str, list[CanonicalMessage]] = defaultdict(list)
        topic_to_keywords: dict[str, list[str]] = {}
        topic_size_hist: dict[int, int] = Counter()

        for topic in ml_result.topics.topic_records:
            topic_size_hist[topic.message_count] += 1
            kw_list = [k.keyword for k in topic.representative_keywords]
            topic_to_keywords[topic.topic_id] = kw_list
            for mid in topic.sample_message_ids:
                if mid in messages_by_id:
                    topic_to_msgs[topic.topic_id].append(messages_by_id[mid])

        # Evaluate all narrative candidates
        evaluated_narratives: list[NarrativeQualityMetrics] = []
        source_pairs: Counter = Counter()
        domain_pairs: Counter = Counter()
        source_counts: Counter = Counter()
        domain_counts: Counter = Counter()
        quality_counts: Counter = Counter()

        for cand in ml_result.narrative_report.narrative_candidates:
            c_msgs = topic_to_msgs.get(cand.promoted_from_topic_id, [])
            keywords = topic_to_keywords.get(cand.promoted_from_topic_id, [])
            metrics = self.evaluate_narrative(
                candidate=cand,
                messages_in_cluster=c_msgs,
                topic_keywords=keywords,
            )
            evaluated_narratives.append(metrics)
            quality_counts[metrics.quality_classification.value] += 1

            # Accumulate co-occurrences
            srcs = metrics.sources_represented
            doms = metrics.domains_represented

            for s in srcs:
                source_counts[s] += 1
            for d in doms:
                domain_counts[d] += 1

            for i in range(len(srcs)):
                for j in range(i + 1, len(srcs)):
                    pair_key = f"{srcs[i]} <-> {srcs[j]}"
                    source_pairs[pair_key] += 1

            for i in range(len(doms)):
                for j in range(i + 1, len(doms)):
                    pair_key = f"{doms[i]} <-> {doms[j]}"
                    domain_pairs[pair_key] += 1

        total_narratives = len(evaluated_narratives)
        multi_source = sum(1 for n in evaluated_narratives if n.is_cross_source)
        single_source = total_narratives - multi_source
        multi_domain = sum(1 for n in evaluated_narratives if n.is_cross_domain)

        overlap_report = CrossSourceOverlapReport(
            total_narratives=total_narratives,
            single_source_narratives=single_source,
            multi_source_narratives=multi_source,
            multi_domain_narratives=multi_domain,
            source_pair_overlaps=dict(source_pairs.most_common(50)),
            domain_pair_overlaps=dict(domain_pairs.most_common(20)),
            source_narrative_counts=dict(source_counts),
            domain_narrative_counts=dict(domain_counts),
            quality_classification_counts=dict(quality_counts),
        )

        # Ranked collections
        by_priority = sorted(evaluated_narratives, key=lambda n: n.priority_signal_score, reverse=True)
        top_priority = by_priority[:20]

        top_cross_source = sorted(
            [n for n in evaluated_narratives if n.is_cross_source],
            key=lambda n: (n.distinct_sources_count, n.priority_signal_score),
            reverse=True,
        )[:20]

        top_cross_domain = sorted(
            [n for n in evaluated_narratives if n.is_cross_domain],
            key=lambda n: (n.distinct_domains_count, n.priority_signal_score),
            reverse=True,
        )[:20]

        weak_narratives = [
            n for n in evaluated_narratives
            if n.quality_classification in {
                NarrativeQualityClassification.LIMITED_EVIDENCE,
                NarrativeQualityClassification.INSUFFICIENT_EVIDENCE,
            }
        ]

        topics_count = len(ml_result.topics.topic_records)
        ratio = round(total_narratives / max(topics_count, 1), 2)

        return CorpusNarrativeValidationReport(
            dataset_source=ml_result.dataset_source,
            total_messages_analyzed=len(messages),
            total_topics_discovered=topics_count,
            total_narratives_promoted=total_narratives,
            topic_to_narrative_ratio=ratio,
            topic_size_distribution=dict(sorted(topic_size_hist.items())),
            overlap_analysis=overlap_report,
            top_narratives_by_priority=top_priority,
            top_cross_source_narratives=top_cross_source,
            top_cross_domain_narratives=top_cross_domain,
            weak_narrative_candidates=weak_narratives[:50],
            narratives=evaluated_narratives,
        )
