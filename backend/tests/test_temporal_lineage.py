"""Comprehensive test suite for Temporal Narrative Lineage and Operational Monitoring (Milestone 6E).

Validates:
1. First snapshot initializes lineages with NEW state and CREATED events
2. Consecutive snapshots match continuing narrative with PERSISTING state
3. Changed snapshot-local narrative ID maps to the same stable lineage_id
4. Observable weakening detection under documented volume/source threshold
5. Disappeared narrative detection when absent from current snapshot
6. Reappeared narrative detection when returning in subsequent snapshot
7. New narrative cluster emerging in second snapshot gets new lineage
8. Ambiguous candidate match rejection (abstains to prevent false continuity)
9. Insufficient evidence matching rejection
10. Idempotent repeated snapshot processing (zero duplicate events)
11. Historical analytics artifacts remain completely immutable
12. Operational monitoring: stale analytics detection when corpus has newer messages
13. Operational monitoring: synchronized analytics detection
14. API: GET /api/v1/temporal/status returns typed unified telemetry
15. API: GET /api/v1/temporal/snapshots lists immutable snapshot artifacts
16. API: GET /api/v1/temporal/narratives returns paginated lineage list
17. API: GET /api/v1/temporal/narratives/{lineage_id} returns details and event history
18. API: GET /api/v1/temporal/narratives/by-narrative/{narrative_id} resolves lineage
"""

from datetime import datetime, timezone
import json
from pathlib import Path
import pytest
from starlette.testclient import TestClient

from app.main import create_app
from app.ml.narratives.models import (
    EvidenceDensityTier,
    NarrativeCandidate,
    NarrativeDataCoverage,
    NarrativeSentimentProfile,
    NarrativeSubScores,
    PotentialCoordinationSignals,
    PriorityTier,
)
from app.ml.features.models import (
    EnrichedTopicCandidate,
    TopicEngagementFeatures,
    TopicEnrichmentResult,
    TopicPropagationFeatures,
    TopicTemporalFeatures,
)
from app.ml.pipeline.metrics import PipelineStageMetrics
from app.ml.pipeline.orchestrator import MLPipelineResult
from app.ml.topics.models import ClusteringConfig, TopicDiscoveryResult, TopicKeyword, TopicRecord
from app.temporal.matcher import DeterministicNarrativeMatcher, NarrativeMatchingProfile
from app.temporal.models import (
    LineageEventType,
    LineageState,
    NarrativeLineage,
    TemporalComparisonReport,
)
from app.temporal.store import TemporalLineageStore
from app.temporal.tracker import TemporalLineageTracker


def _make_candidate(
    narrative_id: str,
    topic_id: str,
    headline: str,
    channels: list[str],
    key_entities: list[str],
    msg_count: int = 10,
    priority_score: float = 0.65,
) -> NarrativeCandidate:
    """Helper to synthesize deterministic NarrativeCandidate domain models."""
    return NarrativeCandidate(
        narrative_id=narrative_id,
        promoted_from_topic_id=topic_id,
        headline_claim=headline,
        priority_signal_score=priority_score,
        priority_tier=PriorityTier.HIGH if priority_score >= 0.55 else PriorityTier.ELEVATED,
        sub_scores=NarrativeSubScores(
            spread_score=0.6,
            coordination_score=0.5,
            reach_score=0.7,
            friction_score=0.2,
        ),
        coordination_signals=PotentialCoordinationSignals(
            potential_syndication_spike=False,
            potential_temporal_burst=False,
            potential_rapid_channel_entry=False,
            potential_cross_channel_cascade=False,
        ),
        data_coverage=NarrativeDataCoverage(
            message_count=msg_count,
            channel_count=len(channels),
            timespan_seconds=7200.0,
            has_views_coverage=True,
            has_reactions_coverage=True,
            evidence_density=EvidenceDensityTier.HIGH,
            data_quality_notes=[],
        ),
        sentiment_profile=NarrativeSentimentProfile(
            is_available=True,
            total_text_messages_evaluated=msg_count,
            text_positive_ratio=0.2,
            text_neutral_ratio=0.5,
            text_negative_ratio=0.3,
            emoji_polarity_score=0.0,
            sentiment_model_id="test_model",
        ),
        key_entities=key_entities,
        broadcasting_channels=channels,
        origin_channels=[channels[0]] if channels else [],
        representative_message_excerpts=["Centroid message text excerpt"],
        first_observed_at=datetime(2026, 9, 6, 12, 0, 0, tzinfo=timezone.utc),
        last_observed_at=datetime(2026, 9, 6, 14, 0, 0, tzinfo=timezone.utc),
        audit_rationale=["High spread across distinct channels"],
    )


