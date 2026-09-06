"""Focused tests for TRAJECT Milestone 6C Narrative Quality and Cross-Source Validation."""

from datetime import datetime, timezone
import pytest

from app.analytics.narrative_validation import (
    CorpusNarrativeValidationReport,
    CorpusQualityValidator,
    CrossSourceOverlapReport,
    NarrativeQualityClassification,
    NarrativeQualityMetrics,
)
from app.collectors.telegram.registry import TelegramSourceEntry, TelegramSourceRegistry, SourceType
from app.ml.narratives.models import (
    EvidenceDensityTier,
    NarrativeCandidate,
    NarrativeDataCoverage,
    NarrativeSentimentProfile,
    NarrativeSubScores,
    PotentialCoordinationSignals,
    PriorityTier,
)
from app.ml.pipeline.orchestrator import MLPipelineResult
from app.ml.topics.models import ClusteringConfig, TopicDiscoveryResult, TopicKeyword, TopicRecord
from app.ml.features.models import TopicEnrichmentResult
from app.ml.narratives.models import NarrativeAssessmentReport
from app.schemas.api.narratives import NarrativeDetailData, NarrativeDetailResponse, NarrativeSummaryResponse
from app.schemas.canonical_message import CanonicalMessage


@pytest.fixture
def sample_registry() -> TelegramSourceRegistry:
    return TelegramSourceRegistry(
        version="1.0.0",
        sources=[
            TelegramSourceEntry(
                username="@osint_news",
                domain="conflict",
                expected_language="en",
                source_type=SourceType.INDEPENDENT,
            ),
            TelegramSourceEntry(
                username="@global_wire",
                domain="general_news",
                expected_language="en",
                source_type=SourceType.PUBLISHER,
            ),
            TelegramSourceEntry(
                username="@cyber_alert",
                domain="cybersecurity",
                expected_language="en",
                source_type=SourceType.INDEPENDENT,
            ),
        ],
    )


@pytest.fixture
def sample_candidate() -> NarrativeCandidate:
    return NarrativeCandidate(
        narrative_id="narrative_001",
        promoted_from_topic_id="topic_001",
        headline_claim="[Security] ransomware targeting municipal utilities",
        priority_signal_score=0.4500,
        priority_tier=PriorityTier.ELEVATED,
        sub_scores=NarrativeSubScores(
            spread_score=0.60,
            coordination_score=0.30,
            reach_score=0.45,
            friction_score=0.45,
        ),
        coordination_signals=PotentialCoordinationSignals(
            potential_syndication_spike=False,
            potential_temporal_burst=True,
            potential_rapid_channel_entry=False,
            potential_cross_channel_cascade=True,
        ),
        data_coverage=NarrativeDataCoverage(
            message_count=6,
            channel_count=2,
            timespan_seconds=7200.0,
            has_views_coverage=True,
            has_reactions_coverage=True,
            evidence_density=EvidenceDensityTier.HIGH,
        ),
        sentiment_profile=NarrativeSentimentProfile(
            is_available=True,
            total_text_messages_evaluated=6,
            text_positive_ratio=0.1,
            text_neutral_ratio=0.5,
            text_negative_ratio=0.4,
            emoji_polarity_score=-0.2,
            sentiment_model_id="test-sentiment",
        ),
        key_entities=["Security", "utilities"],
        broadcasting_channels=["osint_news", "cyber_alert"],
        origin_channels=["osint_news"],
        representative_message_excerpts=["Ransomware incident confirmed at power plant."],
        first_observed_at=datetime(2026, 9, 1, 10, 0, 0, tzinfo=timezone.utc),
        last_observed_at=datetime(2026, 9, 1, 12, 0, 0, tzinfo=timezone.utc),
        audit_rationale=["Multi-channel propagation observed."],
    )


