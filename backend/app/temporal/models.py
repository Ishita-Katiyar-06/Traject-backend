"""Domain models and schemas for Temporal Narrative Lineage (Milestone 6E).

Tracks narrative evolution across immutable analytics snapshots:
NEW, PERSISTING, WEAKENING, DISAPPEARED, REAPPEARED.
"""

from datetime import datetime, timezone
from enum import StrEnum
from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class LineageState(StrEnum):
    """Deterministic operational state of a narrative lineage in the latest evaluated snapshot."""
    NEW = "new"                  # Narrative appeared for the first time
    PERSISTING = "persisting"    # Narrative continues across consecutive snapshots with steady/growing evidence
    WEAKENING = "weakening"      # Narrative continues, but observable volume/coverage decreased below threshold
    DISAPPEARED = "disappeared"  # Narrative existed in previous snapshot but is absent in the current snapshot
    REAPPEARED = "reappeared"    # Narrative was previously disappeared and returned in a subsequent snapshot


class LineageEventType(StrEnum):
    """Lifecycle transition event type emitted during temporal comparison."""
    CREATED = "created"          # New lineage instantiated
    CONTINUED = "continued"      # Maintained continuity in consecutive snapshot
    WEAKENED = "weakened"        # Observable metrics dropped below threshold
    DISAPPEARED = "disappeared"  # Absent from current snapshot
    REAPPEARED = "reappeared"    # Re-observed after disappearance


class LineageEvent(BaseModel):
    """Audit-ready, immutable record of a temporal narrative transition."""
    model_config = ConfigDict(extra="forbid")

    event_id: str = Field(description="Unique deterministic transition event identifier")
    lineage_id: str = Field(description="Stable cross-snapshot lineage identifier (e.g. lineage_000001)")
    snapshot_id: str = Field(description="Snapshot ID where this event occurred")
    previous_snapshot_id: str | None = Field(default=None, description="Previous snapshot ID if applicable")
    event_type: LineageEventType = Field(description="Type of transition event")
    timestamp: str = Field(description="ISO-8601 UTC timestamp when event was recorded")
    source_narrative_id: str | None = Field(default=None, description="Snapshot-local narrative ID in current snapshot")
    previous_narrative_id: str | None = Field(default=None, description="Snapshot-local narrative ID in previous snapshot")
    lineage_match_score: float | None = Field(default=None, ge=0.0, le=1.0, description="Deterministic match similarity score")
    match_evidence: dict[str, Any] = Field(default_factory=dict, description="Observed overlap factors (messages, channels, lexical)")
    explanation: str = Field(description="Natural-language observational explanation of the state change")


class NarrativeLineage(BaseModel):
    """Persistent representation of an evolving narrative lineage across analytical snapshots."""
    model_config = ConfigDict(extra="forbid")

    lineage_id: str = Field(description="Canonical temporal lineage identifier (e.g. lineage_000001)")
    current_narrative_id: str | None = Field(default=None, description="Snapshot-local narrative ID in latest active snapshot")
    state: LineageState = Field(description="Current temporal state")
    first_seen_at: str = Field(description="Earliest observation timestamp (ISO-8601 UTC)")
    last_seen_at: str = Field(description="Latest observation timestamp (ISO-8601 UTC)")
    first_snapshot_id: str = Field(description="First snapshot where this lineage appeared")
    last_snapshot_id: str = Field(description="Most recent snapshot evaluated for this lineage")
    previous_snapshot_id: str | None = Field(default=None, description="Immediately preceding snapshot ID")
    snapshot_count: int = Field(default=1, ge=1, description="Total number of snapshots where narrative was present")
    consecutive_snapshot_count: int = Field(default=1, ge=0, description="Consecutive snapshots where narrative was present")

    # Observational metric tracking (current vs previous)
    message_count_current: int = Field(ge=0, description="Message count in latest snapshot")
    message_count_previous: int | None = Field(default=None, ge=0, description="Message count in previous snapshot")
    distinct_sources_current: int = Field(ge=0, description="Distinct sources in latest snapshot")
    distinct_sources_previous: int | None = Field(default=None, ge=0, description="Distinct sources in previous snapshot")
    distinct_domains_current: int = Field(ge=0, description="Distinct domains in latest snapshot")
    distinct_domains_previous: int | None = Field(default=None, ge=0, description="Distinct domains in previous snapshot")
    priority_signal_current: float = Field(ge=0.0, le=1.0, description="4G Priority Signal Score in latest snapshot")
    priority_signal_previous: float | None = Field(default=None, ge=0.0, le=1.0, description="Priority score in previous snapshot")

    headline_claim_current: str = Field(description="Headline framing claim in latest snapshot")
    lineage_match_score: float | None = Field(default=None, ge=0.0, le=1.0, description="Similarity score to previous snapshot match")
    historical_narrative_ids: list[str] = Field(default_factory=list, description="Ordered list of snapshot-local narrative IDs")
    snapshot_history: dict[str, str] = Field(default_factory=dict, description="Mapping from snapshot_id to snapshot-local narrative_id")


class TemporalSnapshotMetadata(BaseModel):
    """Metadata describing an immutable analytics snapshot."""
    model_config = ConfigDict(extra="forbid")

    snapshot_id: str = Field(description="Unique snapshot identifier (e.g. snapshot_20260906_193932)")
    collection_run_id: str | None = Field(default=None, description="Linked incremental collection run ID")
    corpus_snapshot_id: str | None = Field(default=None, description="Linked corpus snapshot identifier")
    generated_at_utc: str = Field(description="ISO-8601 UTC timestamp of analytics generation")
    corpus_size: int = Field(ge=0, description="Total canonical records in corpus during this run")
    narrative_count: int = Field(ge=0, description="Total narrative candidates formed in this snapshot")
    topic_count: int = Field(ge=0, description="Total topic clusters formed in this snapshot")
    artifact_path: str = Field(description="Path to the analytics artifact file on disk")


class TemporalComparisonReport(BaseModel):
    """Summary of deterministic comparison between two analytics snapshots."""
    model_config = ConfigDict(extra="forbid")

    from_snapshot_id: str
    to_snapshot_id: str
    compared_at_utc: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    continuing_count: int = Field(ge=0)
    new_count: int = Field(ge=0)
    weakened_count: int = Field(ge=0)
    disappeared_count: int = Field(ge=0)
    reappeared_count: int = Field(ge=0)
    total_lineages_tracked: int = Field(ge=0)
    matches: list[dict[str, Any]] = Field(default_factory=list)
    unmatched_new_narrative_ids: list[str] = Field(default_factory=list)
    disappeared_lineage_ids: list[str] = Field(default_factory=list)
