import json
from datetime import datetime, timezone
from pathlib import Path
import pytest

from app.collectors.telegram.corpus_builder import (
    CorpusManifest,
    SourceDistributionRow,
    TelegramCorpusBuilder,
    TelegramCorpusConfig,
)
from app.collectors.telegram.registry import (
    SourceType,
    TelegramSourceEntry,
    TelegramSourceRegistry,
)
from app.ml.narratives.models import (
    EvidenceDensityTier,
    NarrativeAssessmentReport,
    NarrativeCandidate,
    NarrativeDataCoverage,
    NarrativeSubScores,
    PotentialCoordinationSignals,
    PriorityTier,
)
from app.ml.pipeline.metrics import PipelineStageMetrics
from app.ml.pipeline.orchestrator import MLPipelineResult
from app.ml.topics.models import ClusteringConfig, TopicDiscoveryResult, TopicRecord
from app.ml.features.models import TopicEnrichmentResult
from app.quality.validation import QualityReport
from app.schemas.canonical_message import AuthorType, CanonicalMessage, Platform
from app.storage.parquet import read_canonical_messages, write_canonical_messages


# ==============================================================================
# 1. Corpus Configuration Tests
# ==============================================================================

def test_corpus_config_defaults_and_file_loading(tmp_path):
    """1. Test that TelegramCorpusConfig loads from file or returns safe defaults."""
    # Default fallback
    cfg = TelegramCorpusConfig.from_file_or_default(tmp_path / "non_existent.json")
    assert cfg.per_source_limit == 500
    assert cfg.max_sources == 13
    assert cfg.dataset_name == "telegram_messages"

    # Custom valid file
    custom_json = {
        "version": "1.0.0",
        "per_source_limit": 250,
        "max_sources": 5,
        "dataset_name": "test_corpus",
    }
    cfg_file = tmp_path / "telegram_collection.json"
    cfg_file.write_text(json.dumps(custom_json), encoding="utf-8")

    loaded_cfg = TelegramCorpusConfig.from_file_or_default(cfg_file)
    assert loaded_cfg.per_source_limit == 250
    assert loaded_cfg.max_sources == 5
    assert loaded_cfg.dataset_name == "test_corpus"


def test_corpus_config_invalid_limit_fallback(tmp_path):
    """2. Test that negative or zero limits fall back safely to defaults."""
    bad_json = {"per_source_limit": -10}
    cfg_file = tmp_path / "bad_config.json"
    cfg_file.write_text(json.dumps(bad_json), encoding="utf-8")

    cfg = TelegramCorpusConfig.from_file_or_default(cfg_file)
    assert cfg.per_source_limit == 500  # Safe fallback default


# ==============================================================================
# 2. Corpus Reporting & Distribution Tests
# ==============================================================================

@pytest.fixture
def mock_registry():
    sources = [
        TelegramSourceEntry(
            username="@warmonitors",
            domain="geopolitics",
            expected_language="en",
            source_type=SourceType.INDEPENDENT,
            enabled=True,
        ),
        TelegramSourceEntry(
            username="@thehackernews",
            domain="cybersecurity",
            expected_language="en",
            source_type=SourceType.PUBLISHER,
            enabled=True,
        ),
        TelegramSourceEntry(
            username="@liveuamap",
            domain="conflict",
            expected_language="en",
            source_type=SourceType.INDEPENDENT,
            enabled=True,
        ),
    ]
    return TelegramSourceRegistry(version="1.0.0", sources=sources)