@pytest.fixture
def sample_messages() -> list[CanonicalMessage]:
    return [
        CanonicalMessage(
            canonical_id="telegram:101:1",
            platform="telegram",
            native_id="1",
            author_id="101",
            author_username="osint_news",
            channel_title="OSINT News",
            published_at=datetime(2026, 9, 1, 10, 0, 0, tzinfo=timezone.utc),
            collected_at=datetime(2026, 9, 1, 10, 5, 0, tzinfo=timezone.utc),
            text_content="Ransomware incident confirmed at municipal water station.",
            language="en",
        ),
        CanonicalMessage(
            canonical_id="telegram:202:2",
            platform="telegram",
            native_id="2",
            author_id="202",
            author_username="cyber_alert",
            channel_title="Cyber Alert Feed",
            published_at=datetime(2026, 9, 1, 11, 0, 0, tzinfo=timezone.utc),
            collected_at=datetime(2026, 9, 1, 11, 5, 0, tzinfo=timezone.utc),
            text_content="Threat actor deployed LockBit against regional utilities.",
            language="en",
        ),
        CanonicalMessage(
            canonical_id="telegram:101:3",
            platform="telegram",
            native_id="3",
            author_id="101",
            author_username="osint_news",
            channel_title="OSINT News",
            published_at=datetime(2026, 9, 1, 12, 0, 0, tzinfo=timezone.utc),
            collected_at=datetime(2026, 9, 1, 12, 5, 0, tzinfo=timezone.utc),
            text_content="Authorities investigating cyber intrusion in municipal infrastructure.",
            language="en",
        ),
    ]


def test_classify_evidence_quality_rules(sample_registry: TelegramSourceRegistry) -> None:
    validator = CorpusQualityValidator(registry=sample_registry)

    # Strong: >= 5 msgs, >= 2 sources
    strong_tier, notes_s = validator.classify_evidence_quality(
        message_count=6, distinct_sources_count=2, text_bearing_count=6, time_span_seconds=7200
    )
    assert strong_tier == NarrativeQualityClassification.STRONG_EVIDENCE
    assert any("Strong multi-source" in n for n in notes_s)

    # Moderate: >= 3 msgs
    mod_tier, notes_m = validator.classify_evidence_quality(
        message_count=3, distinct_sources_count=1, text_bearing_count=3, time_span_seconds=100
    )
    assert mod_tier == NarrativeQualityClassification.MODERATE_EVIDENCE

    # Limited: exactly 2 msgs, 1 source
    lim_tier, notes_l = validator.classify_evidence_quality(
        message_count=2, distinct_sources_count=1, text_bearing_count=2, time_span_seconds=0
    )
    assert lim_tier == NarrativeQualityClassification.LIMITED_EVIDENCE

    # Insufficient: 0 text or < 2 msgs
    insuf_tier, notes_i = validator.classify_evidence_quality(
        message_count=1, distinct_sources_count=1, text_bearing_count=0, time_span_seconds=0
    )
    assert insuf_tier == NarrativeQualityClassification.INSUFFICIENT_EVIDENCE


def test_evaluate_narrative_metrics(
    sample_registry: TelegramSourceRegistry,
    sample_candidate: NarrativeCandidate,
    sample_messages: list[CanonicalMessage],
) -> None:
    validator = CorpusQualityValidator(registry=sample_registry)
    metrics = validator.evaluate_narrative(
        candidate=sample_candidate,
        messages_in_cluster=sample_messages,
        topic_keywords=["ransomware", "security", "utilities"],
    )

    assert metrics.narrative_id == "narrative_001"
    assert metrics.topic_id == "topic_001"
    assert metrics.message_count == 3
    assert metrics.distinct_sources_count == 2
    assert metrics.is_cross_source is True
    assert metrics.distinct_domains_count == 2  # conflict and cybersecurity
    assert metrics.is_cross_domain is True
    assert "conflict" in metrics.domains_represented
    assert "cybersecurity" in metrics.domains_represented
    assert metrics.priority_signal_score == 0.4500
    assert metrics.priority_tier == "elevated"
    assert metrics.time_span_seconds == 7200.0
    assert metrics.quality_classification in {
        NarrativeQualityClassification.STRONG_EVIDENCE,
        NarrativeQualityClassification.MODERATE_EVIDENCE,
    }


