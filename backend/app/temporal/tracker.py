"""Temporal Lineage Tracker orchestrator for cross-snapshot narrative evolution.

Performs deterministic transition analysis between consecutive analytical snapshots:
NEW -> PERSISTING / WEAKENING -> DISAPPEARED -> REAPPEARED.
"""

from collections.abc import Sequence
from datetime import datetime, timezone
import hashlib
import json
import logging
from pathlib import Path
from typing import Any

from app.core.config import find_repo_root
from app.ml.pipeline.orchestrator import MLPipelineResult
from app.temporal.matcher import DeterministicNarrativeMatcher, NarrativeMatchingProfile
from app.temporal.models import (
    LineageEvent,
    LineageEventType,
    LineageState,
    NarrativeLineage,
    TemporalComparisonReport,
    TemporalSnapshotMetadata,
)
from app.temporal.store import TemporalLineageStore

logger = logging.getLogger("traject.temporal.tracker")


class TemporalLineageTracker:
    """Orchestrates cross-snapshot matching and maintains temporal narrative lineage state."""

    def __init__(
        self,
        store: TemporalLineageStore | None = None,
        matcher: DeterministicNarrativeMatcher | None = None,
        repo_root: Path | None = None,
    ):
        self.repo_root = repo_root or find_repo_root()
        self.store = store or TemporalLineageStore()
        self.matcher = matcher or DeterministicNarrativeMatcher()

    @staticmethod
    def extract_profiles(
        pipeline_result: MLPipelineResult,
    ) -> list[NarrativeMatchingProfile]:
        """Convert MLPipelineResult narrative candidates into matching profiles."""
        # Build topic -> sample message IDs lookup
        topic_mids: dict[str, list[str]] = {}
        for t in pipeline_result.topics.topic_records:
            topic_mids[t.topic_id] = list(t.sample_message_ids)

        profiles: list[NarrativeMatchingProfile] = []
        for candidate in pipeline_result.narrative_report.narrative_candidates:
            mids = topic_mids.get(candidate.promoted_from_topic_id, [])
            prof = NarrativeMatchingProfile.from_candidate(
                candidate=candidate,
                topic_message_ids=mids,
            )
            profiles.append(prof)

        return profiles

    def process_snapshot(
        self,
        current_result: MLPipelineResult,
        current_snapshot_id: str,
        previous_result: MLPipelineResult | None = None,
        previous_snapshot_id: str | None = None,
        corpus_size: int = 0,
        collection_run_id: str | None = None,
    ) -> TemporalComparisonReport:
        """Process an analytical snapshot and compute deterministic transitions."""
        now_utc = datetime.now(timezone.utc).isoformat()
        current_profiles = self.extract_profiles(current_result)
        curr_by_id = {p.narrative_id: p for p in current_profiles}

        events_to_record: list[LineageEvent] = []
        matches_summary: list[dict[str, Any]] = []

        # ----------------------------------------------------------------------
        # Case 1: First snapshot or no previous snapshot
        # ----------------------------------------------------------------------
        if previous_result is None or not previous_snapshot_id:
            logger.info(
                "Processing initial snapshot '%s' (%d candidates). Initializing lineages.",
                current_snapshot_id,
                len(current_profiles),
            )
            new_ids: list[str] = []
            for prof in current_profiles:
                # Check if already tracked in store (idempotency)
                existing = self.store.get_lineage_by_narrative_id(prof.narrative_id, snapshot_id=current_snapshot_id)
                if existing:
                    lineage_id = existing.lineage_id
                else:
                    lineage_id = self.store.allocate_lineage_id()

                lineage = NarrativeLineage(
                    lineage_id=lineage_id,
                    current_narrative_id=prof.narrative_id,
                    state=LineageState.NEW,
                    first_seen_at=prof.first_observed_at,
                    last_seen_at=prof.last_observed_at,
                    first_snapshot_id=current_snapshot_id,
                    last_snapshot_id=current_snapshot_id,
                    previous_snapshot_id=None,
                    snapshot_count=1,
                    consecutive_snapshot_count=1,
                    message_count_current=prof.message_count,
                    message_count_previous=None,
                    distinct_sources_current=prof.distinct_sources_count,
                    distinct_sources_previous=None,
                    distinct_domains_current=prof.distinct_domains_count,
                    distinct_domains_previous=None,
                    priority_signal_current=prof.priority_signal_score,
                    priority_signal_previous=None,
                    headline_claim_current=prof.headline_claim,
                    lineage_match_score=None,
                    historical_narrative_ids=[prof.narrative_id],
                    snapshot_history={current_snapshot_id: prof.narrative_id},
                )
                self.store.upsert_lineage(lineage)

                ev_id = f"ev_{current_snapshot_id}_{lineage_id}_created"
                events_to_record.append(
                    LineageEvent(
                        event_id=ev_id,
                        lineage_id=lineage_id,
                        snapshot_id=current_snapshot_id,
                        previous_snapshot_id=None,
                        event_type=LineageEventType.CREATED,
                        timestamp=now_utc,
                        source_narrative_id=prof.narrative_id,
                        explanation=f"Lineage initialized with candidate {prof.narrative_id} in snapshot {current_snapshot_id}",
                    )
                )
                new_ids.append(prof.narrative_id)

            self.store.record_events(events_to_record)
            self.store.save_state()

            return TemporalComparisonReport(
                from_snapshot_id=current_snapshot_id,
                to_snapshot_id=current_snapshot_id,
                continuing_count=0,
                new_count=len(new_ids),
                weakened_count=0,
                disappeared_count=0,
                reappeared_count=0,
                total_lineages_tracked=len(self.store.lineages),
                unmatched_new_narrative_ids=new_ids,
            )

        # ----------------------------------------------------------------------
        # Case 2: Consecutive snapshot comparison
        # ----------------------------------------------------------------------
        previous_profiles = self.extract_profiles(previous_result)
        prev_by_id = {p.narrative_id: p for p in previous_profiles}

        logger.info(
            "Comparing snapshots: '%s' (%d candidates) -> '%s' (%d candidates)",
            previous_snapshot_id,
            len(previous_profiles),
            current_snapshot_id,
            len(current_profiles),
        )

        matched_pairs, unmatched_new, unmatched_disappeared = self.matcher.match_snapshots(
            previous_profiles=previous_profiles,
            current_profiles=current_profiles,
        )

        continuing_count = 0
        weakened_count = 0
        reappeared_count = 0
        new_count = 0
        disappeared_count = 0

        # Process matched pairs
        for curr_id, match_res in matched_pairs.items():
            curr_prof = curr_by_id[curr_id]
            prev_prof = prev_by_id[match_res.previous_narrative_id]

            # Look up existing lineage
            prev_lineage = self.store.get_lineage_by_narrative_id(
                prev_prof.narrative_id, snapshot_id=previous_snapshot_id
            ) or self.store.get_lineage_by_narrative_id(prev_prof.narrative_id)
            if not prev_lineage:
                # Should not happen in normal sequence, but handle gracefully
                lid = self.store.allocate_lineage_id()
                first_seen = prev_prof.first_observed_at
                first_snap = previous_snapshot_id
                snap_count = 1
                consec_count = 1
                hist_ids = [prev_prof.narrative_id]
                snap_hist = {previous_snapshot_id: prev_prof.narrative_id}
            else:
                lid = prev_lineage.lineage_id
                first_seen = prev_lineage.first_seen_at
                first_snap = prev_lineage.first_snapshot_id
                if prev_lineage.last_snapshot_id == current_snapshot_id:
                    snap_count = prev_lineage.snapshot_count
                    consec_count = prev_lineage.consecutive_snapshot_count
                else:
                    snap_count = prev_lineage.snapshot_count + 1
                    consec_count = (
                        prev_lineage.consecutive_snapshot_count + 1
                        if prev_lineage.last_snapshot_id == previous_snapshot_id
                        else 1
                    )
                hist_ids = list(prev_lineage.historical_narrative_ids)
                snap_hist = dict(prev_lineage.snapshot_history)

            if curr_id not in hist_ids:
                hist_ids.append(curr_id)
            snap_hist[current_snapshot_id] = curr_id

            # Determine State & Event
            is_reappeared = prev_lineage and prev_lineage.state == LineageState.DISAPPEARED
            is_weak, weak_reason = self.matcher.is_weakened(prev_prof, curr_prof)

            if is_reappeared:
                state = LineageState.REAPPEARED
                ev_type = LineageEventType.REAPPEARED
                ev_explanation = f"Lineage reappeared (matched {prev_prof.narrative_id} with score {match_res.lineage_match_score:.3f})"
                reappeared_count += 1
            elif is_weak:
                state = LineageState.WEAKENING
                ev_type = LineageEventType.WEAKENED
                ev_explanation = f"Lineage weakened: {weak_reason}"
                weakened_count += 1
            else:
                state = LineageState.PERSISTING
                ev_type = LineageEventType.CONTINUED
                ev_explanation = f"Lineage continued across consecutive snapshots ({match_res.explanation})"
                continuing_count += 1

            lineage = NarrativeLineage(
                lineage_id=lid,
                current_narrative_id=curr_id,
                state=state,
                first_seen_at=first_seen,
                last_seen_at=curr_prof.last_observed_at,
                first_snapshot_id=first_snap,
                last_snapshot_id=current_snapshot_id,
                previous_snapshot_id=previous_snapshot_id,
                snapshot_count=snap_count,
                consecutive_snapshot_count=consec_count,
                message_count_current=curr_prof.message_count,
                message_count_previous=prev_prof.message_count,
                distinct_sources_current=curr_prof.distinct_sources_count,
                distinct_sources_previous=prev_prof.distinct_sources_count,
                distinct_domains_current=curr_prof.distinct_domains_count,
                distinct_domains_previous=prev_prof.distinct_domains_count,
                priority_signal_current=curr_prof.priority_signal_score,
                priority_signal_previous=prev_prof.priority_signal_score,
                headline_claim_current=curr_prof.headline_claim,
                lineage_match_score=match_res.lineage_match_score,
                historical_narrative_ids=hist_ids,
                snapshot_history=snap_hist,
            )
            self.store.upsert_lineage(lineage)

            ev_id = f"ev_{current_snapshot_id}_{lid}_{ev_type.value}"
            events_to_record.append(
                LineageEvent(
                    event_id=ev_id,
                    lineage_id=lid,
                    snapshot_id=current_snapshot_id,
                    previous_snapshot_id=previous_snapshot_id,
                    event_type=ev_type,
                    timestamp=now_utc,
                    source_narrative_id=curr_id,
                    previous_narrative_id=prev_prof.narrative_id,
                    lineage_match_score=match_res.lineage_match_score,
                    match_evidence=match_res.match_evidence,
                    explanation=ev_explanation,
                )
            )

            matches_summary.append({
                "lineage_id": lid,
                "current_narrative_id": curr_id,
                "previous_narrative_id": prev_prof.narrative_id,
                "state": state.value,
                "score": match_res.lineage_match_score,
            })

        # Process unmatched new narratives
        for curr_id in unmatched_new:
            curr_prof = curr_by_id[curr_id]
            existing = self.store.get_lineage_by_narrative_id(curr_id, snapshot_id=current_snapshot_id)
            if existing:
                lid = existing.lineage_id
            else:
                lid = self.store.allocate_lineage_id()

            lineage = NarrativeLineage(
                lineage_id=lid,
                current_narrative_id=curr_id,
                state=LineageState.NEW,
                first_seen_at=curr_prof.first_observed_at,
                last_seen_at=curr_prof.last_observed_at,
                first_snapshot_id=current_snapshot_id,
                last_snapshot_id=current_snapshot_id,
                previous_snapshot_id=previous_snapshot_id,
                snapshot_count=1,
                consecutive_snapshot_count=1,
                message_count_current=curr_prof.message_count,
                message_count_previous=None,
                distinct_sources_current=curr_prof.distinct_sources_count,
                distinct_sources_previous=None,
                distinct_domains_current=curr_prof.distinct_domains_count,
                distinct_domains_previous=None,
                priority_signal_current=curr_prof.priority_signal_score,
                priority_signal_previous=None,
                headline_claim_current=curr_prof.headline_claim,
                lineage_match_score=None,
                historical_narrative_ids=[curr_id],
                snapshot_history={current_snapshot_id: curr_id},
            )
            self.store.upsert_lineage(lineage)

            ev_id = f"ev_{current_snapshot_id}_{lid}_created"
            events_to_record.append(
                LineageEvent(
                    event_id=ev_id,
                    lineage_id=lid,
                    snapshot_id=current_snapshot_id,
                    previous_snapshot_id=previous_snapshot_id,
                    event_type=LineageEventType.CREATED,
                    timestamp=now_utc,
                    source_narrative_id=curr_id,
                    explanation=f"New narrative cluster emerged in snapshot {current_snapshot_id}",
                )
            )
            new_count += 1

        # Process disappeared narratives
        disappeared_lids: list[str] = []
        for prev_id in unmatched_disappeared:
            prev_lineage = self.store.get_lineage_by_narrative_id(
                prev_id, snapshot_id=previous_snapshot_id
            ) or self.store.get_lineage_by_narrative_id(prev_id)
            if prev_lineage and prev_lineage.state != LineageState.DISAPPEARED:
                updated_lineage = NarrativeLineage(
                    lineage_id=prev_lineage.lineage_id,
                    current_narrative_id=None,  # No longer active
                    state=LineageState.DISAPPEARED,
                    first_seen_at=prev_lineage.first_seen_at,
                    last_seen_at=prev_lineage.last_seen_at,
                    first_snapshot_id=prev_lineage.first_snapshot_id,
                    last_snapshot_id=current_snapshot_id,
                    previous_snapshot_id=previous_snapshot_id,
                    snapshot_count=prev_lineage.snapshot_count,
                    consecutive_snapshot_count=0,
                    message_count_current=0,
                    message_count_previous=prev_lineage.message_count_current,
                    distinct_sources_current=0,
                    distinct_sources_previous=prev_lineage.distinct_sources_current,
                    distinct_domains_current=0,
                    distinct_domains_previous=prev_lineage.distinct_domains_current,
                    priority_signal_current=0.0,
                    priority_signal_previous=prev_lineage.priority_signal_current,
                    headline_claim_current=prev_lineage.headline_claim_current,
                    lineage_match_score=None,
                    historical_narrative_ids=prev_lineage.historical_narrative_ids,
                    snapshot_history=dict(prev_lineage.snapshot_history),
                )
                self.store.upsert_lineage(updated_lineage)

                ev_id = f"ev_{current_snapshot_id}_{prev_lineage.lineage_id}_disappeared"
                events_to_record.append(
                    LineageEvent(
                        event_id=ev_id,
                        lineage_id=prev_lineage.lineage_id,
                        snapshot_id=current_snapshot_id,
                        previous_snapshot_id=previous_snapshot_id,
                        event_type=LineageEventType.DISAPPEARED,
                        timestamp=now_utc,
                        previous_narrative_id=prev_id,
                        explanation=f"Narrative {prev_id} absent from snapshot {current_snapshot_id}",
                    )
                )
                disappeared_count += 1
                disappeared_lids.append(prev_lineage.lineage_id)

        # Idempotent write to disk
        self.store.record_events(events_to_record)
        self.store.save_state()

        return TemporalComparisonReport(
            from_snapshot_id=previous_snapshot_id,
            to_snapshot_id=current_snapshot_id,
            continuing_count=continuing_count,
            new_count=new_count,
            weakened_count=weakened_count,
            disappeared_count=disappeared_count,
            reappeared_count=reappeared_count,
            total_lineages_tracked=len(self.store.lineages),
            matches=matches_summary,
            unmatched_new_narrative_ids=unmatched_new,
            disappeared_lineage_ids=disappeared_lids,
        )
