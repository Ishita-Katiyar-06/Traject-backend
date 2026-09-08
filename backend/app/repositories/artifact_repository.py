from datetime import datetime, timezone
import hashlib
import json
import logging
import math
from pathlib import Path
from typing import Any, Sequence
import urllib.parse

from app.core.config import APISettings, find_repo_root, get_settings
from app.ml.features.models import EnrichedTopicCandidate, TopicEnrichmentResult
from app.ml.narratives.models import NarrativeAssessmentReport, NarrativeCandidate
from app.ml.pipeline.metrics import PipelineStageMetrics
from app.ml.pipeline.orchestrator import MLPipelineResult
from app.ml.topics.models import TopicDiscoveryResult, TopicRecord
from app.schemas.api.analytics import (
    AnalyticsOverviewData,
    DatasetSummaryCounts,
    PipelineExecutionSummary,
    SentimentDistribution,
    SentimentOverview,
)
from app.schemas.api.common import PaginationMeta
from app.schemas.api.messages import MessageDetailData, MessageSummaryResponse
from app.schemas.api.narratives import NarrativeDetailData, NarrativeSummaryResponse
from app.schemas.api.trends import (
    GraphEdge,
    GraphNode,
    NarrativeSentimentData,
    SentimentBucket,
    SentimentSummary,
    TrendChannelSummary,
    TrendDetailData,
    TrendGraphData,
    TrendKeywordResponse,
    TrendSentimentData,
    TrendSummaryResponse,
)
from app.schemas.api.pipeline import (
    CachePerformance,
    CacheStatus,
    ExecutionBreakdown,
    MemoryFootprint,
    PipelineMetricsResponse,
    PipelineStatusResponse,
    RecordAccounting,
    StageLatencies,
    ThroughputSamples,
)
from app.schemas.api.topics import TopicDetailData, TopicKeywordResponse, TopicSummaryResponse
from app.schemas.canonical_message import CanonicalMessage
from app.storage.parquet import read_canonical_messages

logger = logging.getLogger("traject.repositories.artifact")