@pytest.fixture
def sample_multi_source_messages():
    now = datetime(2026, 9, 6, 12, 0, 0, tzinfo=timezone.utc)
    return [
        CanonicalMessage(
            canonical_id="telegram:1001:1",
            platform=Platform.TELEGRAM,
            native_id="1",
            author_id="1001",
            author_username="warmonitors",
            author_type=AuthorType.CHANNEL,
            published_at=now,
            collected_at=now,
            text_content="Frontline troop movements verified #Geopolitics",
            media_types=[],
            has_media=False,
            is_forward=False,
            is_repost=False,
            reactions={},
            urls=[],
            hashtags=["#Geopolitics"],
            mentions=[],
            raw_reference="w.jsonl:1",
        ),
        CanonicalMessage(
            canonical_id="telegram:1002:2",
            platform=Platform.TELEGRAM,
            native_id="2",
            author_id="1002",
            author_username="thehackernews",
            author_type=AuthorType.CHANNEL,
            published_at=now,
            collected_at=now,
            text_content="Critical zero-day patch released for OpenSSL vulnerability",
            media_types=[],
            has_media=False,
            is_forward=False,
            is_repost=False,
            reactions={},
            urls=[],
            hashtags=[],
            mentions=[],
            raw_reference="thn.jsonl:1",
        ),
        CanonicalMessage(
            canonical_id="telegram:1003:3",
            platform=Platform.TELEGRAM,
            native_id="3",
            author_id="1003",
            author_username="liveuamap",
            author_type=AuthorType.CHANNEL,
            published_at=now,
            collected_at=now,
            text_content="",  # Media-only message
            media_types=["photo"],
            has_media=True,
            is_forward=False,
            is_repost=False,
            reactions={},
            urls=[],
            hashtags=[],
            mentions=[],
            raw_reference="l.jsonl:1",
        ),
    ]


def test_distribution_reporting(mock_registry, sample_multi_source_messages):
    """3. Test source, domain, 4B language, and text/media distribution calculations."""
    builder = TelegramCorpusBuilder(registry=mock_registry)
    quality_report = QualityReport(records_seen=3, records_valid=3, duplicates_detected=0)

    source_rows, domain_dist, lang_dist, media_dist = builder.compute_distributions(
        sample_multi_source_messages,
        quality_report,
    )

    # Source distribution
    assert len(source_rows) == 3
    user_to_count = {r.username: r.final_records for r in source_rows}
    assert user_to_count["@warmonitors"] == 1
    assert user_to_count["@thehackernews"] == 1
    assert user_to_count["@liveuamap"] == 1

    # Domain distribution mapped from registry
    assert domain_dist["geopolitics"] == 1
    assert domain_dist["cybersecurity"] == 1
    assert domain_dist["conflict"] == 1

    # Media / Text distribution
    assert media_dist["text_bearing"] == 2
    assert media_dist["media_only"] == 1
    assert media_dist["empty_records"] == 0
    assert media_dist["total_final"] == 3

    # Language distribution (4B model output)
    assert "en" in lang_dist
    assert lang_dist["en"] == 2


# ==============================================================================
# 3. Manifest Integrity Tests
# ==============================================================================

def test_manifest_creation_and_no_secrets(tmp_path):
    """4. Test that CorpusManifest serializes deterministically and contains zero secrets or credentials."""
    manifest = CorpusManifest(
        manifest_id="test_manifest_001",
        generated_at_utc="2026-09-06T12:00:00+00:00",
        registry_version="1.0.0",
        collection_config={"per_source_limit": 500, "dataset_name": "telegram_messages"},
        sources_requested=3,
        sources_attempted=3,
        sources_successful=3,
        sources_failed=0,
        failed_sources={},
        total_raw_records=100,
        total_normalized_records=100,
        total_duplicates_detected=5,
        total_final_records=95,
        dataset_output_path=str(tmp_path / "data.parquet"),
        quality_report_path=str(tmp_path / "quality.json"),
        analytics_artifact_path=str(tmp_path / "analytics.json"),
        source_distribution=[{"username": "@warmonitors", "final_records": 95}],
        domain_distribution={"geopolitics": 95},
        language_distribution={"en": 95},
        media_text_distribution={"text_bearing": 90, "media_only": 5},
    )

    out_file = tmp_path / "manifest.json"
    manifest.save_json(out_file)

    assert out_file.exists()
    content = out_file.read_text(encoding="utf-8")
    loaded = json.loads(content)

    assert loaded["manifest_id"] == "test_manifest_001"
    assert loaded["total_final_records"] == 95
    assert loaded["sources_successful"] == 3

    # Secret leakage guard
    assert "api_id" not in content
    assert "api_hash" not in content
    assert "session" not in content or "traject_collector_session" not in content
    assert "password" not in content
    assert "token" not in content


# ==============================================================================
# 4. Cross-Source Narrative Validation Tests
# ==============================================================================

