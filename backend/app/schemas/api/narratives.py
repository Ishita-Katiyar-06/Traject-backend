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
    priority_signal_score: float = Field(ge=0.0, le=1.0, description="Composite priority score")
    priority_tier: PriorityTier = Field(description="Triage priority classification tier")
    sub_scores: NarrativeSubScores = Field(description="Explainable breakdown of 4 sub-scores")
    has_coordination_signals: bool = Field(description="True if any potential coordination heuristic was triggered")
    evidence_density: EvidenceDensityTier = Field(description="Observational sample density tier (high, moderate, sparse)")
    message_count: int = Field(ge=1, description="Number of supporting messages in this narrative cluster")
    first_observed_at: datetime = Field(description="Earliest publication timestamp in cluster (UTC)")
    last_observed_at: datetime = Field(description="Latest publication timestamp in cluster (UTC)")


class NarrativeListResponse(BaseModel):
    """Paginated collection response for GET /api/v1/narratives."""
    model_config = ConfigDict(extra="forbid")

    data: list[NarrativeSummaryResponse]
    meta: PaginationMeta


class NarrativeDetailResponse(BaseModel):
    """Detailed explainable narrative candidate response for GET /api/v1/narratives/{id}."""
    model_config = ConfigDict(extra="forbid")

    data: NarrativeCandidate
