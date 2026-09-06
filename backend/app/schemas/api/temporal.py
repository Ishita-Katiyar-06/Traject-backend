"""Typed FastAPI response schemas for Temporal Narrative Lineage and Monitoring (Milestone 6E)."""

from typing import Any
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.api.common import PaginationMeta
from app.temporal.models import LineageEvent, LineageState, NarrativeLineage, TemporalSnapshotMetadata


class TemporalStatusResponse(BaseModel):
    """Unified operational health and temporal lineage status."""
    model_config = ConfigDict(extra="forbid")

    # Operational Health
    collection_status: str = Field(description="Operational collection status (e.g. 'idle', 'active')")
    last_collection_run: str | None = Field(description="Timestamp of latest incremental collection run")
    last_successful_collection: str | None = Field(description="Timestamp of latest successful collection run")
    cumulative_corpus_count: int = Field(description="Total canonical records in corpus Parquet dataset")
    latest_corpus_snapshot_id: str | None = Field(description="Snapshot ID of underlying corpus")

    # Analytics Freshness
    latest_analytics_snapshot_id: str | None = Field(description="Snapshot ID of loaded analytics")
    analytics_generated_at_utc: str | None = Field(description="Timestamp of latest analytics generation")
    analytics_current: bool = Field(description="True if analytics reflect latest corpus snapshot")
    stale_analytics_reason: str | None = Field(default=None, description="Explanation if analytics are stale")

    # Lineage Statistics
    total_lineages_tracked: int = Field(ge=0, description="Total active and historical lineages")
    active_lineages_count: int = Field(ge=0, description="Count of lineages currently active in latest snapshot")
    lineages_by_state: dict[str, int] = Field(default_factory=dict, description="Distribution of lineages across states")
    last_temporal_update: str | None = Field(default=None, description="Timestamp of latest temporal comparison")


class NarrativeLineageSummary(BaseModel):
    """Compact summary of a temporal lineage for list responses."""
    model_config = ConfigDict(extra="forbid")

    lineage_id: str
    current_narrative_id: str | None
    state: LineageState
    first_seen_at: str
    last_seen_at: str
    snapshot_count: int
    consecutive_snapshot_count: int
    message_count_current: int
    message_count_previous: int | None
    priority_signal_current: float
    headline_claim_current: str
    lineage_match_score: float | None


class LineageListResponse(BaseModel):
    """Paginated response for GET /api/v1/temporal/narratives."""
    model_config = ConfigDict(extra="forbid")

    data: list[NarrativeLineageSummary]
    meta: PaginationMeta


class NarrativeLineageDetailResponse(BaseModel):
    """Comprehensive detail response for GET /api/v1/temporal/narratives/{lineage_id}."""
    model_config = ConfigDict(extra="forbid")

    lineage: NarrativeLineage
    events: list[LineageEvent]


class TemporalSnapshotListResponse(BaseModel):
    """Response for GET /api/v1/temporal/snapshots."""
    model_config = ConfigDict(extra="forbid")

    snapshots: list[TemporalSnapshotMetadata]
    total_snapshots: int