def test_cross_source_narrative_evaluation(mock_registry, sample_multi_source_messages):
    """5. Test cross-source narrative reporting without altering 4G scoring formulas."""
    builder = TelegramCorpusBuilder(registry=mock_registry)

    from app.ml.topics.models import TopicKeyword
    # Synthetic 4A-4H ML output
    topic_rec = TopicRecord(
        topic_id="T001",
        cluster_label=0,
        message_count=2,
        percentage_of_dataset=66.6,
        representative_keywords=[
            TopicKeyword(keyword="security", score=0.8),
            TopicKeyword(keyword="conflict", score=0.6),
        ],
        sample_message_ids=["telegram:1001:1", "telegram:1002:2"],
    )
    topic_result = TopicDiscoveryResult(
        model_id="paraphrase-multilingual-MiniLM-L12-v2",
        embedding_dimension=384,
        total_input_messages=3,
        clustered_messages=2,
        noise_messages=1,
        number_of_topics=1,
        topic_records=[topic_rec],
        noise_message_ids=["telegram:1003:3"],
        clustering_config=ClusteringConfig(min_cluster_size=2),
    )
    enriched_result = TopicEnrichmentResult(
        dataset_source="test_corpus",
        total_messages_analyzed=3,
        total_topics_enriched=0,
        unassigned_noise_count=1,
        enriched_topics=[],
    )

    from app.ml.narratives.models import NarrativeSentimentProfile
    candidate = NarrativeCandidate(
        narrative_id="NARR-001",
        promoted_from_topic_id="T001",
        headline_claim="Multi-channel security alert",
        priority_signal_score=0.65,
        priority_tier=PriorityTier.HIGH,
        sub_scores=NarrativeSubScores(
            spread_score=0.70,
            coordination_score=0.60,
            reach_score=0.65,
            friction_score=0.60,
        ),
        coordination_signals=PotentialCoordinationSignals(
            potential_syndication_spike=False,
            potential_temporal_burst=False,
            potential_rapid_channel_entry=False,
            potential_cross_channel_cascade=True,
        ),
        data_coverage=NarrativeDataCoverage(
            message_count=2,
            channel_count=2,
            timespan_seconds=3600.0,
            has_views_coverage=True,
            has_reactions_coverage=False,
            evidence_density=EvidenceDensityTier.MODERATE,
            data_quality_notes=[],
        ),
        sentiment_profile=NarrativeSentimentProfile(
            is_available=True,
            total_text_messages_evaluated=2,
            text_positive_ratio=0.1,
            text_neutral_ratio=0.7,
            text_negative_ratio=0.2,
            emoji_polarity_score=0.0,
            sentiment_model_id="twitter-roberta-base-sentiment-latest",
        ),
        first_observed_at=datetime(2026, 9, 6, 12, 0, 0, tzinfo=timezone.utc),
        last_observed_at=datetime(2026, 9, 6, 13, 0, 0, tzinfo=timezone.utc),
    )
    narrative_report = NarrativeAssessmentReport(
        dataset_source="test_corpus",
        total_messages_analyzed=3,
        total_narrative_candidates=1,
        candidates_by_tier={"high": 1},
        narrative_candidates=[candidate],
        unassigned_noise_count=1,
    )

    ml_result = MLPipelineResult(
        dataset_source="test_corpus",
        metrics=PipelineStageMetrics(),
        topics=topic_result,
        enriched_topics=enriched_result,
        narrative_report=narrative_report,
    )

    summaries = builder.evaluate_narratives(ml_result, sample_multi_source_messages)

    assert len(summaries) == 1
    s = summaries[0]
    assert s.narrative_id == "NARR-001"
    assert s.distinct_sources_count == 2
    assert "warmonitors" in s.distinct_sources
    assert "thehackernews" in s.distinct_sources
    assert "geopolitics" in s.domains_represented
    assert "cybersecurity" in s.domains_represented
    assert s.priority_signal_score == 0.65
    assert s.spread_score == 0.70
    assert s.coordination_score == 0.60


# ==============================================================================
# 5. Storage Integration Round-Trip Tests
# ==============================================================================

def test_parquet_storage_round_trip_with_manifest(tmp_path, sample_multi_source_messages):
    """6. Test Parquet storage round-trip preserving multi-channel source identities."""
    parquet_path = tmp_path / "telegram_messages.parquet"
    written = write_canonical_messages(sample_multi_source_messages, parquet_path)
    assert written == 3

    read_back = read_canonical_messages(parquet_path)
    assert len(read_back) == 3
    sources = {m.author_username for m in read_back}
    assert sources == {"warmonitors", "thehackernews", "liveuamap"}