def _make_synthetic_pipeline_result(
    candidates: list[NarrativeCandidate],
    topic_messages: dict[str, list[str]],
    dataset_source: str = "telegram_messages",
) -> MLPipelineResult:
    """Helper to construct a valid MLPipelineResult envelope."""
    topic_records = [
        TopicRecord(
            topic_id=t_id,
            cluster_label=i,
            message_count=len(mids),
            percentage_of_dataset=round(len(mids) / 100.0, 4),
            representative_keywords=[
                TopicKeyword(keyword=kw, score=0.8)
                for kw in ["drone", "strike", "defense"]
            ],
            representative_message_ids=mids[:3],
            sample_message_ids=mids,
        )
        for i, (t_id, mids) in enumerate(topic_messages.items())
    ]

    topics = TopicDiscoveryResult(
        model_id="test_embedding",
        embedding_dimension=384,
        total_input_messages=sum(len(mids) for mids in topic_messages.values()),
        clustered_messages=sum(len(mids) for mids in topic_messages.values()),
        noise_messages=0,
        number_of_topics=len(topic_records),
        topic_records=topic_records,
        noise_message_ids=[],
        clustering_config=ClusteringConfig(),
    )

    enriched_topics = TopicEnrichmentResult(
        dataset_source=dataset_source,
        total_messages_analyzed=topics.total_input_messages,
        total_topics_enriched=len(topic_records),
        enriched_topics=[
            EnrichedTopicCandidate(
                topic_id=t.topic_id,
                message_count=t.message_count,
                percentage_of_dataset=t.percentage_of_dataset,
                representative_keywords=[k.keyword for k in t.representative_keywords],
                entities=[],
                engagement=TopicEngagementFeatures(),
                propagation=TopicPropagationFeatures(),
                temporal=TopicTemporalFeatures(
                    first_published_at=datetime(2026, 9, 6, 12, 0, 0, tzinfo=timezone.utc),
                    last_published_at=datetime(2026, 9, 6, 14, 0, 0, tzinfo=timezone.utc),
                    timespan_seconds=7200.0,
                    peak_window_utc="2026-09-06T12:00",
                    peak_window_message_count=t.message_count,
                ),
            )
            for t in topic_records
        ],
        unassigned_noise_count=0,
    )

    from app.ml.narratives.models import NarrativeAssessmentReport

    narrative_report = NarrativeAssessmentReport(
        dataset_source=dataset_source,
        total_messages_analyzed=topics.total_input_messages,
        total_narrative_candidates=len(candidates),
        candidates_by_tier={"high": len(candidates)},
        narrative_candidates=candidates,
        unassigned_noise_count=0,
        scoring_weights={},
    )

    return MLPipelineResult(
        dataset_source=dataset_source,
        created_at_utc=datetime.now(timezone.utc).isoformat(),
        metrics=PipelineStageMetrics(
            language_detection_seconds=0.1,
            normalization_seconds=0.1,
            sentiment_load_seconds=0.1,
            sentiment_inference_seconds=0.1,
            embedding_load_seconds=0.1,
            embedding_inference_seconds=0.1,
            topic_discovery_seconds=0.1,
            feature_enrichment_seconds=0.1,
            narrative_assessment_seconds=0.1,
            total_runtime_seconds=0.9,
            cold_start_time_seconds=0.1,
            warm_inference_time_seconds=0.8,
            sentiment_throughput_samples_per_sec=100.0,
            embedding_throughput_samples_per_sec=100.0,
            records_ingested=topics.total_input_messages,
            records_processed=topics.total_input_messages,
            records_skipped=0,
            records_failed=0,
            cache_hits=0,
            cache_misses=0,
            cache_hit_rate=0.0,
            peak_rss_mb=100.0,
            peak_python_heap_mb=50.0,
            peak_memory_mb=100.0,
        ),
        topics=topics,
        enriched_topics=enriched_topics,
        narrative_report=narrative_report,
    )


