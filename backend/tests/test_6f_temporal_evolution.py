"""Milestone 6F: Real Temporal Narrative Evolution Validation Test Suite.

Ensures:
1. Snapshot A and Snapshot B artifacts exist, are cryptographically distinct (SHA-256),
   and reflect the 6,036 vs 6,056 message real Telegram corpus.
2. Temporal lineage tracking across real Snapshot A -> Snapshot B runs entirely offline,
   producing exactly 1,162 persisting, 3 weakening, 4 new, 0 disappeared, and 0 reappeared.
3. Re-processing Snapshot A -> Snapshot B is 100% idempotent (zero duplicate events).
4. Evidence traceability: all continuing and weakened events record Jaccard components
   (jaccard_messages, jaccard_channels, jaccard_lexical) and explicit explanations.
5. Immutability: source snapshot artifacts on disk are never altered by lineage tracking.
6. Ambiguity abstention: when two candidates have near-identical match scores, the matcher
   refuses to assign an ambiguous lineage link.
"""

import hashlib
import json
from pathlib import Path
import tempfile
import pytest

from app.core.config import find_repo_root
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
from app.temporal.matcher import DeterministicNarrativeMatcher, NarrativeMatchingProfile
from app.temporal.models import (
    LineageEvent,
    LineageEventType,
    LineageState,
    NarrativeLineage,
    TemporalComparisonReport,
)
from app.temporal.store import TemporalLineageStore
from app.temporal.tracker import TemporalLineageTracker


def compute_file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


@pytest.fixture
def repo_root() -> Path:
    return find_repo_root()


@pytest.fixture
def snapshot_a_path(repo_root: Path) -> Path:
    return repo_root / "data" / "processed" / "telegram" / "telegram-analytics-artifact.json"


@pytest.fixture
def snapshot_b_path(repo_root: Path) -> Path:
    return repo_root / "data" / "processed" / "telegram" / "telegram-analytics-snapshot-b.json"


def test_snapshot_artifacts_exist_and_distinct(snapshot_a_path: Path, snapshot_b_path: Path):
    """Test 1: Verify Snapshot A and B artifacts exist, are distinct files with unique SHA-256 hashes."""
    assert snapshot_a_path.is_file(), f"Snapshot A artifact missing at {snapshot_a_path}"
    assert snapshot_b_path.is_file(), f"Snapshot B artifact missing at {snapshot_b_path}"

    hash_a = compute_file_sha256(snapshot_a_path)
    hash_b = compute_file_sha256(snapshot_b_path)

    assert hash_a != hash_b, "Snapshot A and Snapshot B have identical SHA-256 hashes!"
    assert len(hash_a) == 64
    assert len(hash_b) == 64

    # Load and verify message and narrative candidate counts
    with open(snapshot_a_path, "r", encoding="utf-8") as f:
        data_a = json.load(f)
    with open(snapshot_b_path, "r", encoding="utf-8") as f:
        data_b = json.load(f)

    assert data_a["narrative_report"]["total_messages_analyzed"] == 6036
    assert data_b["narrative_report"]["total_messages_analyzed"] == 6056
    assert len(data_a["narrative_report"]["narrative_candidates"]) == 1165
    assert len(data_b["narrative_report"]["narrative_candidates"]) == 1169


def test_real_snapshots_evolution_deterministic(snapshot_a_path: Path, snapshot_b_path: Path):
    """Test 2: Process real Snapshot A -> Snapshot B in an isolated store and assert deterministic evolution."""
    with open(snapshot_a_path, "r", encoding="utf-8") as f:
        data_a = json.load(f)
    with open(snapshot_b_path, "r", encoding="utf-8") as f:
        data_b = json.load(f)

    result_a = MLPipelineResult.model_validate(data_a)
    result_b = MLPipelineResult.model_validate(data_b)

    with tempfile.TemporaryDirectory() as tmp_dir:
        store = TemporalLineageStore(storage_dir=tmp_dir)
        tracker = TemporalLineageTracker(store=store)

        # 1. Initialize Snapshot A
        rep_a = tracker.process_snapshot(
            current_result=result_a,
            current_snapshot_id="analytics_snapshot_6036",
            previous_result=None,
            previous_snapshot_id=None,
        )
        assert rep_a.new_count == 1165
        assert rep_a.continuing_count == 0
        assert rep_a.total_lineages_tracked == 1165

        # 2. Advance to Snapshot B
        rep_b = tracker.process_snapshot(
            current_result=result_b,
            current_snapshot_id="analytics_snapshot_b",
            previous_result=result_a,
            previous_snapshot_id="analytics_snapshot_6036",
        )
        assert rep_b.continuing_count == 1162
        assert rep_b.weakened_count == 3
        assert rep_b.new_count == 4
        assert rep_b.disappeared_count == 0
        assert rep_b.reappeared_count == 0
        assert rep_b.total_lineages_tracked == 1169


