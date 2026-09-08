from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

from app.ml.narratives.models import (
    EvidenceDensityTier,
    NarrativeCandidate,
    NarrativeSubScores,
    PriorityTier,
)
from app.schemas.api.common import PaginationMeta


class NarrativeSummaryResponse(BaseModel):
    """Compact descriptor for a narrative candidate in triage queue lists."""
    model_config = ConfigDict(extra="forbid")

    narrative_id: str = Field(description="Unique narrative identifier (e.g. narrative_000)")
    promoted_from_topic_id: str = Field(description="Underlying topic cluster identifier")
    headline_claim: str = Field(description="Deterministic entity-keyword framing claim")
    narrative_name: str | None = Field(default=None, description="Human-readable title/name summarizing central subject")
    narrative_summary: str | None = Field(default=None, description="Short evidence-grounded summary of what this narrative represents")
    priority_signal_score: float = Field(ge=0.0, le=1.0, description="Composite priority score")
    priority_tier: PriorityTier = Field(description="Triage priority classification tier")
    sub_scores: NarrativeSubScores = Field(description="Explainable breakdown of 4 sub-scores")
    has_coordination_signals: bool = Field(description="True if any potential coordination heuristic was triggered")
    evidence_density: EvidenceDensityTier = Field(description="Observational sample density tier (high, moderate, sparse)")
    message_count: int = Field(ge=1, description="Number of supporting messages in this narrative cluster")
    first_observed_at: datetime = Field(description="Earliest publication timestamp in cluster (UTC)")
    last_observed_at: datetime = Field(description="Latest publication timestamp in cluster (UTC)")

    # Milestone 6C: Validation and Cross-Source Evidence (Backward-compatible with defaults)
    distinct_sources_count: int = Field(default=1, ge=1, description="Number of distinct broadcasting sources")
    distinct_domains_count: int = Field(default=1, ge=0, description="Number of distinct strategic domains represented")
    is_cross_source: bool = Field(default=False, description="True if observed across >= 2 distinct sources")
    is_cross_domain: bool = Field(default=False, description="True if observed across >= 2 distinct domains")
    domains_represented: list[str] = Field(default_factory=list, description="Strategic domains represented")
    broadcasting_channels: list[str] = Field(default_factory=list, description="Broadcasting channel identifiers")
    quality_classification: str = Field(default="moderate_evidence", description="Observational evidence tier")

    # Milestone: Multi-Perspective Narrative Intelligence (additive & backward compatible)
    viewpoint_stance: str | None = Field(default=None, description="Internal viewpoint stance: supportive, critical, skeptical, informational")
    narrative_rank: int = Field(default=1, ge=1, description="Rank within parent trend")
    is_dominant: bool = Field(default=True, description="True if dominant viewpoint")
    evidence_strength_score: float | None = Field(default=None, ge=0.0, le=1.0)
    sibling_narrative_ids: list[str] = Field(default_factory=list)


class NarrativeListResponse(BaseModel):
    """Paginated collection response for GET /api/v1/narratives."""
    model_config = ConfigDict(extra="forbid")

    data: list[NarrativeSummaryResponse]
    meta: PaginationMeta


class NarrativeDetailData(NarrativeCandidate):
    """Extended narrative candidate model exposing deterministic quality and cross-source evidence."""
    model_config = ConfigDict(extra="forbid")

    distinct_sources_count: int = Field(default=1, ge=1, description="Number of distinct broadcasting sources")
    distinct_domains_count: int = Field(default=1, ge=0, description="Number of distinct strategic domains represented")
    is_cross_source: bool = Field(default=False, description="True if observed across >= 2 distinct sources")
    is_cross_domain: bool = Field(default=False, description="True if observed across >= 2 distinct domains")
    domains_represented: list[str] = Field(default_factory=list, description="Strategic domains represented")
    quality_classification: str = Field(default="moderate_evidence", description="Observational evidence tier")
    validation_notes: list[str] = Field(default_factory=list, description="Deterministic validation notes")


class NarrativeDetailResponse(BaseModel):
    """Detailed explainable narrative candidate response for GET /api/v1/narratives/{id}."""
    model_config = ConfigDict(extra="forbid")

    data: NarrativeDetailData | NarrativeCandidate