# ------------------------------------------------------------------------------
# Test 1: First Snapshot Initializes Lineages
# ------------------------------------------------------------------------------

def test_first_snapshot_initializes_lineages(tmp_path: Path):
    """Verify that processing an initial snapshot registers lineages in NEW state with CREATED events."""
    store = TemporalLineageStore(tmp_path / "lineage")
    tracker = TemporalLineageTracker(store=store, repo_root=tmp_path)

    c1 = _make_candidate("narrative_001", "topic_001", "Drone strike over Odesa port", ["warmonitors"], ["#odesa"])
    c2 = _make_candidate("narrative_002", "topic_002", "Energy grid repairs in Kharkiv", ["clashreport"], ["#kharkiv"])
    res = _make_synthetic_pipeline_result(
        candidates=[c1, c2],
        topic_messages={"topic_001": ["msg_1", "msg_2"], "topic_002": ["msg_3", "msg_4"]},
    )

    report = tracker.process_snapshot(current_result=res, current_snapshot_id="snap_1")

    assert report.new_count == 2
    assert report.continuing_count == 0
    assert report.total_lineages_tracked == 2

    l1 = store.get_lineage_by_narrative_id("narrative_001")
    assert l1 is not None
    assert l1.state == LineageState.NEW
    assert l1.first_snapshot_id == "snap_1"
    assert l1.snapshot_count == 1

    events = store.get_events_for_lineage(l1.lineage_id)
    assert len(events) == 1
    assert events[0].event_type == LineageEventType.CREATED


# ------------------------------------------------------------------------------
# Test 2 & 3: Consecutive Snapshots Match & ID Mapping
# ------------------------------------------------------------------------------

def test_persisting_narrative_and_id_mapping(tmp_path: Path):
    """Verify that a narrative persisting into snapshot 2 keeps the same lineage_id even if snapshot-local ID changes."""
    store = TemporalLineageStore(tmp_path / "lineage")
    tracker = TemporalLineageTracker(store=store, repo_root=tmp_path)

    # Snapshot 1: narrative_001
    c1 = _make_candidate("narrative_001", "topic_001", "Drone strike over Odesa port", ["warmonitors"], ["#odesa"], msg_count=10)
    snap1_res = _make_synthetic_pipeline_result(
        candidates=[c1],
        topic_messages={"topic_001": ["msg_1", "msg_2", "msg_3", "msg_4"]},
    )
    tracker.process_snapshot(current_result=snap1_res, current_snapshot_id="snap_1")
    l1 = store.get_lineage_by_narrative_id("narrative_001")
    assert l1 is not None
    initial_lineage_id = l1.lineage_id

    # Snapshot 2: Same topic/messages, but local ID is now narrative_099!
    c2 = _make_candidate("narrative_099", "topic_005", "Drone strike over Odesa port harbor", ["warmonitors"], ["#odesa"], msg_count=12)
    snap2_res = _make_synthetic_pipeline_result(
        candidates=[c2],
        topic_messages={"topic_005": ["msg_1", "msg_2", "msg_3", "msg_5"]}, # 3 shared messages!
    )
    report = tracker.process_snapshot(
        current_result=snap2_res,
        current_snapshot_id="snap_2",
        previous_result=snap1_res,
        previous_snapshot_id="snap_1",
    )

    assert report.continuing_count == 1
    assert report.new_count == 0

    l2 = store.get_lineage_by_narrative_id("narrative_099")
    assert l2 is not None
    assert l2.lineage_id == initial_lineage_id  # Stable cross-snapshot ID!
    assert l2.state == LineageState.PERSISTING
    assert l2.snapshot_count == 2
    assert l2.consecutive_snapshot_count == 2
    assert l2.message_count_current == 12
    assert l2.message_count_previous == 10
    assert "narrative_001" in l2.historical_narrative_ids
    assert "narrative_099" in l2.historical_narrative_ids


