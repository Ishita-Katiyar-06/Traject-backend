from datetime import datetime, timezone
from enum import StrEnum
import json
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class PriorityTier(StrEnum):
    """Operational triage priority tiers for analyst attention."""
    CRITICAL = "critical"    # Score >= 0.75: Strong multi-channel spread, burstiness/syndication signals, high observed reach
    HIGH = "high"            # Score 0.55 - 0.74: Substantial momentum, noticeable friction or coordination signals
    ELEVATED = "elevated"    # Score 0.35 - 0.54: Emerging presence or moderate reach
    ROUTINE = "routine"      # Score < 0.35: Baseline organic discourse


class EvidenceDensityTier(StrEnum):
    """Evidence-density heuristic to distinguish well-observed samples from sparse observations.
    
    Note: Represents sample density and data coverage, not statistical confidence.
    """
    HIGH = "high"            # >= 10 messages across >= 2 channels with timespan > 0
    MODERATE = "moderate"    # 3 - 9 messages, multiple observations
    SPARSE = "sparse"        # 1 - 2 messages or zero timespan duration


class NarrativeDataCoverage(BaseModel):
    """Data quality and evidence-density metadata enabling analysts to assess observation depth."""
    model_config = ConfigDict(extra="forbid", frozen=True)

    message_count: int = Field(ge=1, description="Total messages supporting this candidate")
    channel_count: int = Field(ge=1, description="Distinct author/channel accounts observed")
    timespan_seconds: float = Field(ge=0.0, description="Duration from first to last observation")
    has_views_coverage: bool = Field(description="True if views_count is reported on >=50% of messages")
    has_reactions_coverage: bool = Field(description="True if reactions dictionary is present on >=50% of messages")
    evidence_density: EvidenceDensityTier = Field(description="Sample density heuristic tier (high, moderate, sparse)")
    data_quality_notes: list[str] = Field(default_factory=list, description="Observations regarding sample size and field availability")


class NarrativeSubScores(BaseModel):
    """Explainable component breakdown of the composite priority score (each strictly in [0.0, 1.0])."""
    model_config = ConfigDict(extra="forbid", frozen=True)

    spread_score: float = Field(ge=0.0, le=1.0, description="Observed multi-channel propagation and forward mobility")
    coordination_score: float = Field(ge=0.0, le=1.0, description="Potential synchronization signals: uncredited syndication and arrival burstiness")
    reach_score: float = Field(ge=0.0, le=1.0, description="Observed exposure: log-scaled views and forward-to-view ratio")
    friction_score: float = Field(ge=0.0, le=1.0, description="Observed polarization: text negativity, negative emojis, reply friction")


class PotentialCoordinationSignals(BaseModel):
    """Auditable heuristic signals indicating potential synchronization patterns (never proof of CIB)."""
    model_config = ConfigDict(extra="forbid", frozen=True)

    potential_syndication_spike: bool = Field(description="Uncredited syndication exceeds 25% of non-forward messages")
    potential_temporal_burst: bool = Field(description="Burstiness index > +0.20 across >=2 broadcasting channels")
    potential_rapid_channel_entry: bool = Field(description="Channel entry velocity > 10.0 distinct channels/hour")
    potential_cross_channel_cascade: bool = Field(description="Cross-channel spread >= 2 verified broadcasting channels")


class NarrativeSentimentProfile(BaseModel):
    """Integrated textual sentiment distribution (batched inference over all messages) and emoji polarity."""
    model_config = ConfigDict(extra="forbid", frozen=True)

    is_available: bool = Field(description="True if sentiment model inference was executed")
    total_text_messages_evaluated: int = Field(ge=0, description="Count of text-bearing messages passed to model")
    text_positive_ratio: float | None = Field(default=None, ge=0.0, le=1.0, description="Ratio of positive text predictions (None if unavailable)")
    text_neutral_ratio: float | None = Field(default=None, ge=0.0, le=1.0, description="Ratio of neutral text predictions (None if unavailable)")
    text_negative_ratio: float | None = Field(default=None, ge=0.0, le=1.0, description="Ratio of negative text predictions (None if unavailable)")
    emoji_polarity_score: float = Field(ge=-1.0, le=1.0, description="Deterministic emoji polarity heuristic from 4F")
    sentiment_model_id: str | None = Field(default=None, description="Pretrained model identifier used for inference")


class NarrativeCandidate(BaseModel):
    """Elevated analytical candidate synthesized from an EnrichedTopicCandidate."""
    model_config = ConfigDict(extra="forbid")

    narrative_id: str = Field(description="Unique narrative candidate identifier (e.g. narrative_001)")
    promoted_from_topic_id: str = Field(description="Underlying 4E Topic cluster ID (e.g. topic_000)")
    headline_claim: str = Field(description="Deterministic framing composed of key entities and discriminative keywords")
    narrative_name: str | None = Field(default=None, description="Human-readable title/name summarizing central subject")
    narrative_summary: str | None = Field(default=None, description="Short evidence-grounded summary of what this narrative represents")

    priority_signal_score: float = Field(ge=0.0, le=1.0, description="Explainable composite Priority/Narrative Signal Score")
    priority_tier: PriorityTier
    sub_scores: NarrativeSubScores
    coordination_signals: PotentialCoordinationSignals
    data_coverage: NarrativeDataCoverage
    sentiment_profile: NarrativeSentimentProfile

    key_entities: list[str] = Field(default_factory=list, description="Top observed entities (hashtags, handles, gazetteers)")
    broadcasting_channels: list[str] = Field(default_factory=list, description="Verified channel identifiers publishing or re-broadcasting")
    origin_channels: list[str] = Field(default_factory=list, description="Distinct root origin channels identified from forward chains")
    representative_message_excerpts: list[str] = Field(default_factory=list, description="Excerpts of representative centroid messages")

    first_observed_at: datetime
    last_observed_at: datetime
    audit_rationale: list[str] = Field(default_factory=list, description="Audit-ready natural-language factor attributions")


class NarrativeAssessmentReport(BaseModel):
    """Complete analytical triage report for an ingested social media dataset."""
    model_config = ConfigDict(extra="forbid")

    dataset_source: str
    total_messages_analyzed: int = Field(ge=0)
    total_narrative_candidates: int = Field(ge=0)
    candidates_by_tier: dict[str, int] = Field(default_factory=dict)
    narrative_candidates: list[NarrativeCandidate] = Field(default_factory=list)
    unassigned_noise_count: int = Field(ge=0)

    scoring_weights: dict[str, float] = Field(default_factory=dict)
    enrichment_time_seconds: float = 0.0
    sentiment_inference_seconds: float = 0.0
    total_pipeline_time_seconds: float = 0.0
    created_at_utc: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict[str, Any]:
        """Serialize report to primitive JSON-serializable dictionary."""
        return self.model_dump(mode="json")

    def save_json(self, output_path: Path | str, overwrite: bool = False, indent: int = 2) -> None:
        """Persist report to JSON file with overwrite protection guard."""
        path = Path(output_path).resolve()
        if path.exists() and not overwrite:
            raise FileExistsError(
                f"Narrative assessment destination already exists: {path}\n"
                "Use overwrite=True or --overwrite to replace existing file."
            )
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=indent, ensure_ascii=False)