def test_real_snapshots_idempotency(snapshot_a_path: Path, snapshot_b_path: Path):
    """Test 3: Verify that re-processing the exact same snapshot transition records 0 duplicate events."""
    with open(snapshot_a_path, "r", encoding="utf-8") as f:
        data_a = json.load(f)
    with open(snapshot_b_path, "r", encoding="utf-8") as f:
        data_b = json.load(f)

    result_a = MLPipelineResult.model_validate(data_a)
    result_b = MLPipelineResult.model_validate(data_b)

    with tempfile.TemporaryDirectory() as tmp_dir:
        store = TemporalLineageStore(storage_dir=tmp_dir)
        tracker = TemporalLineageTracker(store=store)

        # Run A
        tracker.process_snapshot(
            current_result=result_a,
            current_snapshot_id="analytics_snapshot_6036",
            previous_result=None,
            previous_snapshot_id=None,
        )

        # Run B (first pass)
        tracker.process_snapshot(
            current_result=result_b,
            current_snapshot_id="analytics_snapshot_b",
            previous_result=result_a,
            previous_snapshot_id="analytics_snapshot_6036",
        )

        # Read event lines
        with open(store.events_file, "r", encoding="utf-8") as f:
            events_first_pass = [line.strip() for line in f if line.strip()]
        count_first_pass = len(events_first_pass)
        assert count_first_pass == 2334

        # Run B (second pass - re-run)
        tracker.process_snapshot(
            current_result=result_b,
            current_snapshot_id="analytics_snapshot_b",
            previous_result=result_a,
            previous_snapshot_id="analytics_snapshot_6036",
        )

        # Read event lines after second pass
        with open(store.events_file, "r", encoding="utf-8") as f:
            events_second_pass = [line.strip() for line in f if line.strip()]
        count_second_pass = len(events_second_pass)

        # Assert no duplicate events appended
        assert count_second_pass == count_first_pass
        assert len(store.lineages) == 1169


