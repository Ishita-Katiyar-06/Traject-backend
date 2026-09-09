from datetime import datetime, timezone
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.api.deps import (
    get_artifact_repository,
    require_authenticated_user,
    require_ntro_analyst,
)
from app.main import create_app
from app.schemas.auth import AuthenticatedUser, UserRole
from app.ml.features.models import (
    EnrichedTopicCandidate,
    SocialEntityCategory,
    TopicEngagementFeatures,
    TopicEnrichmentResult,
    TopicEntity,
    TopicPropagationFeatures,
    TopicTemporalFeatures,
)
from app.ml.narratives.models import (
    EvidenceDensityTier,
    NarrativeAssessmentReport,
    NarrativeCandidate,
    NarrativeDataCoverage,
    NarrativeSentimentProfile,
    NarrativeSubScores,
    PotentialCoordinationSignals,
    PriorityTier,
)
from app.ml.pipeline.metrics import PipelineStageMetrics
from app.ml.pipeline.orchestrator import MLPipelineResult
from app.ml.topics.models import (
    ClusteringConfig,
    TopicDiscoveryResult,
    TopicKeyword,
    TopicRecord,
)
from app.repositories.artifact_repository import ArtifactRepository
from app.schemas import CanonicalMessage

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "features" / "synthetic_enrichment_fixture.jsonl"