def test_validate_corpus_end_to_end(
    sample_registry: TelegramSourceRegistry,
    sample_candidate: NarrativeCandidate,
    sample_messages: list[CanonicalMessage],
) -> None:
    validator = CorpusQualityValidator(registry=sample_registry)

    # Mock MLPipelineResult
    topic = TopicRecord(
        topic_id="topic_001",
        cluster_label=0,
        message_count=3,
        percentage_of_dataset=100.0,
        representative_keywords=[TopicKeyword(keyword="ransomware", score=1.0)],
        representative_message_ids=["telegram:101:1"],
        sample_message_ids=[m.canonical_id for m in sample_messages],
    )
    topic_res = TopicDiscoveryResult(
        model_id="test-embedder",
        embedding_dimension=384,
        total_input_messages=3,
        clustered_messages=3,
        noise_messages=0,
        number_of_topics=1,
        topic_records=[topic],
        clustering_config=ClusteringConfig(),
    )
    enrichment_res = TopicEnrichmentResult(
        dataset_source="synthetic",
        total_messages_analyzed=3,
        total_topics_enriched=1,
        unassigned_noise_count=0,
        enriched_topics=[],
    )
    narrative_rep = NarrativeAssessmentReport(
        dataset_source="synthetic",
        total_messages_analyzed=3,
        total_narrative_candidates=1,
        candidates_by_tier={"elevated": 1},
        narrative_candidates=[sample_candidate],
        unassigned_noise_count=0,
    )
    from app.ml.pipeline.metrics import PipelineStageMetrics
    ml_result = MLPipelineResult(
        dataset_source="synthetic",
        created_at_utc="2026-09-05T08:00:00Z",
        metrics=PipelineStageMetrics(),
        topics=topic_res,
        enriched_topics=enrichment_res,
        narrative_report=narrative_rep,
    )

    report = validator.validate_corpus(messages=sample_messages, ml_result=ml_result)

    assert isinstance(report, CorpusNarrativeValidationReport)
    assert report.total_messages_analyzed == 3
    assert report.total_topics_discovered == 1
    assert report.total_narratives_promoted == 1
    assert report.topic_to_narrative_ratio == 1.0  # Strict 1:1 Promotion
    assert report.overlap_analysis.multi_source_narratives == 1
    assert report.overlap_analysis.multi_domain_narratives == 1
    assert len(report.top_narratives_by_priority) == 1
    assert report.top_narratives_by_priority[0].narrative_id == "narrative_001"


def test_api_schema_backward_compatibility(sample_candidate: NarrativeCandidate) -> None:
    # 1. Old-style initialization of NarrativeSummaryResponse without new fields
    old_summary = NarrativeSummaryResponse(
        narrative_id="narrative_000",
        promoted_from_topic_id="topic_000",
        headline_claim="Old headline claim",
        priority_signal_score=0.3000,
        priority_tier=PriorityTier.ROUTINE,
        sub_scores=sample_candidate.sub_scores,
        has_coordination_signals=False,
        evidence_density=EvidenceDensityTier.MODERATE,
        message_count=4,
        first_observed_at=datetime.now(timezone.utc),
        last_observed_at=datetime.now(timezone.utc),
    )
    # Check default values are correctly populated
    assert old_summary.distinct_sources_count == 1
    assert old_summary.distinct_domains_count == 1
    assert old_summary.is_cross_source is False
    assert old_summary.is_cross_domain is False
    assert old_summary.quality_classification == "moderate_evidence"

    # 2. Extended initialization with Milestone 6C validation fields
    new_summary = NarrativeSummaryResponse(
        narrative_id="narrative_001",
        promoted_from_topic_id="topic_001",
        headline_claim="New headline claim",
        priority_signal_score=0.4200,
        priority_tier=PriorityTier.ELEVATED,
        sub_scores=sample_candidate.sub_scores,
        has_coordination_signals=True,
        evidence_density=EvidenceDensityTier.HIGH,
        message_count=12,
        first_observed_at=datetime.now(timezone.utc),
        last_observed_at=datetime.now(timezone.utc),
        distinct_sources_count=3,
        distinct_domains_count=2,
        is_cross_source=True,
        is_cross_domain=True,
        domains_represented=["conflict", "geopolitics"],
        quality_classification="strong_evidence",
    )
    assert new_summary.distinct_sources_count == 3
    assert new_summary.is_cross_source is True
    assert new_summary.is_cross_domain is True
    assert new_summary.quality_classification == "strong_evidence"

    # 3. NarrativeDetailData subclassing compatibility
    detail = NarrativeDetailData(
        **sample_candidate.model_dump(),
        distinct_sources_count=2,
        distinct_domains_count=2,
        is_cross_source=True,
        is_cross_domain=True,
        domains_represented=["conflict", "cybersecurity"],
        quality_classification="strong_evidence",
        validation_notes=["Test validation note"],
    )
    assert isinstance(detail, NarrativeCandidate)
    assert detail.distinct_sources_count == 2
    assert detail.validation_notes == ["Test validation note"]

    # Wrap in NarrativeDetailResponse
    res = NarrativeDetailResponse(data=detail)
    assert res.data.narrative_id == "narrative_001"