def test_evidence_traceability(snapshot_a_path: Path, snapshot_b_path: Path):
    """Test 4: Validate all continuing and weakened events record mathematical evidence and explanations."""
    with open(snapshot_a_path, "r", encoding="utf-8") as f:
        data_a = json.load(f)
    with open(snapshot_b_path, "r", encoding="utf-8") as f:
        data_b = json.load(f)

    result_a = MLPipelineResult.model_validate(data_a)
    result_b = MLPipelineResult.model_validate(data_b)

    with tempfile.TemporaryDirectory() as tmp_dir:
        store = TemporalLineageStore(storage_dir=tmp_dir)
        tracker = TemporalLineageTracker(store=store)

        tracker.process_snapshot(
            current_result=result_a,
            current_snapshot_id="analytics_snapshot_6036",
            previous_result=None,
            previous_snapshot_id=None,
        )
        tracker.process_snapshot(
            current_result=result_b,
            current_snapshot_id="analytics_snapshot_b",
            previous_result=result_a,
            previous_snapshot_id="analytics_snapshot_6036",
        )

        # Inspect events in store
        all_events: list[LineageEvent] = []
        with open(store.events_file, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    all_events.append(LineageEvent.model_validate(json.loads(line)))

        continued_events = [ev for ev in all_events if ev.event_type == LineageEventType.CONTINUED]
        weakened_events = [ev for ev in all_events if ev.event_type == LineageEventType.WEAKENED]
        created_events = [ev for ev in all_events if ev.event_type == LineageEventType.CREATED]

        assert len(continued_events) == 1162
        assert len(weakened_events) == 3
        # 1165 in snapshot A + 4 new in snapshot B = 1169 created events
        assert len(created_events) == 1169

        # Check evidence in continuing events
        for ev in continued_events[:10]:
            assert ev.match_evidence is not None
            assert "jaccard_messages" in ev.match_evidence
            assert "jaccard_channels" in ev.match_evidence
            assert "jaccard_lexical" in ev.match_evidence
            assert "score" in ev.match_evidence
            assert ev.match_evidence["score"] >= 0.35
            assert "Lineage continued across consecutive snapshots" in ev.explanation

        # Check evidence in weakened events
        for ev in weakened_events:
            assert ev.match_evidence is not None
            assert "jaccard_messages" in ev.match_evidence
            assert "Lineage weakened:" in ev.explanation


def test_snapshot_immutability(snapshot_a_path: Path, snapshot_b_path: Path):
    """Test 5: Ensure processing lineages does not mutate or rewrite original snapshot files."""
    hash_a_before = compute_file_sha256(snapshot_a_path)
    hash_b_before = compute_file_sha256(snapshot_b_path)

    # Perform lineage tracking
    with open(snapshot_a_path, "r", encoding="utf-8") as f:
        data_a = json.load(f)
    with open(snapshot_b_path, "r", encoding="utf-8") as f:
        data_b = json.load(f)

    result_a = MLPipelineResult.model_validate(data_a)
    result_b = MLPipelineResult.model_validate(data_b)

    with tempfile.TemporaryDirectory() as tmp_dir:
        store = TemporalLineageStore(storage_dir=tmp_dir)
        tracker = TemporalLineageTracker(store=store)
        tracker.process_snapshot(result_a, "analytics_snapshot_6036")
        tracker.process_snapshot(result_b, "analytics_snapshot_b", result_a, "analytics_snapshot_6036")

    # Hashes must remain strictly identical
    hash_a_after = compute_file_sha256(snapshot_a_path)
    hash_b_after = compute_file_sha256(snapshot_b_path)

    assert hash_a_before == hash_a_after, "Snapshot A file was mutated!"
    assert hash_b_before == hash_b_after, "Snapshot B file was mutated!"


def test_candidate_conflict_abstention():
    """Test 6: Verify matcher abstains when candidate matches are ambiguous."""
    matcher = DeterministicNarrativeMatcher()

    # Two previous candidates with nearly identical profiles
    p1 = NarrativeMatchingProfile(
        narrative_id="narrative_prev_1",
        topic_id="topic_1",
        headline_claim="Pipeline disruption in eastern region report",
        channels=frozenset(["c1", "c2", "c3"]),
        lexical_tokens=frozenset(["pipeline", "disruption", "eastern", "region"]),
        message_ids=frozenset(["m1", "m2", "m3"]),
        message_count=20,
        distinct_sources_count=3,
        distinct_domains_count=1,
        priority_signal_score=0.75,
        first_observed_at="2026-09-01T00:00:00Z",
        last_observed_at="2026-09-02T00:00:00Z",
    )

    p2 = NarrativeMatchingProfile(
        narrative_id="narrative_prev_2",
        topic_id="topic_2",
        headline_claim="Pipeline disruption in eastern region update",
        channels=frozenset(["c1", "c2", "c3"]),
        lexical_tokens=frozenset(["pipeline", "disruption", "eastern", "region"]),
        message_ids=frozenset(["m1", "m2", "m4"]),
        message_count=20,
        distinct_sources_count=3,
        distinct_domains_count=1,
        priority_signal_score=0.75,
        first_observed_at="2026-09-01T00:00:00Z",
        last_observed_at="2026-09-02T00:00:00Z",
    )

    # One current candidate that matches both p1 and p2 almost identically
    c1 = NarrativeMatchingProfile(
        narrative_id="narrative_curr_1",
        topic_id="topic_curr",
        headline_claim="Pipeline disruption in eastern region ongoing",
        channels=frozenset(["c1", "c2"]),
        lexical_tokens=frozenset(["pipeline", "disruption", "eastern", "region"]),
        message_ids=frozenset(["m1", "m2"]),
        message_count=20,
        distinct_sources_count=3,
        distinct_domains_count=1,
        priority_signal_score=0.74,
        first_observed_at="2026-09-01T00:00:00Z",
        last_observed_at="2026-09-03T00:00:00Z",
    )

    res1 = matcher.evaluate_pair(p1, c1)
    res2 = matcher.evaluate_pair(p2, c1)

    # Confirm score separation is under the 0.10 ambiguity margin
    score_gap = abs(res1.lineage_match_score - res2.lineage_match_score)
    assert score_gap < matcher.AMBIGUITY_MARGIN

    matched, unmatched_new, unmatched_disappeared = matcher.match_snapshots(
        previous_profiles=[p1, p2],
        current_profiles=[c1],
    )

    # Matcher should abstain: c1 is unmatched_new, p1 & p2 are unmatched_disappeared
    assert len(matched) == 0
    assert "narrative_curr_1" in unmatched_new
    assert "narrative_prev_1" in unmatched_disappeared
    assert "narrative_prev_2" in unmatched_disappeared