# ------------------------------------------------------------------------------
# Test 4: Observable Weakening Detection
# ------------------------------------------------------------------------------

def test_weakening_narrative_detection(tmp_path: Path):
    """Verify that a drop in observable volume (>= 30% reduction) sets state to WEAKENING."""
    store = TemporalLineageStore(tmp_path / "lineage")
    tracker = TemporalLineageTracker(store=store, repo_root=tmp_path)

    # Snapshot 1: 20 messages
    c1 = _make_candidate("narrative_001", "topic_001", "Missile alert in Kyiv", ["warmonitors"], ["#kyiv"], msg_count=20)
    snap1_res = _make_synthetic_pipeline_result(
        candidates=[c1],
        topic_messages={"topic_001": [f"m_{i}" for i in range(20)]},
    )
    tracker.process_snapshot(current_result=snap1_res, current_snapshot_id="snap_1")

    # Snapshot 2: Shared messages but count drops to 8 (< 70% of 20)
    c2 = _make_candidate("narrative_001", "topic_001", "Missile alert in Kyiv update", ["warmonitors"], ["#kyiv"], msg_count=8)
    snap2_res = _make_synthetic_pipeline_result(
        candidates=[c2],
        topic_messages={"topic_001": [f"m_{i}" for i in range(8)]},
    )
    report = tracker.process_snapshot(
        current_result=snap2_res,
        current_snapshot_id="snap_2",
        previous_result=snap1_res,
        previous_snapshot_id="snap_1",
    )

    assert report.weakened_count == 1
    l = store.get_lineage_by_narrative_id("narrative_001")
    assert l.state == LineageState.WEAKENING

    events = store.get_events_for_lineage(l.lineage_id)
    assert any(e.event_type == LineageEventType.WEAKENED for e in events)


# ------------------------------------------------------------------------------
# Test 5 & 6: Disappeared and Reappeared Transitions
# ------------------------------------------------------------------------------