def test_source_and_domain_pair_overlaps(sample_registry: TelegramSourceRegistry) -> None:
    validator = CorpusQualityValidator(registry=sample_registry)

    # Candidate 1: sources osint_news (conflict) and cyber_alert (cybersecurity)
    c1 = NarrativeCandidate(
        narrative_id="narrative_001",
        promoted_from_topic_id="topic_001",
        headline_claim="Claim 1",
        priority_signal_score=0.40,
        priority_tier=PriorityTier.ELEVATED,
        sub_scores=NarrativeSubScores(spread_score=0.5, coordination_score=0.2, reach_score=0.4, friction_score=0.3),
        coordination_signals=PotentialCoordinationSignals(potential_syndication_spike=False, potential_temporal_burst=False, potential_rapid_channel_entry=False, potential_cross_channel_cascade=False),
        data_coverage=NarrativeDataCoverage(message_count=4, channel_count=2, timespan_seconds=100.0, has_views_coverage=True, has_reactions_coverage=True, evidence_density=EvidenceDensityTier.MODERATE),
        sentiment_profile=NarrativeSentimentProfile(is_available=False, total_text_messages_evaluated=0, emoji_polarity_score=0.0),
        broadcasting_channels=["osint_news", "cyber_alert"],
        first_observed_at=datetime.now(timezone.utc),
        last_observed_at=datetime.now(timezone.utc),
    )
    # Candidate 2: sources osint_news (conflict) and global_wire (general_news)
    c2 = NarrativeCandidate(
        narrative_id="narrative_002",
        promoted_from_topic_id="topic_002",
        headline_claim="Claim 2",
        priority_signal_score=0.30,
        priority_tier=PriorityTier.ROUTINE,
        sub_scores=NarrativeSubScores(spread_score=0.3, coordination_score=0.1, reach_score=0.3, friction_score=0.2),
        coordination_signals=PotentialCoordinationSignals(potential_syndication_spike=False, potential_temporal_burst=False, potential_rapid_channel_entry=False, potential_cross_channel_cascade=False),
        data_coverage=NarrativeDataCoverage(message_count=2, channel_count=2, timespan_seconds=50.0, has_views_coverage=True, has_reactions_coverage=True, evidence_density=EvidenceDensityTier.MODERATE),
        sentiment_profile=NarrativeSentimentProfile(is_available=False, total_text_messages_evaluated=0, emoji_polarity_score=0.0),
        broadcasting_channels=["osint_news", "global_wire"],
        first_observed_at=datetime.now(timezone.utc),
        last_observed_at=datetime.now(timezone.utc),
    )

    t1 = TopicRecord(topic_id="topic_001", cluster_label=0, message_count=4, percentage_of_dataset=66.7, representative_keywords=[], sample_message_ids=[])
    t2 = TopicRecord(topic_id="topic_002", cluster_label=1, message_count=2, percentage_of_dataset=33.3, representative_keywords=[], sample_message_ids=[])
    topic_res = TopicDiscoveryResult(model_id="m", embedding_dimension=384, total_input_messages=6, clustered_messages=6, noise_messages=0, number_of_topics=2, topic_records=[t1, t2], clustering_config=ClusteringConfig())
    enrichment_res = TopicEnrichmentResult(dataset_source="test", total_messages_analyzed=6, total_topics_enriched=2, unassigned_noise_count=0, enriched_topics=[])
    narrative_rep = NarrativeAssessmentReport(dataset_source="test", total_messages_analyzed=6, total_narrative_candidates=2, candidates_by_tier={"elevated": 1, "routine": 1}, narrative_candidates=[c1, c2], unassigned_noise_count=0)
    
    from app.ml.pipeline.metrics import PipelineStageMetrics
    ml_result = MLPipelineResult(dataset_source="test", metrics=PipelineStageMetrics(), topics=topic_res, enriched_topics=enrichment_res, narrative_report=narrative_rep)

    report = validator.validate_corpus(messages=[], ml_result=ml_result)
    assert report.overlap_analysis.multi_source_narratives == 2
    assert report.overlap_analysis.multi_domain_narratives == 2
    assert "cyber_alert <-> osint_news" in report.overlap_analysis.source_pair_overlaps or "osint_news <-> cyber_alert" in report.overlap_analysis.source_pair_overlaps
    assert "conflict <-> cybersecurity" in report.overlap_analysis.domain_pair_overlaps
    assert "conflict <-> general_news" in report.overlap_analysis.domain_pair_overlaps


