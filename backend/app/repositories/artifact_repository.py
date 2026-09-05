import json
import logging
import math
from pathlib import Path
from typing import Sequence
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
from app.schemas.api.narratives import NarrativeSummaryResponse
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
        
        # Metrics & Summary state
        self._metrics: PipelineStageMetrics | None = None
        self._topic_result: TopicDiscoveryResult | None = None
        self._enrichment_result: TopicEnrichmentResult | None = None
        self._narrative_report: NarrativeAssessmentReport | None = None

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

                # Index Narratives
                self._narratives_by_id = {
                    n.narrative_id: n for n in pipeline_result.narrative_report.narrative_candidates
                }
                self._sorted_narratives = sorted(
                    pipeline_result.narrative_report.narrative_candidates,
                    key=lambda n: n.priority_signal_score,
                    reverse=True,
                )
                self.artifacts_loaded = True
            else:
                self.artifacts_loaded = (len(self._messages) > 0)

            return self.artifacts_loaded
        except Exception as exc:
            logger.error("Failed to load artifacts: %s", exc, exc_info=True)
            self.artifacts_loaded = False
            return False

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

        # Sentiment summary across narrative candidates
        eval_count = 0
        sum_pos = 0.0
        sum_neu = 0.0
        sum_neg = 0.0
        model_id = None
        for cand in self._narratives_by_id.values():
            sp = cand.sentiment_profile
            if sp.is_available:
                eval_count += sp.total_text_messages_evaluated
                model_id = sp.sentiment_model_id
                if sp.text_positive_ratio is not None:
                    sum_pos += sp.text_positive_ratio
                if sp.text_neutral_ratio is not None:
                    sum_neu += sp.text_neutral_ratio
                if sp.text_negative_ratio is not None:
                    sum_neg += sp.text_negative_ratio

        n_cands = max(len(self._narratives_by_id), 1)
        sentiment_overview = SentimentOverview(
            sentiment_model_id=model_id,
            evaluated_messages_count=eval_count if eval_count > 0 else text_bearing,
            distribution=SentimentDistribution(
                positive_ratio=round(sum_pos / n_cands, 4),
                neutral_ratio=round(sum_neu / n_cands, 4),
                negative_ratio=round(sum_neg / n_cands, 4),
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
    ) -> tuple[list[NarrativeSummaryResponse], PaginationMeta]:
        if not self.artifacts_loaded:
            raise RuntimeError("Analytics artifact is unavailable.")

        filtered = list(self._narratives_by_id.values())

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

        items = [
            NarrativeSummaryResponse(
                narrative_id=n.narrative_id,
                promoted_from_topic_id=n.promoted_from_topic_id,
                headline_claim=n.headline_claim,
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
            )
            for n in sliced
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

    def get_narrative_by_id(self, narrative_id: str) -> NarrativeCandidate | None:
        if not self.artifacts_loaded:
            raise RuntimeError("Analytics artifact is unavailable.")
        return self._narratives_by_id.get(narrative_id)

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
        )

    # --------------------------------------------------------------------------
    # Message Queries
    # --------------------------------------------------------------------------

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

        return PipelineStatusResponse(
            status="completed",
            dataset_source=self.dataset_source,
            created_at_utc=self.created_at_utc,
            pipeline_version=self.pipeline_version,
            cache_status=cache_status,
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