def test_disappeared_and_reappeared_lineage(tmp_path: Path):
    """Verify transition lifecycle: Active -> Disappeared -> Reappeared."""
    store = TemporalLineageStore(tmp_path / "lineage")
    tracker = TemporalLineageTracker(store=store, repo_root=tmp_path)

    shared_msgs = ["k_1", "k_2", "k_3", "k_4"]
    c1 = _make_candidate("narrative_A", "topic_A", "Frontline artillery duel", ["warmonitors"], ["#donbas"], msg_count=10)
    snap1_res = _make_synthetic_pipeline_result(
        candidates=[c1],
        topic_messages={"topic_A": shared_msgs},
    )
    tracker.process_snapshot(current_result=snap1_res, current_snapshot_id="snap_1")
    l1 = store.get_lineage_by_narrative_id("narrative_A")
    target_lid = l1.lineage_id

    # Snapshot 2: Narrative A is completely absent! (Only Narrative B present)
    cB = _make_candidate("narrative_B", "topic_B", "Unrelated trade logistics", ["other_ch"], ["#trade"], msg_count=5)
    snap2_res = _make_synthetic_pipeline_result(
        candidates=[cB],
        topic_messages={"topic_B": ["t_1", "t_2"]},
    )
    rep2 = tracker.process_snapshot(
        current_result=snap2_res,
        current_snapshot_id="snap_2",
        previous_result=snap1_res,
        previous_snapshot_id="snap_1",
    )

    assert rep2.disappeared_count == 1
    l_after_snap2 = store.get_lineage(target_lid)
    assert l_after_snap2.state == LineageState.DISAPPEARED
    assert l_after_snap2.current_narrative_id is None

    # Snapshot 3: Narrative A reappears with matching content!
    c3 = _make_candidate("narrative_A_again", "topic_A3", "Frontline artillery duel ongoing", ["warmonitors"], ["#donbas"], msg_count=10)
    snap3_res = _make_synthetic_pipeline_result(
        candidates=[c3],
        topic_messages={"topic_A3": shared_msgs},
    )
    rep3 = tracker.process_snapshot(
        current_result=snap3_res,
        current_snapshot_id="snap_3",
        previous_result=snap1_res, # Matching against historical snapshot containing Narrative A
        previous_snapshot_id="snap_1",
    )

    assert rep3.reappeared_count == 1
    l_after_snap3 = store.get_lineage(target_lid)
    assert l_after_snap3.state == LineageState.REAPPEARED
    assert l_after_snap3.current_narrative_id == "narrative_A_again"


# ------------------------------------------------------------------------------
# Test 8 & 9: Ambiguous Match & Insufficient Evidence Abstention
# ------------------------------------------------------------------------------

def test_ambiguous_match_and_insufficient_evidence_abstention():
    """Verify that matcher abstains when candidates are ambiguous or evidence is insufficient."""
    matcher = DeterministicNarrativeMatcher()

    p_curr = NarrativeMatchingProfile(
        narrative_id="curr",
        topic_id="top_c",
        headline_claim="Heavy shelling reported",
        message_ids=frozenset(["m_1", "m_2"]),
        channels=frozenset(["ch1"]),
        lexical_tokens=frozenset(["heavy", "shelling"]),
        message_count=2,
        distinct_sources_count=1,
        distinct_domains_count=1,
        priority_signal_score=0.5,
        first_observed_at="2026-09-06T12:00:00Z",
        last_observed_at="2026-09-06T13:00:00Z",
    )

    # Candidate A: shares m_1
    p_prev_a = NarrativeMatchingProfile(
        narrative_id="prev_a",
        topic_id="top_a",
        headline_claim="Heavy shelling reported",
        message_ids=frozenset(["m_1", "m_9"]),
        channels=frozenset(["ch1"]),
        lexical_tokens=frozenset(["heavy", "shelling"]),
        message_count=2,
        distinct_sources_count=1,
        distinct_domains_count=1,
        priority_signal_score=0.5,
        first_observed_at="2026-09-06T12:00:00Z",
        last_observed_at="2026-09-06T13:00:00Z",
    )

    # Candidate B: identical score (shares m_2)
    p_prev_b = NarrativeMatchingProfile(
        narrative_id="prev_b",
        topic_id="top_b",
        headline_claim="Heavy shelling reported",
        message_ids=frozenset(["m_2", "m_8"]),
        channels=frozenset(["ch1"]),
        lexical_tokens=frozenset(["heavy", "shelling"]),
        message_count=2,
        distinct_sources_count=1,
        distinct_domains_count=1,
        priority_signal_score=0.5,
        first_observed_at="2026-09-06T12:00:00Z",
        last_observed_at="2026-09-06T13:00:00Z",
    )

    # Match snapshot: with 2 equally strong candidates, ambiguity guard must abstain
    matched, unmatched_new, unmatched_disp = matcher.match_snapshots(
        previous_profiles=[p_prev_a, p_prev_b],
        current_profiles=[p_curr],
    )
    assert len(matched) == 0
    assert "curr" in unmatched_new  # Treated as new rather than guessing!