def load_synthetic_messages() -> list[CanonicalMessage]:
    messages: list[CanonicalMessage] = []
    with open(FIXTURE_PATH, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                messages.append(CanonicalMessage.model_validate_json(line))
    return messages


def create_synthetic_pipeline_result() -> MLPipelineResult:
    """Create deterministic precomputed MLPipelineResult matching synthetic fixture without network calls."""
    dt_first = datetime(2026, 9, 2, 12, 0, tzinfo=timezone.utc)
    dt_last = datetime(2026, 9, 2, 18, 30, tzinfo=timezone.utc)

    # 1. Topics (Milestone 4E)
    topic_records = [
        TopicRecord(
            topic_id="topic_000",
            cluster_label=0,
            message_count=6,
            percentage_of_dataset=37.5,
            representative_keywords=[
                TopicKeyword(keyword="fuel", score=1.0),
                TopicKeyword(keyword="prices", score=0.95),
                TopicKeyword(keyword="petrol", score=0.82),
            ],
            representative_message_ids=["telegram:chanA:101", "telegram:chanB:201"],
            sample_message_ids=[
                "telegram:chanA:101",
                "telegram:chanB:201",
                "telegram:chanC:301",
                "telegram:chanD:401",
                "telegram:chanB:202",
                "telegram:chanC:302",
            ],
        ),
        TopicRecord(
            topic_id="topic_001",
            cluster_label=1,
            message_count=5,
            percentage_of_dataset=31.25,
            representative_keywords=[
                TopicKeyword(keyword="border", score=1.0),
                TopicKeyword(keyword="security", score=0.88),
                TopicKeyword(keyword="patrol", score=0.75),
            ],
            representative_message_ids=["telegram:chanA:102", "telegram:chanD:402"],
            sample_message_ids=[
                "telegram:chanA:102",
                "telegram:chanD:402",
                "telegram:chanA:103",
                "telegram:chanB:203",
                "telegram:user99:999",
            ],
        ),
        TopicRecord(
            topic_id="topic_002",
            cluster_label=2,
            message_count=5,
            percentage_of_dataset=31.25,
            representative_keywords=[
                TopicKeyword(keyword="football", score=1.0),
                TopicKeyword(keyword="united", score=0.90),
                TopicKeyword(keyword="manchester", score=0.85),
            ],
            representative_message_ids=["telegram:chanC:303", "telegram:chanD:403"],
            sample_message_ids=[
                "telegram:chanC:303",
                "telegram:chanD:403",
                "telegram:chanA:104",
                "telegram:chanB:204",
                "telegram:chanC:304",
            ],
        ),
    ]

    topics = TopicDiscoveryResult(
        model_id="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
        embedding_dimension=384,
        total_input_messages=16,
        clustered_messages=16,
        noise_messages=0,
        number_of_topics=3,
        topic_records=topic_records,
        noise_message_ids=[],
        clustering_config=ClusteringConfig(min_cluster_size=2),
    )

    # 2. Enriched Topics (Milestone 4F)
    enriched_topics_list = [
        EnrichedTopicCandidate(
            topic_id="topic_000",
            message_count=6,
            percentage_of_dataset=37.5,
            representative_keywords=["fuel", "prices", "petrol"],
            entities=[
                TopicEntity(text="oil", category=SocialEntityCategory.HASHTAG, frequency=4, sample_message_ids=["telegram:chan1:101"])
            ],
            engagement=TopicEngagementFeatures(
                total_views=15400,
                total_forwards=320,
                total_replies=45,
                total_reactions=612,
                forward_to_view_ratio=0.0208,
                reply_to_view_ratio=0.0029,
                reaction_to_view_ratio=0.0397,
                emoji_polarity_score=-0.12,
                peak_views_message_id="telegram:chan1:101",
            ),
            propagation=TopicPropagationFeatures(
                observed_forward_count=2,
                direct_forward_ratio=0.3333,
                unique_origin_channels=["chan_root"],
                unique_amplifying_channels=["chan1", "chan2"],
                cross_channel_observed_spread=2,
                uncredited_syndication_count=1,
            ),
            temporal=TopicTemporalFeatures(
                first_published_at=dt_first,
                last_published_at=dt_last,
                timespan_seconds=23400.0,
                messages_per_hour=0.92,
                peak_window_utc="2026-09-02T12:00",
                peak_window_message_count=3,
                burstiness_index=0.15,
                channel_entry_velocity=0.31,
            ),
        ),
        EnrichedTopicCandidate(
            topic_id="topic_001",
            message_count=5,
            percentage_of_dataset=31.25,
            representative_keywords=["border", "security", "patrol"],
            entities=[
                TopicEntity(text="borderpatrol", category=SocialEntityCategory.HASHTAG, frequency=5, sample_message_ids=["telegram:chan1:102"])
            ],
            engagement=TopicEngagementFeatures(
                total_views=18500,
                total_forwards=410,
                total_replies=60,
                total_reactions=850,
                forward_to_view_ratio=0.0222,
                reply_to_view_ratio=0.0032,
                reaction_to_view_ratio=0.0459,
                emoji_polarity_score=0.25,
                peak_views_message_id="telegram:chan1:102",
            ),
            propagation=TopicPropagationFeatures(
                observed_forward_count=3,
                direct_forward_ratio=0.60,
                unique_origin_channels=["chan_origin"],
                unique_amplifying_channels=["chan1", "chan2", "chan3"],
                cross_channel_observed_spread=3,
                uncredited_syndication_count=0,
            ),
            temporal=TopicTemporalFeatures(
                first_published_at=dt_first,
                last_published_at=dt_last,
                timespan_seconds=23400.0,
                messages_per_hour=0.77,
                peak_window_utc="2026-09-02T14:00",
                peak_window_message_count=2,
                burstiness_index=0.28,
                channel_entry_velocity=0.46,
            ),
        ),
        EnrichedTopicCandidate(
            topic_id="topic_002",
            message_count=5,
            percentage_of_dataset=31.25,
            representative_keywords=["football", "united", "manchester"],
            entities=[
                TopicEntity(text="mufc", category=SocialEntityCategory.HASHTAG, frequency=3, sample_message_ids=["telegram:chan1:103"])
            ],
            engagement=TopicEngagementFeatures(
                total_views=9200,
                total_forwards=110,
                total_replies=25,
                total_reactions=340,
                forward_to_view_ratio=0.0120,
                reply_to_view_ratio=0.0027,
                reaction_to_view_ratio=0.0370,
                emoji_polarity_score=0.40,
                peak_views_message_id="telegram:chan1:103",
            ),
            propagation=TopicPropagationFeatures(
                observed_forward_count=1,
                direct_forward_ratio=0.20,
                unique_origin_channels=["chan_sports"],
                unique_amplifying_channels=["chan1"],
                cross_channel_observed_spread=1,
                uncredited_syndication_count=0,
            ),
            temporal=TopicTemporalFeatures(
                first_published_at=dt_first,
                last_published_at=dt_last,
                timespan_seconds=23400.0,
                messages_per_hour=0.77,
                peak_window_utc="2026-09-02T16:00",
                peak_window_message_count=2,
                burstiness_index=-0.05,
                channel_entry_velocity=0.15,
            ),
        ),
    ]

    enriched_topics = TopicEnrichmentResult(
        dataset_source="synthetic_enrichment_fixture.jsonl",
        total_messages_analyzed=16,
        total_topics_enriched=3,
        enriched_topics=enriched_topics_list,
        unassigned_noise_count=0,
    )

    # 3. Narratives (Milestone 4G)
    narrative_candidates = [
        NarrativeCandidate(
            narrative_id="narrative_000",
            promoted_from_topic_id="topic_001",
            headline_claim="[#borderpatrol] border, security, patrol",
            priority_signal_score=0.4914,
            priority_tier=PriorityTier.ELEVATED,
            sub_scores=NarrativeSubScores(
                spread_score=0.4500,
                coordination_score=0.5200,
                reach_score=0.4800,
                friction_score=0.5400,
            ),
            coordination_signals=PotentialCoordinationSignals(
                potential_syndication_spike=False,
                potential_temporal_burst=True,
                potential_rapid_channel_entry=False,
                potential_cross_channel_cascade=True,
            ),
            data_coverage=NarrativeDataCoverage(
                message_count=5,
                channel_count=3,
                timespan_seconds=23400.0,
                has_views_coverage=True,
                has_reactions_coverage=True,
                evidence_density=EvidenceDensityTier.HIGH,
                data_quality_notes=[],
            ),
            sentiment_profile=NarrativeSentimentProfile(
                is_available=True,
                total_text_messages_evaluated=5,
                text_positive_ratio=0.20,
                text_neutral_ratio=0.60,
                text_negative_ratio=0.20,
                emoji_polarity_score=0.25,
                sentiment_model_id="cardiffnlp/twitter-roberta-base-sentiment-latest",
            ),
            key_entities=["hashtag:borderpatrol"],
            broadcasting_channels=["chan1", "chan2", "chan3"],
            origin_channels=["chan_origin"],
            representative_message_excerpts=["Border security patrol report."],
            first_observed_at=dt_first,
            last_observed_at=dt_last,
            audit_rationale=["Priority/Narrative Signal Score: 0.4914 (ELEVATED)."],
        ),
        NarrativeCandidate(
            narrative_id="narrative_001",
            promoted_from_topic_id="topic_000",
            headline_claim="[#oil] fuel, prices, petrol",
            priority_signal_score=0.4378,
            priority_tier=PriorityTier.ELEVATED,
            sub_scores=NarrativeSubScores(
                spread_score=0.4100,
                coordination_score=0.4600,
                reach_score=0.4400,
                friction_score=0.4800,
            ),
            coordination_signals=PotentialCoordinationSignals(
                potential_syndication_spike=True,
                potential_temporal_burst=False,
                potential_rapid_channel_entry=False,
                potential_cross_channel_cascade=True,
            ),
            data_coverage=NarrativeDataCoverage(
                message_count=6,
                channel_count=3,
                timespan_seconds=23400.0,
                has_views_coverage=True,
                has_reactions_coverage=True,
                evidence_density=EvidenceDensityTier.HIGH,
                data_quality_notes=[],
            ),
            sentiment_profile=NarrativeSentimentProfile(
                is_available=True,
                total_text_messages_evaluated=6,
                text_positive_ratio=0.10,
                text_neutral_ratio=0.70,
                text_negative_ratio=0.20,
                emoji_polarity_score=-0.12,
                sentiment_model_id="cardiffnlp/twitter-roberta-base-sentiment-latest",
            ),
            key_entities=["hashtag:oil"],
            broadcasting_channels=["chan1", "chan2"],
            origin_channels=["chan_root"],
            representative_message_excerpts=["Fuel prices update."],
            first_observed_at=dt_first,
            last_observed_at=dt_last,
            audit_rationale=["Priority/Narrative Signal Score: 0.4378 (ELEVATED)."],
        ),
        NarrativeCandidate(
            narrative_id="narrative_002",
            promoted_from_topic_id="topic_002",
            headline_claim="[#mufc] football, united, manchester",
            priority_signal_score=0.1440,
            priority_tier=PriorityTier.ROUTINE,
            sub_scores=NarrativeSubScores(
                spread_score=0.1200,
                coordination_score=0.1500,
                reach_score=0.1600,
                friction_score=0.1500,
            ),
            coordination_signals=PotentialCoordinationSignals(
                potential_syndication_spike=False,
                potential_temporal_burst=False,
                potential_rapid_channel_entry=False,
                potential_cross_channel_cascade=False,
            ),
            data_coverage=NarrativeDataCoverage(
                message_count=5,
                channel_count=2,
                timespan_seconds=23400.0,
                has_views_coverage=True,
                has_reactions_coverage=True,
                evidence_density=EvidenceDensityTier.HIGH,
                data_quality_notes=[],
            ),
            sentiment_profile=NarrativeSentimentProfile(
                is_available=True,
                total_text_messages_evaluated=5,
                text_positive_ratio=0.40,
                text_neutral_ratio=0.50,
                text_negative_ratio=0.10,
                emoji_polarity_score=0.40,
                sentiment_model_id="cardiffnlp/twitter-roberta-base-sentiment-latest",
            ),
            key_entities=["hashtag:mufc"],
            broadcasting_channels=["chan1"],
            origin_channels=["chan_sports"],
            representative_message_excerpts=["Football match highlights."],
            first_observed_at=dt_first,
            last_observed_at=dt_last,
            audit_rationale=["Priority/Narrative Signal Score: 0.1440 (ROUTINE)."],
        ),
    ]

    narrative_report = NarrativeAssessmentReport(
        dataset_source="synthetic_enrichment_fixture.jsonl",
        total_messages_analyzed=16,
        total_narrative_candidates=3,
        candidates_by_tier={"critical": 0, "high": 0, "elevated": 2, "routine": 1},
        narrative_candidates=narrative_candidates,
        unassigned_noise_count=0,
    )

    metrics = PipelineStageMetrics(
        language_detection_seconds=0.0421,
        normalization_seconds=0.0180,
        sentiment_load_seconds=1.1320,
        sentiment_inference_seconds=0.0031,
        embedding_load_seconds=3.3510,
        embedding_inference_seconds=0.0012,
        topic_discovery_seconds=0.0542,
        feature_enrichment_seconds=0.0812,
        narrative_assessment_seconds=0.0210,
        total_runtime_seconds=4.7038,
        cold_start_time_seconds=4.4830,
        warm_inference_time_seconds=0.2208,
        sentiment_throughput_samples_per_sec=17.6,
        embedding_throughput_samples_per_sec=143.2,
        records_ingested=16,
        records_processed=16,
        records_skipped=0,
        records_failed=0,
        cache_hits=43,
        cache_misses=0,
        cache_hit_rate=1.0,
        peak_rss_mb=1104.2,
        peak_python_heap_mb=0.32,
    )

    return MLPipelineResult(
        dataset_source="synthetic_enrichment_fixture.jsonl",
        created_at_utc="2026-09-05T08:00:00Z",
        metrics=metrics,
        topics=topics,
        enriched_topics=enriched_topics,
        narrative_report=narrative_report,
    )


@pytest.fixture(scope="session")
def session_pipeline_result():
    return create_synthetic_pipeline_result()


@pytest.fixture(scope="session")
def populated_repository(session_pipeline_result):
    messages = load_synthetic_messages()
    repo = ArtifactRepository()
    repo.load_artifacts(
        messages_override=messages,
        analytics_override=session_pipeline_result,
    )
    return repo


@pytest.fixture
def client(populated_repository):
    app = create_app()
    mock_ntro_user = AuthenticatedUser(
        user_id="test-ntro-analyst-uuid",
        email="analyst@ntro.gov.in",
        role=UserRole.NTRO_ANALYST,
    )
    app.dependency_overrides[get_artifact_repository] = lambda: populated_repository
    app.dependency_overrides[require_ntro_analyst] = lambda: mock_ntro_user
    app.dependency_overrides[require_authenticated_user] = lambda: mock_ntro_user
    with TestClient(app) as test_client:
        yield test_client