class ArtifactRepository:
    """Thread-safe in-memory query engine serving precomputed analytics and canonical records."""

    def __init__(self, settings: APISettings | None = None) -> None:
        self.settings = settings or get_settings()
        self.repo_root = find_repo_root()
        
        # State indicators
        self.artifacts_loaded: bool = False
        self.dataset_source: str = "unknown"
        self.pipeline_version: str = "4h.v1"
        self.created_at_utc: str = ""

        # In-memory indices
        self._messages: list[CanonicalMessage] = []
        self._messages_by_id: dict[str, CanonicalMessage] = {}
        self._topics_by_id: dict[str, TopicRecord] = {}
        self._enriched_topics_by_id: dict[str, EnrichedTopicCandidate] = {}
        self._narratives_by_id: dict[str, NarrativeCandidate] = {}
        self._sorted_narratives: list[NarrativeCandidate] = []
        self._message_to_topic: dict[str, str] = {}
        self._narrative_validation_by_id: dict[str, Any] = {}
        self._sentiment_by_cache_key: dict[str, str] = {}
        
        # Live streaming tracking
        self._last_live_ingestion_time: str | None = None
        self._live_messages_count: int = 0
        
        # Metrics & Summary state
        self._metrics: PipelineStageMetrics | None = None
        self._topic_result: TopicDiscoveryResult | None = None
        self._enrichment_result: TopicEnrichmentResult | None = None
        self._narrative_report: NarrativeAssessmentReport | None = None
        self._trend_identities: dict[str, tuple[str, str]] = {}

    def load_artifacts(
        self,
        parquet_path: Path | str | None = None,
        analytics_path: Path | str | None = None,
        messages_override: Sequence[CanonicalMessage] | None = None,
        analytics_override: MLPipelineResult | None = None,
    ) -> bool:
        """Load and index canonical messages and precomputed analytics into memory."""
        try:
            # 1. Load Messages
            if messages_override is not None:
                self._messages = list(messages_override)
            else:
                target_parquet = self._resolve_parquet_path(parquet_path)
                if target_parquet and target_parquet.is_file():
                    logger.info("Loading canonical dataset from %s", target_parquet)
                    self._messages = read_canonical_messages(target_parquet)
                else:
                    logger.warning("No Parquet dataset found at %s", target_parquet)
                    self._messages = []

            self._messages_by_id = {m.canonical_id: m for m in self._messages}

            # Load precomputed sentiment cache for instant queries and profile hydration
            self._load_sentiment_cache()

            # 2. Load Precomputed Analytics
            pipeline_result: MLPipelineResult | None = None
            if analytics_override is not None:
                pipeline_result = analytics_override
            else:
                target_analytics = self._resolve_analytics_path(analytics_path)
                if target_analytics and target_analytics.is_file():
                    logger.info("Loading precomputed analytics artifact from %s", target_analytics)
                    with open(target_analytics, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        pipeline_result = MLPipelineResult.model_validate(data)
                else:
                    logger.warning("No precomputed analytics artifact found at %s", target_analytics)

            if pipeline_result:
                self.dataset_source = pipeline_result.dataset_source
                self.created_at_utc = pipeline_result.created_at_utc
                self._metrics = pipeline_result.metrics
                self._topic_result = pipeline_result.topics
                self._enrichment_result = pipeline_result.enriched_topics
                self._narrative_report = pipeline_result.narrative_report

                # Index Topics
                self._topics_by_id = {t.topic_id: t for t in pipeline_result.topics.topic_records}
                for topic in pipeline_result.topics.topic_records:
                    for mid in topic.sample_message_ids:
                        self._message_to_topic[mid] = topic.topic_id

                # Index Enriched Topics
                self._enriched_topics_by_id = {
                    et.topic_id: et for et in pipeline_result.enriched_topics.enriched_topics
                }

                # Milestone 6C/7: Synthesize human-readable narrative identity & explanation
                try:
                    from app.ml.narratives.identity import derive_narrative_identity
                    for n in pipeline_result.narrative_report.narrative_candidates:
                        is_generic = (
                            not n.narrative_name or
                            not n.narrative_summary or
                            "Monitored Discourse" in (n.narrative_name or "") or
                            "insufficient to establish a more specific interpretation" in (n.narrative_summary or "")
                        )
                        if is_generic:
                            t = self._topics_by_id.get(n.promoted_from_topic_id)
                            topic_msgs = []
                            if t:
                                sample_ids = (t.sample_message_ids or []) + (getattr(t, "representative_message_ids", []) or [])
                                topic_msgs = [self._messages_by_id[mid] for mid in sample_ids if mid in self._messages_by_id]
                            name, summary = derive_narrative_identity(n, t, messages=topic_msgs)
                            n.narrative_name = name
                            n.narrative_summary = summary

                    # Populate sibling_narrative_ids if not already populated
                    siblings_by_topic: dict[str, list[str]] = {}
                    for n in pipeline_result.narrative_report.narrative_candidates:
                        siblings_by_topic.setdefault(n.promoted_from_topic_id, []).append(n.narrative_id)
                    for n in pipeline_result.narrative_report.narrative_candidates:
                        if not n.sibling_narrative_ids:
                            n.sibling_narrative_ids = [nid for nid in siblings_by_topic.get(n.promoted_from_topic_id, []) if nid != n.narrative_id]

                    # Populate sentiment profile from cached inference if not already populated
                    if self._sentiment_by_cache_key:
                        import hashlib
                        from app.ml.pipeline.cache import compute_cache_key
                        for n in pipeline_result.narrative_report.narrative_candidates:
                            if not n.sentiment_profile.is_available:
                                t = self._topics_by_id.get(n.promoted_from_topic_id)
                                if t:
                                    sample_ids = (t.sample_message_ids or []) + (getattr(t, "representative_message_ids", []) or [])
                                    t_msgs = [self._messages_by_id[mid] for mid in sample_ids if mid in self._messages_by_id and self._messages_by_id[mid].text_content]
                                    n_pos, n_neu, n_neg = 0, 0, 0
                                    for tm in t_msgs:
                                        text_id = f"text_{hashlib.sha256(tm.text_content.encode('utf-8')).hexdigest()[:16]}"
                                        k = compute_cache_key("sentiment", text_id, tm.text_content, "cardiffnlp/twitter-roberta-base-sentiment-latest", "default", "4h.v1")
                                        lbl = self._sentiment_by_cache_key.get(k)
                                        if lbl == "positive":
                                            n_pos += 1
                                        elif lbl == "neutral":
                                            n_neu += 1
                                        elif lbl == "negative":
                                            n_neg += 1
                                    tot = n_pos + n_neu + n_neg
                                    if tot > 0:
                                        from app.ml.narratives.models import NarrativeSentimentProfile
                                        n.sentiment_profile = NarrativeSentimentProfile(
                                            is_available=True,
                                            total_text_messages_evaluated=tot,
                                            text_positive_ratio=round(n_pos / tot, 4),
                                            text_neutral_ratio=round(n_neu / tot, 4),
                                            text_negative_ratio=round(n_neg / tot, 4),
                                            emoji_polarity_score=n.sentiment_profile.emoji_polarity_score,
                                            sentiment_model_id="cardiffnlp/twitter-roberta-base-sentiment-latest",
                                        )
                except Exception as id_exc:
                    logger.warning("Could not synthesize narrative identity: %s", id_exc)

                # Index Narratives
                self._narratives_by_id = {
                    n.narrative_id: n for n in pipeline_result.narrative_report.narrative_candidates
                }
                self._sorted_narratives = sorted(
                    pipeline_result.narrative_report.narrative_candidates,
                    key=lambda n: n.priority_signal_score,
                    reverse=True,
                )

                # Synthesize human-readable trend identity & explanation
                try:
                    from app.ml.narratives.identity import derive_trend_identity
                    for tid, t in self._topics_by_id.items():
                        et = self._enriched_topics_by_id.get(tid)
                        sample_ids = (t.sample_message_ids or []) + (getattr(t, "representative_message_ids", []) or [])
                        topic_msgs = [self._messages_by_id[mid] for mid in sample_ids if mid in self._messages_by_id]
                        associated = [n for n in self._narratives_by_id.values() if n.promoted_from_topic_id == tid]
                        tr_name, tr_summary = derive_trend_identity(t, et, messages=topic_msgs, associated_narratives=associated)
                        self._trend_identities[tid] = (tr_name, tr_summary)
                except Exception as tr_exc:
                    logger.warning("Could not synthesize trend identity: %s", tr_exc)

                # Milestone 6C: Compute deterministic narrative validation metrics
                try:
                    from app.analytics.narrative_validation import CorpusQualityValidator
                    validator = CorpusQualityValidator()
                    val_report = validator.validate_corpus(self._messages, pipeline_result)
                    self._narrative_validation_by_id = {m.narrative_id: m for m in val_report.narratives}
                except Exception as val_exc:
                    logger.debug("Could not compute narrative validation metrics: %s", val_exc)
                    self._narrative_validation_by_id = {}

                self.artifacts_loaded = True
            else:
                self.artifacts_loaded = (len(self._messages) > 0)

            # Load precomputed sentiment cache for sub-millisecond timeline aggregation
            self._load_sentiment_cache()

            return self.artifacts_loaded
        except Exception as exc:
            logger.error("Failed to load artifacts: %s", exc, exc_info=True)
            self.artifacts_loaded = False
            return False

    def _load_sentiment_cache(self) -> None:
        """Index precomputed SQLite sentiment cache into memory for instant queries."""
        self._sentiment_by_cache_key = {}
        candidates = [
            self.repo_root / "data" / "cache" / "ml_inference_cache.db",
            self.repo_root / "backend" / "data" / "cache" / "ml_inference_cache.db",
        ]
        for db_file in candidates:
            if db_file.is_file():
                try:
                    import sqlite3
                    conn = sqlite3.connect(str(db_file))
                    cur = conn.cursor()
                    cur.execute("SELECT cache_key, label FROM sentiment_cache")
                    self._sentiment_by_cache_key = dict(cur.fetchall())
                    conn.close()
                    logger.debug("Loaded %d sentiment predictions from %s", len(self._sentiment_by_cache_key), db_file)
                    break
                except Exception as err:
                    logger.warning("Could not index sentiment cache from %s: %s", db_file, err)

    def append_message(self, message: CanonicalMessage) -> bool:
        """Thread-safe append of a new canonical message into active in-memory repository indices."""
        cid = message.canonical_id
        if cid in self._messages_by_id:
            return False
        self._messages_by_id[cid] = message
        self._messages.append(message)
        self._live_messages_count += 1
        self._last_live_ingestion_time = message.published_at.isoformat()
        logger.debug("Appended live message %s (total: %d)", cid, len(self._messages))
        return True

    def _resolve_parquet_path(self, override: Path | str | None) -> Path | None:
        if override:
            p = Path(override)
            return p if p.is_absolute() else (self.repo_root / p)
        
        # Standard locations: data/processed/telegram/telegram_messages.parquet or data/processed/telegram_messages.parquet
        proc_dir = self.repo_root / self.settings.data_processed_dir
        candidates = [
            proc_dir / "telegram" / f"{self.settings.active_dataset_name}.parquet",
            proc_dir / f"{self.settings.active_dataset_name}.parquet",
            self.repo_root / "data" / "processed" / "telegram" / "telegram_messages.parquet",
        ]
        for c in candidates:
            if c.is_file():
                return c
        return candidates[0]

    def _resolve_analytics_path(self, override: Path | str | None) -> Path | None:
        if override:
            p = Path(override)
            return p if p.is_absolute() else (self.repo_root / p)

        proc_dir = self.repo_root / self.settings.data_processed_dir
        candidates = [
            proc_dir / "telegram" / f"{self.settings.active_dataset_name}-analytics-artifact.json",
            proc_dir / f"{self.settings.active_dataset_name}-analytics-artifact.json",
            proc_dir / "telegram" / "synthetic-analytics-artifact.json",
            self.repo_root / "data" / "processed" / "telegram" / "telegram-analytics-artifact.json",
        ]
        for c in candidates:
            if c.is_file():
                return c
        return candidates[0]

    # --------------------------------------------------------------------------
    # Health & Overview Queries
    # --------------------------------------------------------------------------

    def get_health_data(self) -> dict:
        return {
            "status": "healthy" if self.artifacts_loaded else "degraded",
            "version": "0.1.0",
            "artifacts_loaded": self.artifacts_loaded,
            "dataset_source": self.dataset_source if self.artifacts_loaded else None,
            "active_records_count": len(self._messages) if self.artifacts_loaded else 0,
            "active_narratives_count": len(self._narratives_by_id) if self.artifacts_loaded else 0,
        }

    def get_analytics_overview(self) -> AnalyticsOverviewData:
        if not self.artifacts_loaded or not self._narrative_report or not self._topic_result:
            raise RuntimeError("Analytics artifact is unavailable.")

        total_msgs = len(self._messages)
        text_bearing = sum(1 for m in self._messages if m.text_content.strip())
        media_only = sum(1 for m in self._messages if m.has_media and not m.text_content.strip())
        
        # Priority distribution from narrative report
        priority_dist = dict(self._narrative_report.candidates_by_tier)
        for tier in ["critical", "high", "elevated", "routine"]:
            if tier not in priority_dist:
                priority_dist[tier] = sum(1 for n in self._narratives_by_id.values() if n.priority_tier.value == tier)

        # Corpus Sentiment Summary: compute actual evaluated message distribution from cache
        if self._sentiment_by_cache_key:
            from collections import Counter
            counts = Counter(self._sentiment_by_cache_key.values())
            total_eval = len(self._sentiment_by_cache_key)
            sentiment_overview = SentimentOverview(
                sentiment_model_id="cardiffnlp/twitter-roberta-base-sentiment-latest",
                evaluated_messages_count=total_eval,
                distribution=SentimentDistribution(
                    positive_ratio=round(counts.get("positive", 0) / total_eval, 4),
                    neutral_ratio=round(counts.get("neutral", 0) / total_eval, 4),
                    negative_ratio=round(counts.get("negative", 0) / total_eval, 4),
                ),
            )
        else:
            total_weighted_msgs = 0
            weighted_pos = 0.0
            weighted_neu = 0.0
            weighted_neg = 0.0
            model_id = None
            for cand in self._narratives_by_id.values():
                sp = cand.sentiment_profile
                if sp.is_available and sp.total_text_messages_evaluated > 0:
                    cnt = sp.total_text_messages_evaluated
                    total_weighted_msgs += cnt
                    model_id = sp.sentiment_model_id or model_id
                    if sp.text_positive_ratio is not None:
                        weighted_pos += sp.text_positive_ratio * cnt
                    if sp.text_neutral_ratio is not None:
                        weighted_neu += sp.text_neutral_ratio * cnt
                    if sp.text_negative_ratio is not None:
                        weighted_neg += sp.text_negative_ratio * cnt

            if total_weighted_msgs > 0:
                sentiment_overview = SentimentOverview(
                    sentiment_model_id=model_id or "cardiffnlp/twitter-roberta-base-sentiment-latest",
                    evaluated_messages_count=total_weighted_msgs,
                    distribution=SentimentDistribution(
                        positive_ratio=round(weighted_pos / total_weighted_msgs, 4),
                        neutral_ratio=round(weighted_neu / total_weighted_msgs, 4),
                        negative_ratio=round(weighted_neg / total_weighted_msgs, 4),
                    ),
                )
            else:
                sentiment_overview = SentimentOverview(
                    sentiment_model_id=None,
                    evaluated_messages_count=0,
                    distribution=SentimentDistribution(
                        positive_ratio=0.0,
                        neutral_ratio=0.0,
                        negative_ratio=0.0,
                    ),
                )

        pipeline_exec = PipelineExecutionSummary(
            created_at_utc=self.created_at_utc,
            total_runtime_seconds=self._metrics.total_runtime_seconds if self._metrics else 0.0,
            cache_hit_rate=self._metrics.cache_hit_rate if self._metrics else 0.0,
        )

        return AnalyticsOverviewData(
            dataset_source=self.dataset_source,
            summary_counts=DatasetSummaryCounts(
                total_messages=total_msgs,
                text_bearing_messages=text_bearing,
                media_only_messages=media_only,
                total_topics=self._topic_result.number_of_topics,
                total_narratives=len(self._narratives_by_id),
                noise_messages=self._topic_result.noise_messages,
            ),
            priority_distribution=priority_dist,
            sentiment_overview=sentiment_overview,
            pipeline_execution=pipeline_exec,
        )

    # --------------------------------------------------------------------------
    # Narrative Queries
    # --------------------------------------------------------------------------

    def get_narratives(
        self,
        page: int = 1,
        page_size: int = 20,
        priority_tier: str | None = None,
        min_priority: float | None = None,
        has_coordination_signal: bool | None = None,
        sort_by: str = "priority_signal_score",
        order: str = "desc",
        query: str | None = None,
    ) -> tuple[list[NarrativeSummaryResponse], PaginationMeta]:
        if not self.artifacts_loaded:
            raise RuntimeError("Analytics artifact is unavailable.")

        filtered = list(self._narratives_by_id.values())

        if query and query.strip():
            q = query.strip().lower()
            clean_q = q.replace("narrative_", "").replace("topic_", "").replace("trend_", "")
            filtered = [
                n for n in filtered
                if q in n.narrative_id.lower()
                or (clean_q and clean_q in n.narrative_id.lower())
                or (getattr(n, "narrative_name", None) and q in n.narrative_name.lower())
                or (getattr(n, "narrative_summary", None) and q in n.narrative_summary.lower())
                or q in n.headline_claim.lower()
                or q in n.promoted_from_topic_id.lower()
                or (n.key_entities and any(q in e.lower() for e in n.key_entities))
            ]

        if priority_tier:
            filtered = [n for n in filtered if n.priority_tier.value.lower() == priority_tier.lower()]
        if min_priority is not None:
            filtered = [n for n in filtered if n.priority_signal_score >= min_priority]
        if has_coordination_signal is not None:
            filtered = [
                n for n in filtered
                if any([
                    n.coordination_signals.potential_syndication_spike,
                    n.coordination_signals.potential_temporal_burst,
                    n.coordination_signals.potential_rapid_channel_entry,
                    n.coordination_signals.potential_cross_channel_cascade,
                ]) == has_coordination_signal
            ]

        # Sorting
        reverse = (order.lower() == "desc")
        if sort_by == "priority_signal_score":
            filtered.sort(key=lambda n: (n.priority_signal_score, n.narrative_id), reverse=reverse)
        elif sort_by == "spread_score":
            filtered.sort(key=lambda n: (n.sub_scores.spread_score, n.narrative_id), reverse=reverse)
        elif sort_by == "coordination_score":
            filtered.sort(key=lambda n: (n.sub_scores.coordination_score, n.narrative_id), reverse=reverse)
        elif sort_by == "reach_score":
            filtered.sort(key=lambda n: (n.sub_scores.reach_score, n.narrative_id), reverse=reverse)
        elif sort_by == "friction_score":
            filtered.sort(key=lambda n: (n.sub_scores.friction_score, n.narrative_id), reverse=reverse)
        elif sort_by == "first_observed_at":
            filtered.sort(key=lambda n: (n.first_observed_at, n.narrative_id), reverse=reverse)
        elif sort_by == "last_observed_at":
            filtered.sort(key=lambda n: (n.last_observed_at, n.narrative_id), reverse=reverse)

        total = len(filtered)
        total_pages = math.ceil(total / page_size) if total > 0 else 0
        start = (page - 1) * page_size
        end = start + page_size
        sliced = filtered[start:end]

        items = []
        for n in sliced:
            val_m = self._narrative_validation_by_id.get(n.narrative_id)
            items.append(
                NarrativeSummaryResponse(
                    narrative_id=n.narrative_id,
                    promoted_from_topic_id=n.promoted_from_topic_id,
                    headline_claim=n.headline_claim,
                    narrative_name=getattr(n, "narrative_name", None),
                    narrative_summary=getattr(n, "narrative_summary", None),
                    priority_signal_score=n.priority_signal_score,
                    priority_tier=n.priority_tier,
                    sub_scores=n.sub_scores,
                    has_coordination_signals=any([
                        n.coordination_signals.potential_syndication_spike,
                        n.coordination_signals.potential_temporal_burst,
                        n.coordination_signals.potential_rapid_channel_entry,
                        n.coordination_signals.potential_cross_channel_cascade,
                    ]),
                    evidence_density=n.data_coverage.evidence_density,
                    message_count=n.data_coverage.message_count,
                    first_observed_at=n.first_observed_at,
                    last_observed_at=n.last_observed_at,
                    distinct_sources_count=val_m.distinct_sources_count if val_m else max(n.data_coverage.channel_count, 1),
                    distinct_domains_count=val_m.distinct_domains_count if val_m else 1,
                    is_cross_source=val_m.is_cross_source if val_m else (n.data_coverage.channel_count >= 2),
                    is_cross_domain=val_m.is_cross_domain if val_m else False,
                    domains_represented=val_m.domains_represented if val_m else [],
                    broadcasting_channels=n.broadcasting_channels or [],
                    quality_classification=val_m.quality_classification.value if val_m else "moderate_evidence",
                    viewpoint_stance=getattr(n, "viewpoint_stance", None),
                    narrative_rank=getattr(n, "narrative_rank", 1),
                    is_dominant=getattr(n, "is_dominant", True),
                    evidence_strength_score=getattr(n, "evidence_strength_score", None),
                    sibling_narrative_ids=getattr(n, "sibling_narrative_ids", []),
                )
            )

        meta = PaginationMeta(
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1 and total_pages > 0,
        )
        return items, meta

    def get_narrative_by_id(self, narrative_id: str) -> Any:
        if not self.artifacts_loaded:
            raise RuntimeError("Analytics artifact is unavailable.")
        cand = self._narratives_by_id.get(narrative_id)
        if cand is None:
            return None
        val_m = self._narrative_validation_by_id.get(narrative_id)
        if val_m:
            from app.schemas.api.narratives import NarrativeDetailData
            return NarrativeDetailData(
                **cand.model_dump(),
                distinct_sources_count=val_m.distinct_sources_count,
                distinct_domains_count=val_m.distinct_domains_count,
                is_cross_source=val_m.is_cross_source,
                is_cross_domain=val_m.is_cross_domain,
                domains_represented=val_m.domains_represented,
                quality_classification=val_m.quality_classification.value,
                validation_notes=val_m.validation_notes,
            )
        return cand

    # --------------------------------------------------------------------------
    # Topic Queries
    # --------------------------------------------------------------------------

    def get_topics(
        self,
        page: int = 1,
        page_size: int = 20,
        min_messages: int | None = None,
        sort_by: str = "message_count",
        order: str = "desc",
    ) -> tuple[list[TopicSummaryResponse], PaginationMeta]:
        if not self.artifacts_loaded:
            raise RuntimeError("Analytics artifact is unavailable.")

        filtered = list(self._topics_by_id.values())

        if min_messages is not None:
            filtered = [t for t in filtered if t.message_count >= min_messages]

        reverse = (order.lower() == "desc")
        if sort_by == "message_count":
            filtered.sort(key=lambda t: (t.message_count, t.topic_id), reverse=reverse)
        elif sort_by == "percentage_of_dataset":
            filtered.sort(key=lambda t: (t.percentage_of_dataset, t.topic_id), reverse=reverse)
        elif sort_by == "topic_id":
            filtered.sort(key=lambda t: t.topic_id, reverse=reverse)

        total = len(filtered)
        total_pages = math.ceil(total / page_size) if total > 0 else 0
        start = (page - 1) * page_size
        end = start + page_size
        sliced = filtered[start:end]

        items = [
            TopicSummaryResponse(
                topic_id=t.topic_id,
                cluster_label=t.cluster_label,
                message_count=t.message_count,
                percentage_of_dataset=t.percentage_of_dataset,
                representative_keywords=[
                    TopicKeywordResponse(keyword=k.keyword, score=k.score)
                    for k in t.representative_keywords
                ],
                trend_name=self._trend_identities.get(t.topic_id, (None, None))[0],
                trend_summary=self._trend_identities.get(t.topic_id, (None, None))[1],
            )
            for t in sliced
        ]

        meta = PaginationMeta(
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1 and total_pages > 0,
        )
        return items, meta

    def get_topic_by_id(self, topic_id: str) -> TopicDetailData | None:
        if not self.artifacts_loaded:
            raise RuntimeError("Analytics artifact is unavailable.")

        topic = self._topics_by_id.get(topic_id)
        if not topic:
            return None

        enriched = self._enriched_topics_by_id.get(topic_id)
        t_ident = self._trend_identities.get(topic.topic_id, (None, None))

        return TopicDetailData(
            topic_id=topic.topic_id,
            cluster_label=topic.cluster_label,
            message_count=topic.message_count,
            percentage_of_dataset=topic.percentage_of_dataset,
            representative_keywords=[
                TopicKeywordResponse(keyword=k.keyword, score=k.score)
                for k in topic.representative_keywords
            ],
            representative_message_ids=topic.representative_message_ids,
            sample_message_ids=topic.sample_message_ids,
            entities=enriched.entities if enriched else [],
            engagement=enriched.engagement if enriched else None,
            propagation=enriched.propagation if enriched else None,
            temporal=enriched.temporal if enriched else None,
            trend_name=t_ident[0],
            trend_summary=t_ident[1],
        )

    # --------------------------------------------------------------------------
    # Trend Queries (Milestone Phase 1: Topics -> Trends Architecture)
    # --------------------------------------------------------------------------

    def _normalize_trend_id(self, identifier: str) -> str:
        ident = identifier.strip()
        if ident.startswith("trend_"):
            return ident
        if ident.startswith("topic_"):
            return ident.replace("topic_", "trend_")
        return f"trend_{ident}"

    def _normalize_topic_id(self, identifier: str) -> str:
        ident = identifier.strip()
        if ident.startswith("topic_"):
            return ident
        if ident.startswith("trend_"):
            return ident.replace("trend_", "topic_")
        return f"topic_{ident}"

    def get_trends(
        self,
        page: int = 1,
        page_size: int = 20,
        min_messages: int | None = None,
        sort_by: str = "message_count",
        order: str = "desc",
    ) -> tuple[list[TrendSummaryResponse], PaginationMeta]:
        """Retrieve paginated collection of Trend clusters mapped from discovered semantic clusters."""
        if not self.artifacts_loaded:
            raise RuntimeError("Analytics artifact is unavailable.")

        filtered = list(self._topics_by_id.values())

        if min_messages is not None:
            filtered = [t for t in filtered if t.message_count >= min_messages]

        reverse = (order.lower() == "desc")
        if sort_by == "message_count":
            filtered.sort(key=lambda t: (t.message_count, t.topic_id), reverse=reverse)
        elif sort_by == "percentage_of_dataset":
            filtered.sort(key=lambda t: (t.percentage_of_dataset, t.topic_id), reverse=reverse)
        elif sort_by in ("trend_id", "topic_id"):
            filtered.sort(key=lambda t: t.topic_id, reverse=reverse)

        total = len(filtered)
        total_pages = math.ceil(total / page_size) if total > 0 else 0
        start = (page - 1) * page_size
        end = start + page_size
        sliced = filtered[start:end]

        items = []
        for t in sliced:
            top_kws = [k.keyword for k in t.representative_keywords[:3]]
            label = ", ".join(top_kws) if top_kws else f"Trend Cluster {t.cluster_label}"
            associated_narratives = [
                cand.narrative_id
                for cand in self._narratives_by_id.values()
                if cand.promoted_from_topic_id == t.topic_id
            ]
            t_ident = self._trend_identities.get(t.topic_id, (None, None))
            items.append(
                TrendSummaryResponse(
                    trend_id=self._normalize_trend_id(t.topic_id),
                    topic_id=t.topic_id,
                    cluster_label=t.cluster_label,
                    label=label,
                    message_count=t.message_count,
                    percentage_of_dataset=t.percentage_of_dataset,
                    representative_keywords=[
                        TrendKeywordResponse(keyword=k.keyword, score=k.score)
                        for k in t.representative_keywords
                    ],
                    associated_narrative_ids=associated_narratives,
                    trend_name=t_ident[0],
                    trend_summary=t_ident[1],
                )
            )

        meta = PaginationMeta(
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1 and total_pages > 0,
        )
        return items, meta

    def get_trend_by_id(self, identifier: str) -> TrendDetailData | None:
        """Retrieve deep analytical intelligence for a single Trend cluster."""
        if not self.artifacts_loaded:
            raise RuntimeError("Analytics artifact is unavailable.")

        topic_id = self._normalize_topic_id(identifier)
        trend_id = self._normalize_trend_id(identifier)

        topic = self._topics_by_id.get(topic_id)
        if not topic:
            return None

        enriched = self._enriched_topics_by_id.get(topic_id)

        # Collect source channels participating in this trend
        cluster_messages = [
            self._messages_by_id[mid]
            for mid in topic.sample_message_ids
            if mid in self._messages_by_id
        ]
        channel_stats: dict[str, dict[str, Any]] = {}
        for m in cluster_messages:
            aid = m.author_id
            if aid not in channel_stats:
                channel_stats[aid] = {
                    "channel_title": m.channel_title,
                    "author_username": m.author_username,
                    "message_count": 0,
                    "total_views": 0,
                }
            channel_stats[aid]["message_count"] += 1
            channel_stats[aid]["total_views"] += (m.views_count or 0)

        channels = [
            TrendChannelSummary(
                channel_id=aid,
                channel_title=cinfo["channel_title"],
                author_username=cinfo["author_username"],
                message_count=cinfo["message_count"],
                total_views=cinfo["total_views"],
            )
            for aid, cinfo in sorted(channel_stats.items(), key=lambda x: x[1]["message_count"], reverse=True)
        ]

        associated_narratives = [
            cand.narrative_id
            for cand in self._narratives_by_id.values()
            if cand.promoted_from_topic_id == topic.topic_id
        ]

        top_kws = [k.keyword for k in topic.representative_keywords[:3]]
        label = ", ".join(top_kws) if top_kws else f"Trend Cluster {topic.cluster_label}"
        t_ident = self._trend_identities.get(topic.topic_id, (None, None))

        return TrendDetailData(
            trend_id=trend_id,
            topic_id=topic.topic_id,
            cluster_label=topic.cluster_label,
            label=label,
            message_count=topic.message_count,
            percentage_of_dataset=topic.percentage_of_dataset,
            representative_keywords=[
                TrendKeywordResponse(keyword=k.keyword, score=k.score)
                for k in topic.representative_keywords
            ],
            representative_message_ids=topic.representative_message_ids,
            sample_message_ids=topic.sample_message_ids,
            entities=enriched.entities if enriched else [],
            engagement=enriched.engagement if enriched else None,
            propagation=enriched.propagation if enriched else None,
            temporal=enriched.temporal if enriched else None,
            channels=channels,
            associated_narrative_ids=associated_narratives,
            trend_name=t_ident[0],
            trend_summary=t_ident[1],
        )

    def get_trend_graph(self, identifier: str) -> TrendGraphData | None:
        """Construct deterministic converging node graph translating authentic source & entity flow into the trend."""
        if not self.artifacts_loaded:
            raise RuntimeError("Analytics artifact is unavailable.")

        topic_id = self._normalize_topic_id(identifier)
        trend_id = self._normalize_trend_id(identifier)

        topic = self._topics_by_id.get(topic_id)
        if not topic:
            return None

        enriched = self._enriched_topics_by_id.get(topic_id)
        t_ident = self._trend_identities.get(topic_id, (None, None))
        top_kws = [k.keyword for k in topic.representative_keywords[:3]]
        trend_label = t_ident[0] or (f"Trend: {', '.join(top_kws)}" if top_kws else f"Trend {topic.cluster_label}")

        nodes: list[GraphNode] = []
        edges: list[GraphEdge] = []
        seen_node_ids: set[str] = set()

        # 1. Central Trend Node
        trend_node_id = f"trend:{trend_id}"
        nodes.append(
            GraphNode(
                id=trend_node_id,
                type="trend",
                label=trend_label,
                metadata={
                    "trend_id": trend_id,
                    "trend_name": t_ident[0],
                    "trend_summary": t_ident[1],
                    "topic_id": topic.topic_id,
                    "cluster_label": topic.cluster_label,
                    "message_count": topic.message_count,
                    "percentage_of_dataset": topic.percentage_of_dataset,
                    "keywords": [k.keyword for k in topic.representative_keywords],
                },
            )
        )
        seen_node_ids.add(trend_node_id)

        # 2. Channel Nodes (Sources contributing messages)
        cluster_messages = [
            self._messages_by_id[mid]
            for mid in topic.sample_message_ids
            if mid in self._messages_by_id
        ]

        channel_stats: dict[str, dict[str, Any]] = {}
        for m in cluster_messages:
            aid = m.author_id
            if aid not in channel_stats:
                channel_stats[aid] = {
                    "channel_title": m.channel_title or m.author_username or aid,
                    "author_username": m.author_username,
                    "message_count": 0,
                    "views_count": 0,
                }
            channel_stats[aid]["message_count"] += 1
            channel_stats[aid]["views_count"] += (m.views_count or 0)

        for aid, cinfo in channel_stats.items():
            cnode_id = f"channel:{aid}"
            if cnode_id not in seen_node_ids:
                nodes.append(
                    GraphNode(
                        id=cnode_id,
                        type="channel",
                        label=cinfo["channel_title"],
                        metadata={
                            "author_id": aid,
                            "author_username": cinfo["author_username"],
                            "messages_in_trend": cinfo["message_count"],
                            "total_views": cinfo["views_count"],
                        },
                    )
                )
                seen_node_ids.add(cnode_id)

            edges.append(
                GraphEdge(
                    id=f"edge:{cnode_id}->{trend_node_id}",
                    source=cnode_id,
                    target=trend_node_id,
                    relationship_type="observed_in",
                    label="observed in",
                    metadata={
                        "messages_contributed": cinfo["message_count"],
                        "views_contributed": cinfo["views_count"],
                    },
                )
            )

        # 3. Entity Nodes (Domains, Hashtags, Entities cited in cluster)
        if enriched and enriched.entities:
            for ent in enriched.entities[:8]:
                cat = ent.category.value if hasattr(ent.category, "value") else str(ent.category)
                enode_id = f"entity:{cat}:{ent.text}"
                if enode_id not in seen_node_ids:
                    nodes.append(
                        GraphNode(
                            id=enode_id,
                            type="entity",
                            label=ent.text,
                            metadata={
                                "category": cat,
                                "frequency": ent.frequency,
                            },
                        )
                    )
                    seen_node_ids.add(enode_id)

                edges.append(
                    GraphEdge(
                        id=f"edge:{enode_id}->{trend_node_id}",
                        source=enode_id,
                        target=trend_node_id,
                        relationship_type="cited_in",
                        label="cited in",
                        metadata={"frequency": ent.frequency},
                    )
                )

        # 4. Narrative Nodes (Formalized Narrative Candidates promoted from this Trend)
        for cand in self._narratives_by_id.values():
            if cand.promoted_from_topic_id == topic.topic_id:
                nnode_id = f"narrative:{cand.narrative_id}"
                tier_str = cand.priority_tier.value if hasattr(cand.priority_tier, "value") else str(cand.priority_tier)
                if nnode_id not in seen_node_ids:
                    nodes.append(
                        GraphNode(
                            id=nnode_id,
                            type="narrative",
                            label=cand.narrative_name or cand.headline_claim,
                            metadata={
                                "narrative_id": cand.narrative_id,
                                "narrative_name": cand.narrative_name,
                                "narrative_summary": cand.narrative_summary,
                                "priority_signal_score": cand.priority_signal_score,
                                "priority_tier": tier_str,
                            },
                        )
                    )
                    seen_node_ids.add(nnode_id)

                edges.append(
                    GraphEdge(
                        id=f"edge:{trend_node_id}->{nnode_id}",
                        source=trend_node_id,
                        target=nnode_id,
                        relationship_type="promoted_to",
                        label="promoted to narrative",
                        metadata={
                            "priority_signal_score": cand.priority_signal_score,
                            "priority_tier": tier_str,
                        },
                    )
                )

        # 5. Representative focal evidence messages (top 2 closest to centroid)
        for mid in topic.representative_message_ids[:2]:
            msg = self._messages_by_id.get(mid)
            if msg:
                mnode_id = f"message:{msg.canonical_id}"
                if mnode_id not in seen_node_ids:
                    preview = (msg.text_content[:45] + "...") if len(msg.text_content) > 45 else msg.text_content
                    nodes.append(
                        GraphNode(
                            id=mnode_id,
                            type="message",
                            label=preview or msg.canonical_id,
                            metadata={
                                "canonical_id": msg.canonical_id,
                                "published_at": msg.published_at.isoformat(),
                                "views_count": msg.views_count,
                            },
                        )
                    )
                    seen_node_ids.add(mnode_id)

                edges.append(
                    GraphEdge(
                        id=f"edge:{mnode_id}->{trend_node_id}",
                        source=mnode_id,
                        target=trend_node_id,
                        relationship_type="contributes_evidence",
                        label="contributes evidence",
                        metadata={"published_at": msg.published_at.isoformat()},
                    )
                )

        return TrendGraphData(
            trend_id=trend_id,
            nodes=nodes,
            edges=edges,
            node_count=len(nodes),
            edge_count=len(edges),
        )

    def _compute_sentiment_time_series(
        self,
        messages: list[CanonicalMessage],
        default_model_id: str = "cardiffnlp/twitter-roberta-base-sentiment-latest",
        override_bucket_size: str | None = None,
    ) -> tuple[list[SentimentBucket], SentimentSummary, str]:
        """Aggregate chronological message sentiment into continuous UTC time buckets."""
        if not messages:
            summary = SentimentSummary(
                total_messages=0,
                evaluated_messages=0,
                unassigned_messages=0,
                positive_ratio=None,
                neutral_ratio=None,
                negative_ratio=None,
                sentiment_model_id=default_model_id,
            )
            return [], summary, override_bucket_size or "1h"

        sorted_msgs = sorted(messages, key=lambda m: m.published_at)
        t_min = sorted_msgs[0].published_at
        t_max = sorted_msgs[-1].published_at
        span_seconds = (t_max - t_min).total_seconds()

        if override_bucket_size == "1h":
            bucket_sec = 3600
            bucket_size_str = "1h"
        elif override_bucket_size == "4h":
            bucket_sec = 4 * 3600
            bucket_size_str = "4h"
        elif override_bucket_size == "6h":
            bucket_sec = 6 * 3600
            bucket_size_str = "6h"
        elif override_bucket_size == "1d":
            bucket_sec = 86400
            bucket_size_str = "1d"
        elif span_seconds <= 48 * 3600:
            bucket_sec = 3600
            bucket_size_str = "1h"
        elif span_seconds <= 14 * 86400:
            bucket_sec = 4 * 3600
            bucket_size_str = "4h"
        else:
            bucket_sec = 86400
            bucket_size_str = "1d"

        start_ts = int(t_min.timestamp()) // bucket_sec * bucket_sec
        end_ts = (int(t_max.timestamp()) // bucket_sec + 1) * bucket_sec

        buckets_data: dict[int, dict[str, int]] = {}
        curr = start_ts
        while curr < end_ts:
            buckets_data[curr] = {"positive": 0, "neutral": 0, "negative": 0, "unassigned": 0}
            curr += bucket_sec

        total_pos = 0
        total_neu = 0
        total_neg = 0
        total_unassigned = 0

        from app.ml.pipeline.cache import compute_cache_key
        for m in sorted_msgs:
            b_key = int(m.published_at.timestamp()) // bucket_sec * bucket_sec
            if b_key not in buckets_data:
                buckets_data[b_key] = {"positive": 0, "neutral": 0, "negative": 0, "unassigned": 0}

            label = None
            if m.text_content and m.text_content.strip():
                t = m.text_content
                iid = f"text_{hashlib.sha256(t.encode('utf-8')).hexdigest()[:16]}"
                k = compute_cache_key("sentiment", iid, t, default_model_id)
                label = self._sentiment_by_cache_key.get(k)

            if label == "positive":
                buckets_data[b_key]["positive"] += 1
                total_pos += 1
            elif label == "neutral":
                buckets_data[b_key]["neutral"] += 1
                total_neu += 1
            elif label == "negative":
                buckets_data[b_key]["negative"] += 1
                total_neg += 1
            else:
                buckets_data[b_key]["unassigned"] += 1
                total_unassigned += 1

        time_series: list[SentimentBucket] = []
        for b_ts in sorted(buckets_data.keys()):
            b_info = buckets_data[b_ts]
            b_start = datetime.fromtimestamp(b_ts, tz=timezone.utc).isoformat()
            b_end = datetime.fromtimestamp(b_ts + bucket_sec, tz=timezone.utc).isoformat()
            b_total = sum(b_info.values())
            b_eval = b_info["positive"] + b_info["neutral"] + b_info["negative"]
            net_score = (
                round((b_info["positive"] - b_info["negative"]) / b_eval, 4)
                if b_eval > 0
                else None
            )
            time_series.append(
                SentimentBucket(
                    bucket_start_utc=b_start,
                    bucket_end_utc=b_end,
                    positive=b_info["positive"],
                    neutral=b_info["neutral"],
                    negative=b_info["negative"],
                    unassigned=b_info["unassigned"],
                    total=b_total,
                    net_sentiment=net_score,
                )
            )

        total_msgs = len(sorted_msgs)
        evaluated = total_pos + total_neu + total_neg
        summary = SentimentSummary(
            total_messages=total_msgs,
            evaluated_messages=evaluated,
            unassigned_messages=total_unassigned,
            positive_ratio=round(total_pos / evaluated, 4) if evaluated > 0 else None,
            neutral_ratio=round(total_neu / evaluated, 4) if evaluated > 0 else None,
            negative_ratio=round(total_neg / evaluated, 4) if evaluated > 0 else None,
            sentiment_model_id=default_model_id,
        )

        return time_series, summary, bucket_size_str

    def get_trend_sentiment(self, identifier: str) -> TrendSentimentData | None:
        """Compute chronological sentiment time-series for a Trend cluster."""
        if not self.artifacts_loaded:
            raise RuntimeError("Analytics artifact is unavailable.")

        topic_id = self._normalize_topic_id(identifier)
        trend_id = self._normalize_trend_id(identifier)

        topic = self._topics_by_id.get(topic_id)
        if not topic:
            return None

        cluster_messages = [
            self._messages_by_id[mid]
            for mid in topic.sample_message_ids
            if mid in self._messages_by_id
        ]

        time_series, summary, bucket_size = self._compute_sentiment_time_series(cluster_messages)

        return TrendSentimentData(
            trend_id=trend_id,
            topic_id=topic.topic_id,
            bucket_size=bucket_size,
            time_series=time_series,
            summary=summary,
        )

    def get_narrative_sentiment(
        self, narrative_id: str, bucket_size: str | None = None
    ) -> NarrativeSentimentData | None:
        """Compute chronological sentiment time-series for a Narrative candidate."""
        if not self.artifacts_loaded:
            raise RuntimeError("Analytics artifact is unavailable.")

        candidate = self._narratives_by_id.get(narrative_id)
        if not candidate:
            return None

        promoted_topic_id = candidate.promoted_from_topic_id
        topic = self._topics_by_id.get(promoted_topic_id)
        cluster_messages: list[CanonicalMessage] = []
        if topic:
            cluster_messages = [
                self._messages_by_id[mid]
                for mid in topic.sample_message_ids
                if mid in self._messages_by_id
            ]

        time_series, computed_summary, resolved_bucket_size = self._compute_sentiment_time_series(
            cluster_messages, override_bucket_size=bucket_size
        )

        # Preserve narrative's precomputed frozen sentiment profile
        sp = candidate.sentiment_profile
        if sp and sp.is_available:
            tot = max(candidate.data_coverage.message_count, sp.total_text_messages_evaluated)
            ev = sp.total_text_messages_evaluated
            summary = SentimentSummary(
                total_messages=tot,
                evaluated_messages=ev,
                unassigned_messages=max(0, tot - ev),
                positive_ratio=sp.text_positive_ratio,
                neutral_ratio=sp.text_neutral_ratio,
                negative_ratio=sp.text_negative_ratio,
                sentiment_model_id=sp.sentiment_model_id,
            )
        else:
            summary = computed_summary

        return NarrativeSentimentData(
            narrative_id=narrative_id,
            promoted_from_trend_id=self._normalize_trend_id(promoted_topic_id),
            bucket_size=resolved_bucket_size,
            time_series=time_series,
            summary=summary,
        )


    def get_messages(
        self,
        page: int = 1,
        page_size: int = 20,
        platform: str | None = None,
        channel_id: str | None = None,
        topic_id: str | None = None,
        has_media: bool | None = None,
        is_forward: bool | None = None,
        language: str | None = None,
        sort_by: str = "published_at",
        order: str = "desc",
    ) -> tuple[list[MessageSummaryResponse], PaginationMeta]:
        if not self.artifacts_loaded:
            raise RuntimeError("Message dataset is unavailable.")

        filtered = list(self._messages)

        if platform:
            filtered = [m for m in filtered if m.platform.value.lower() == platform.lower()]
        if channel_id:
            filtered = [m for m in filtered if m.author_id.lower() == channel_id.lower()]
        if topic_id:
            topic = self._topics_by_id.get(topic_id)
            if topic:
                allowed_ids = set(topic.sample_message_ids)
                filtered = [m for m in filtered if m.canonical_id in allowed_ids]
            else:
                filtered = []
        if has_media is not None:
            filtered = [m for m in filtered if m.has_media == has_media]
        if is_forward is not None:
            filtered = [m for m in filtered if m.is_forward == is_forward]
        if language:
            filtered = [m for m in filtered if m.language and m.language.lower() == language.lower()]

        reverse = (order.lower() == "desc")
        if sort_by == "published_at":
            filtered.sort(key=lambda m: (m.published_at, m.canonical_id), reverse=reverse)
        elif sort_by == "views_count":
            filtered.sort(key=lambda m: (m.views_count or 0, m.canonical_id), reverse=reverse)
        elif sort_by == "forwards_count":
            filtered.sort(key=lambda m: (m.forwards_count or 0, m.canonical_id), reverse=reverse)

        total = len(filtered)
        total_pages = math.ceil(total / page_size) if total > 0 else 0
        start = (page - 1) * page_size
        end = start + page_size
        sliced = filtered[start:end]

        items = [
            MessageSummaryResponse(
                canonical_id=m.canonical_id,
                platform=m.platform,
                native_id=m.native_id,
                author_id=m.author_id,
                channel_title=m.channel_title,
                published_at=m.published_at,
                text_content=m.text_content,
                language=m.language,
                views_count=m.views_count,
                forwards_count=m.forwards_count,
                has_media=m.has_media,
                is_forward=m.is_forward,
            )
            for m in sliced
        ]

        meta = PaginationMeta(
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1 and total_pages > 0,
        )
        return items, meta

    def get_message_by_id(self, message_id: str) -> MessageDetailData | None:
        if not self.artifacts_loaded:
            raise RuntimeError("Message dataset is unavailable.")

        decoded_id = urllib.parse.unquote(message_id).strip()
        msg = self._messages_by_id.get(decoded_id)
        if not msg:
            return None

        assigned_topic = self._message_to_topic.get(decoded_id)
        msg_dict = msg.model_dump()
        msg_dict["assigned_topic_id"] = assigned_topic
        return MessageDetailData.model_validate(msg_dict)

    # --------------------------------------------------------------------------
    # Pipeline Metadata Queries
    # --------------------------------------------------------------------------

    def get_pipeline_status(self) -> PipelineStatusResponse:
        if not self.artifacts_loaded:
            raise RuntimeError("Pipeline metadata is unavailable.")

        cache_status = None
        if self._metrics:
            cache_status = CacheStatus(
                enabled=True,
                hit_rate=self._metrics.cache_hit_rate,
            )

        collection_mode = None
        last_collection_run = None
        last_successful_collection = None
        source_count = None
        successful_source_count = None
        failed_source_count = None
        last_new_record_count = None
        cumulative_record_count = len(self._messages) if self._messages else None
        corpus_snapshot_id = None
        analytics_generated_at = self.created_at_utc or None

        # Dynamically load latest incremental collection metadata if present
        latest_manifest_path = (
            self.repo_root / "data" / "manifests" / "telegram" / "incremental" / "latest_manifest.json"
        )
        if latest_manifest_path.is_file():
            try:
                with open(latest_manifest_path, "r", encoding="utf-8") as f:
                    manifest_data = json.load(f)
                collection_mode = manifest_data.get("mode", "incremental")
                last_collection_run = manifest_data.get("completed_at_utc")
                if manifest_data.get("sources_succeeded", 0) > 0:
                    last_successful_collection = manifest_data.get("completed_at_utc")
                source_count = manifest_data.get("sources_attempted")
                successful_source_count = manifest_data.get("sources_succeeded")
                failed_source_count = manifest_data.get("sources_failed")
                last_new_record_count = manifest_data.get("total_new_canonical_persisted")
                if manifest_data.get("cumulative_corpus_count"):
                    cumulative_record_count = max(len(self._messages), int(manifest_data.get("cumulative_corpus_count") or 0))
                corpus_snapshot_id = manifest_data.get("corpus_snapshot_id")
            except Exception as e:
                logger.warning("Failed reading incremental manifest for pipeline status: %s", e)

        # Check for corpus expansion manifests (Milestone 6B)
        corpus_manifests = sorted(
            (self.repo_root / "data" / "manifests" / "telegram").glob("manifest_telegram_*.json"),
            key=lambda p: p.name,
            reverse=True,
        )
        if corpus_manifests:
            try:
                with open(corpus_manifests[0], "r", encoding="utf-8") as f:
                    c_data = json.load(f)
                c_gen = c_data.get("generated_at_utc")
                # If corpus manifest is newer or incremental has lower count
                if not last_collection_run or (c_gen and c_gen > last_collection_run):
                    collection_mode = "corpus"
                    last_collection_run = c_gen
                    last_successful_collection = c_gen
                    corpus_snapshot_id = c_data.get("manifest_id")
                    source_count = c_data.get("sources_attempted")
                    successful_source_count = c_data.get("sources_successful")
                    failed_source_count = c_data.get("sources_failed")
                    if c_data.get("total_final_records"):
                        cumulative_record_count = c_data.get("total_final_records")
            except Exception as e:
                logger.warning("Failed reading corpus manifest for pipeline status: %s", e)

        if self._messages and not cumulative_record_count:
            cumulative_record_count = len(self._messages)

        # Reflect live real-time ingestion in pipeline collection provenance
        if self._last_live_ingestion_time:
            last_collection_run = self._last_live_ingestion_time
            last_successful_collection = self._last_live_ingestion_time
            collection_mode = "realtime_streaming"
            if self._live_messages_count > 0:
                last_new_record_count = (last_new_record_count or 0) + self._live_messages_count
            cumulative_record_count = max(cumulative_record_count or 0, len(self._messages))

        # Milestone 6E: Stale Analytics Detection
        analytics_current = True
        stale_analytics_reason = None
        if cumulative_record_count and self._metrics:
            records_analyzed = getattr(self._metrics, "records_ingested", len(self._messages))
            if cumulative_record_count > records_analyzed:
                analytics_current = False
                stale_analytics_reason = (
                    f"Corpus has {cumulative_record_count} messages, but loaded analytics "
                    f"reflect earlier snapshot with {records_analyzed} messages."
                )

        # Milestone 6E: Temporal Lineage Metrics
        active_lineages_count = None
        last_temporal_update = None
        lineage_state_path = self.repo_root / "data" / "temporal" / "lineage" / "lineage_state.json"
        if lineage_state_path.is_file():
            try:
                with open(lineage_state_path, "r", encoding="utf-8") as f:
                    lin_state = json.load(f)
                last_temporal_update = lin_state.get("updated_at_utc")
                lineages = lin_state.get("lineages", {})
                active_lineages_count = sum(
                    1 for l in lineages.values() if l.get("state") not in ["disappeared"]
                )
            except Exception as e:
                logger.warning("Failed reading temporal lineage state for pipeline status: %s", e)

        return PipelineStatusResponse(
            status="completed",
            dataset_source=self.dataset_source,
            created_at_utc=self.created_at_utc,
            pipeline_version=self.pipeline_version,
            cache_status=cache_status,
            collection_mode=collection_mode,
            last_collection_run=last_collection_run,
            last_successful_collection=last_successful_collection,
            source_count=source_count,
            successful_source_count=successful_source_count,
            failed_source_count=failed_source_count,
            last_new_record_count=last_new_record_count,
            cumulative_record_count=cumulative_record_count,
            corpus_snapshot_id=corpus_snapshot_id,
            analytics_generated_at=analytics_generated_at,
            analytics_current=analytics_current,
            stale_analytics_reason=stale_analytics_reason,
            active_lineages_count=active_lineages_count,
            last_temporal_update=last_temporal_update,
        )

    def get_pipeline_metrics(self) -> PipelineMetricsResponse:
        if not self.artifacts_loaded or not self._metrics:
            raise RuntimeError("Pipeline stage metrics are unavailable.")

        m = self._metrics
        return PipelineMetricsResponse(
            stage_latencies_seconds=StageLatencies(
                language_detection=m.language_detection_seconds,
                normalization=m.normalization_seconds,
                sentiment_load=m.sentiment_load_seconds,
                sentiment_inference=m.sentiment_inference_seconds,
                embedding_load=m.embedding_load_seconds,
                embedding_inference=m.embedding_inference_seconds,
                topic_discovery=m.topic_discovery_seconds,
                feature_enrichment=m.feature_enrichment_seconds,
                narrative_assessment=m.narrative_assessment_seconds,
                total_runtime=m.total_runtime_seconds,
            ),
            execution_breakdown=ExecutionBreakdown(
                cold_start_time_seconds=m.cold_start_time_seconds,
                warm_inference_time_seconds=m.warm_inference_time_seconds,
            ),
            throughput_samples_per_sec=ThroughputSamples(
                sentiment=m.sentiment_throughput_samples_per_sec,
                embedding=m.embedding_throughput_samples_per_sec,
            ),
            record_accounting=RecordAccounting(
                records_ingested=m.records_ingested,
                records_processed=m.records_processed,
                records_skipped=m.records_skipped,
                records_failed=m.records_failed,
            ),
            cache_performance=CachePerformance(
                cache_hits=m.cache_hits,
                cache_misses=m.cache_misses,
                cache_hit_rate=m.cache_hit_rate,
            ),
            memory_footprint_mb=MemoryFootprint(
                peak_process_rss_mb=m.peak_rss_mb,
                peak_python_heap_mb=m.peak_python_heap_mb,
            ),
        )


_shared_repository: ArtifactRepository | None = None


def get_artifact_repository() -> ArtifactRepository:
    """Retrieve the singleton ArtifactRepository instance."""
    global _shared_repository
    if _shared_repository is None:
        _shared_repository = ArtifactRepository()
    return _shared_repository