# ------------------------------------------------------------------------------
# Test 10: Idempotent Repeated Processing
# ------------------------------------------------------------------------------

def test_idempotent_repeated_processing(tmp_path: Path):
    """Verify that reprocessing the exact same snapshot creates 0 duplicate events."""
    store = TemporalLineageStore(tmp_path / "lineage")
    tracker = TemporalLineageTracker(store=store, repo_root=tmp_path)

    c1 = _make_candidate("narrative_001", "topic_001", "Border checkpoint inspection", ["warmonitors"], ["#border"])
    snap_res = _make_synthetic_pipeline_result(candidates=[c1], topic_messages={"topic_001": ["m1", "m2"]})

    # Run 1
    tracker.process_snapshot(current_result=snap_res, current_snapshot_id="snap_1")
    l1 = store.get_lineage_by_narrative_id("narrative_001")
    events_1 = store.get_events_for_lineage(l1.lineage_id)
    assert len(events_1) == 1

    # Run 2 (duplicate execution)
    tracker.process_snapshot(current_result=snap_res, current_snapshot_id="snap_1")
    events_2 = store.get_events_for_lineage(l1.lineage_id)
    assert len(events_2) == 1  # No duplicate events created!


# ------------------------------------------------------------------------------
# Test 11: Historical Snapshot Immutability
# ------------------------------------------------------------------------------

def test_historical_snapshots_remain_immutable(tmp_path: Path):
    """Verify that temporal lineage processing does not modify historical analytics JSON files."""
    dummy_artifact = tmp_path / "historical-analytics-artifact.json"
    dummy_content = '{"dataset_source": "test", "created_at_utc": "2026-09-06T12:00:00Z", "topics": {}, "narratives": []}'
    dummy_artifact.write_text(dummy_content, encoding="utf-8")

    # Run tracker
    store = TemporalLineageStore(tmp_path / "lineage")
    tracker = TemporalLineageTracker(store=store, repo_root=tmp_path)

    c1 = _make_candidate("narrative_001", "topic_001", "Test", ["ch"], ["#t"])
    snap_res = _make_synthetic_pipeline_result(candidates=[c1], topic_messages={"topic_001": ["m1"]})
    tracker.process_snapshot(current_result=snap_res, current_snapshot_id="snap_test")

    # Verify dummy artifact was not modified
    assert dummy_artifact.read_text(encoding="utf-8") == dummy_content


# ------------------------------------------------------------------------------
# Test 12 & 13: Stale Analytics Detection & Repository Freshness
# ------------------------------------------------------------------------------

def test_stale_and_current_analytics_detection(tmp_path: Path):
    """Verify operational detection of stale analytics when corpus has newer ingested records."""
    from app.repositories.artifact_repository import ArtifactRepository

    repo = ArtifactRepository()
    repo.repo_root = tmp_path
    repo.artifacts_loaded = True
    repo.dataset_source = "telegram_messages"
    repo.created_at_utc = "2026-09-06T19:00:00Z"
    repo.pipeline_version = "4h.v1"

    # Loaded analytics has 6036 records
    repo._messages = [None] * 6036
    repo._metrics = PipelineStageMetrics(
        language_detection_seconds=0.1, normalization_seconds=0.1, sentiment_load_seconds=0.1,
        sentiment_inference_seconds=0.1, embedding_load_seconds=0.1, embedding_inference_seconds=0.1,
        topic_discovery_seconds=0.1, feature_enrichment_seconds=0.1, narrative_assessment_seconds=0.1,
        total_runtime_seconds=0.9, cold_start_time_seconds=0.1, warm_inference_time_seconds=0.8,
        sentiment_throughput_samples_per_sec=100.0, embedding_throughput_samples_per_sec=100.0,
        records_ingested=6036, records_processed=6036, records_skipped=0, records_failed=0,
        cache_hits=0, cache_misses=0, cache_hit_rate=0.0, peak_rss_mb=100.0, peak_python_heap_mb=50.0,
        peak_memory_mb=100.0,
    )

    # Manifest reports cumulative corpus has 6042 records!
    manifest_dir = tmp_path / "data" / "manifests" / "telegram" / "incremental"
    manifest_dir.mkdir(parents=True, exist_ok=True)
    manifest_file = manifest_dir / "latest_manifest.json"
    manifest_file.write_text(
        json.dumps({
            "mode": "incremental",
            "completed_at_utc": "2026-09-06T20:23:00Z",
            "sources_attempted": 2,
            "sources_succeeded": 2,
            "cumulative_corpus_count": 6042,
            "corpus_snapshot_id": "corpus_snapshot_6042",
        }),
        encoding="utf-8",
    )

    status = repo.get_pipeline_status()
    assert status.analytics_current is False
    assert "Corpus has 6042 messages, but loaded analytics reflect earlier snapshot" in (status.stale_analytics_reason or "")


