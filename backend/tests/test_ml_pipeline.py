from datetime import datetime, timezone
import json
from pathlib import Path
import pytest

from app.ml.pipeline.cache import InferenceCache
from app.ml.pipeline.lifecycle import ModelLifecycleManager
from app.ml.pipeline.orchestrator import (
    MLPipelineResult,
    PipelineConfig,
    run_ml_pipeline,
)
from app.schemas import AuthorType, CanonicalMessage, Platform

FIXTURE_PATH = Path("tests/fixtures/features/synthetic_enrichment_fixture.jsonl")


def load_fixture_messages() -> list[CanonicalMessage]:
    messages: list[CanonicalMessage] = []
    with open(FIXTURE_PATH, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                messages.append(CanonicalMessage.model_validate_json(line))
    return messages


def test_pipeline_end_to_end_synthetic_fixture():
    """1. Verify full end-to-end execution of unified ML pipeline on 16-record synthetic fixture."""
    messages = load_fixture_messages()
    assert len(messages) == 16

    cache = InferenceCache(":memory:")
    lifecycle = ModelLifecycleManager()

    config = PipelineConfig(
        batch_size=16,
        enable_cache=True,
        min_cluster_size=2,
        dataset_source="synthetic_fixture",
    )

    result = run_ml_pipeline(
        messages=messages,
        config=config,
        lifecycle_manager=lifecycle,
        cache=cache,
    )

    assert isinstance(result, MLPipelineResult)
    assert result.dataset_source == "synthetic_fixture"
    assert result.topics.number_of_topics == 3
    assert len(result.narrative_report.narrative_candidates) == 3

    # Check metrics
    m = result.metrics
    assert m.records_ingested == 16
    assert m.records_processed == 16
    assert m.records_skipped == 0
    assert m.records_failed == 0
    assert m.total_runtime_seconds > 0.0
    assert m.peak_memory_mb >= 0.0

    # Verify first candidate is high-signal border security
    top_cand = result.narrative_report.narrative_candidates[0]
    assert top_cand.narrative_id == "narrative_000"
    assert "security" in top_cand.headline_claim.lower()
    assert top_cand.priority_signal_score > 0.40


def test_pipeline_empty_dataset_graceful_handling():
    """2. Verify pipeline handles empty message sequences gracefully without crashes."""
    cache = InferenceCache(":memory:")
    lifecycle = ModelLifecycleManager()

    config = PipelineConfig(enable_cache=True)
    result = run_ml_pipeline(
        messages=[],
        config=config,
        lifecycle_manager=lifecycle,
        cache=cache,
    )

    assert result.topics.number_of_topics == 0
    assert len(result.narrative_report.narrative_candidates) == 0
    assert result.metrics.records_ingested == 0
    assert result.metrics.records_processed == 0
    assert result.metrics.records_skipped == 0


def test_pipeline_single_record_edge_case():
    """3. Verify pipeline handles a single message cleanly (classified as noise by HDBSCAN)."""
    dt = datetime(2026, 9, 2, 12, 0, tzinfo=timezone.utc)
    single_msg = [
        CanonicalMessage(
            canonical_id="telegram:chan1:100",
            platform=Platform.TELEGRAM,
            native_id="100",
            author_id="chan1",
            author_type=AuthorType.CHANNEL,
            published_at=dt,
            collected_at=dt,
            text_content="Lone outpost transmission without duplicates.",
        )
    ]

    cache = InferenceCache(":memory:")
    lifecycle = ModelLifecycleManager()
    config = PipelineConfig(enable_cache=True, min_cluster_size=2)

    result = run_ml_pipeline(
        messages=single_msg,
        config=config,
        lifecycle_manager=lifecycle,
        cache=cache,
    )

    assert result.metrics.records_ingested == 1
    assert result.metrics.records_processed == 1
    assert result.topics.number_of_topics == 0
    assert result.topics.noise_messages == 1
    assert len(result.narrative_report.narrative_candidates) == 0


def test_pipeline_media_only_abstention():
    """4. Verify media-only messages without text are properly skipped from NLP but counted in totals."""
    dt = datetime(2026, 9, 2, 12, 0, tzinfo=timezone.utc)
    msgs = [
        CanonicalMessage(
            canonical_id="telegram:chan1:1",
            platform=Platform.TELEGRAM,
            native_id="1",
            author_id="chan1",
            author_type=AuthorType.CHANNEL,
            published_at=dt,
            collected_at=dt,
            text_content="",  # Media only
            has_media=True,
        ),
        CanonicalMessage(
            canonical_id="telegram:chan1:2",
            platform=Platform.TELEGRAM,
            native_id="2",
            author_id="chan1",
            author_type=AuthorType.CHANNEL,
            published_at=dt,
            collected_at=dt,
            text_content="Standard text report from frontlines.",
            has_media=False,
        ),
    ]

    cache = InferenceCache(":memory:")
    lifecycle = ModelLifecycleManager()

    result = run_ml_pipeline(
        messages=msgs,
        config=PipelineConfig(enable_cache=True),
        lifecycle_manager=lifecycle,
        cache=cache,
    )

    assert result.metrics.records_ingested == 2
    assert result.metrics.records_processed == 1
    assert result.metrics.records_skipped == 1


def test_pipeline_analytics_artifact_serialization(tmp_path):
    """5. Verify precomputed analytics artifact JSON serialization and roundtrip."""
    messages = load_fixture_messages()[:4]
    cache = InferenceCache(":memory:")
    lifecycle = ModelLifecycleManager()

    result = run_ml_pipeline(
        messages=messages,
        config=PipelineConfig(enable_cache=True, min_cluster_size=2),
        lifecycle_manager=lifecycle,
        cache=cache,
    )

    out_file = tmp_path / "analytics_report.json"
    result.save_analytics_artifact(out_file)
    assert out_file.exists()

    with open(out_file, encoding="utf-8") as f:
        data = json.load(f)

    assert "metrics" in data
    assert "topics" in data
    assert "enriched_topics" in data
    assert "narrative_report" in data
    assert data["metrics"]["records_ingested"] == 4

    # Overwrite protection
    with pytest.raises(FileExistsError):
        result.save_analytics_artifact(out_file, overwrite=False)

    result.save_analytics_artifact(out_file, overwrite=True)


def test_pipeline_caching_speedup_on_repeated_run():
    """6. Verify second execution on identical messages hits the inference cache."""
    messages = load_fixture_messages()
    cache = InferenceCache(":memory:")
    lifecycle = ModelLifecycleManager()

    config = PipelineConfig(enable_cache=True)

    # First run (cold inference, cache misses)
    res1 = run_ml_pipeline(messages=messages, config=config, lifecycle_manager=lifecycle, cache=cache)
    misses1 = res1.metrics.cache_misses
    assert misses1 > 0

    # Second run (warm inference, cache hits)
    res2 = run_ml_pipeline(messages=messages, config=config, lifecycle_manager=lifecycle, cache=cache)
    hits2 = res2.metrics.cache_hits
    assert hits2 > 0
    assert res2.metrics.cache_hit_rate > 0.0

    # Deterministic output equivalence between run 1 and run 2
    assert res1.topics.number_of_topics == res2.topics.number_of_topics
    assert len(res1.narrative_report.narrative_candidates) == len(res2.narrative_report.narrative_candidates)
    score1 = res1.narrative_report.narrative_candidates[0].priority_signal_score
    score2 = res2.narrative_report.narrative_candidates[0].priority_signal_score
    assert score1 == score2