def test_weak_noisy_narrative_classification(sample_registry: TelegramSourceRegistry) -> None:
    validator = CorpusQualityValidator(registry=sample_registry)

    # Single-source, 2 messages: limited evidence
    tier_l, notes_l = validator.classify_evidence_quality(
        message_count=2, distinct_sources_count=1, text_bearing_count=2, time_span_seconds=0.0
    )
    assert tier_l == NarrativeQualityClassification.LIMITED_EVIDENCE
    assert any("Limited evidence" in n for n in notes_l)

    # Media-only / empty text: insufficient evidence
    tier_i, notes_i = validator.classify_evidence_quality(
        message_count=2, distinct_sources_count=1, text_bearing_count=0, time_span_seconds=0.0
    )
    assert tier_i == NarrativeQualityClassification.INSUFFICIENT_EVIDENCE


def test_api_client_narratives_endpoints_with_validation(
    sample_registry: TelegramSourceRegistry,
    sample_candidate: NarrativeCandidate,
    sample_messages: list[CanonicalMessage],
) -> None:
    from fastapi.testclient import TestClient
    from app.main import create_app
    from app.repositories.artifact_repository import ArtifactRepository
    from app.api.deps import get_artifact_repository
    from app.ml.pipeline.metrics import PipelineStageMetrics

    topic = TopicRecord(
        topic_id="topic_001",
        cluster_label=0,
        message_count=3,
        percentage_of_dataset=100.0,
        representative_keywords=[TopicKeyword(keyword="ransomware", score=1.0)],
        sample_message_ids=[m.canonical_id for m in sample_messages],
    )
    topic_res = TopicDiscoveryResult(model_id="m", embedding_dimension=384, total_input_messages=3, clustered_messages=3, noise_messages=0, number_of_topics=1, topic_records=[topic], clustering_config=ClusteringConfig())
    enrichment_res = TopicEnrichmentResult(dataset_source="test", total_messages_analyzed=3, total_topics_enriched=1, unassigned_noise_count=0, enriched_topics=[])
    narrative_rep = NarrativeAssessmentReport(dataset_source="test", total_messages_analyzed=3, total_narrative_candidates=1, candidates_by_tier={"elevated": 1}, narrative_candidates=[sample_candidate], unassigned_noise_count=0)
    ml_result = MLPipelineResult(dataset_source="test", metrics=PipelineStageMetrics(), topics=topic_res, enriched_topics=enrichment_res, narrative_report=narrative_rep)

    repo = ArtifactRepository()
    repo.load_artifacts(messages_override=sample_messages, analytics_override=ml_result)

    app = create_app()
    app.dependency_overrides[get_artifact_repository] = lambda: repo

    client = TestClient(app)

    # 1. GET /api/v1/narratives
    res_list = client.get("/api/v1/narratives")
    assert res_list.status_code == 200
    data = res_list.json()
    assert len(data["data"]) == 1
    n0 = data["data"][0]
    assert n0["narrative_id"] == "narrative_001"
    assert n0["distinct_sources_count"] >= 1
    assert "quality_classification" in n0
    assert "is_cross_source" in n0
    assert "is_cross_domain" in n0

    # 2. GET /api/v1/narratives/{id}
    res_detail = client.get(f"/api/v1/narratives/{sample_candidate.narrative_id}")
    assert res_detail.status_code == 200
    d_data = res_detail.json()["data"]
    assert d_data["narrative_id"] == "narrative_001"
    assert "quality_classification" in d_data
    assert "validation_notes" in d_data
    assert isinstance(d_data["validation_notes"], list)