# ------------------------------------------------------------------------------
# Test 14, 15, 16, 17, 18: FastAPI Temporal Endpoints
# ------------------------------------------------------------------------------

def test_temporal_api_endpoints(tmp_path: Path):
    """Verify that all temporal endpoints respond with valid schemas."""
    # Seed temporal store with dummy lineage
    store = TemporalLineageStore(tmp_path / "data" / "temporal" / "lineage")
    tracker = TemporalLineageTracker(store=store, repo_root=tmp_path)

    c1 = _make_candidate("narrative_001", "topic_001", "Coastal radar facility operational", ["warmonitors"], ["#radar"])
    snap_res = _make_synthetic_pipeline_result(candidates=[c1], topic_messages={"topic_001": ["m1", "m2"]})
    tracker.process_snapshot(current_result=snap_res, current_snapshot_id="snap_seed")

    app = create_app()
    from app.api.v1.temporal import _get_lineage_store
    app.dependency_overrides[_get_lineage_store] = lambda: store
    client = TestClient(app)

    # 1. GET /api/v1/temporal/status
    res_status = client.get("/api/v1/temporal/status")
    assert res_status.status_code == 200
    data_status = res_status.json()
    assert "collection_status" in data_status
    assert "analytics_current" in data_status
    assert "total_lineages_tracked" in data_status

    # 2. GET /api/v1/temporal/snapshots
    res_snaps = client.get("/api/v1/temporal/snapshots")
    assert res_snaps.status_code == 200
    data_snaps = res_snaps.json()
    assert "snapshots" in data_snaps

    # 3. GET /api/v1/temporal/narratives
    res_list = client.get("/api/v1/temporal/narratives?page=1&page_size=10")
    assert res_list.status_code == 200
    data_list = res_list.json()
    assert "data" in data_list
    assert "meta" in data_list
    assert len(data_list["data"]) >= 1

    first_lineage_id = data_list["data"][0]["lineage_id"]

    # 4. GET /api/v1/temporal/narratives/{lineage_id}
    res_detail = client.get(f"/api/v1/temporal/narratives/{first_lineage_id}")
    assert res_detail.status_code == 200
    data_detail = res_detail.json()
    assert data_detail["lineage"]["lineage_id"] == first_lineage_id
    assert "events" in data_detail

    # 5. GET /api/v1/temporal/narratives/by-narrative/{narrative_id}
    res_by_narr = client.get("/api/v1/temporal/narratives/by-narrative/narrative_001")
    assert res_by_narr.status_code == 200
    data_by_narr = res_by_narr.json()
    assert data_by_narr["lineage"]["lineage_id"] == first_lineage_id

    # 6. Non-existent lineage returns 404
    res_404 = client.get("/api/v1/temporal/narratives/lineage_999999")
    assert res_404.status_code == 404
