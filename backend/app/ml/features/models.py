from datetime import datetime, timezone
from enum import StrEnum
import json
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SocialEntityCategory(StrEnum):
    """Categorization of extracted social and gazetteer entities."""
    HASHTAG = "hashtag"
    HANDLE = "handle"
    DOMAIN = "domain"
    GAZETTEER_GEO = "gazetteer_geo"
    GAZETTEER_ORG = "gazetteer_org"


class TopicEntity(BaseModel):
    """Normalized entity observed within a topic cluster."""
    model_config = ConfigDict(extra="forbid", frozen=True)

    text: str = Field(description="Normalized entity token, handle, or domain")
    category: SocialEntityCategory
    frequency: int = Field(ge=1, description="Total occurrences across topic messages")
    sample_message_ids: list[str] = Field(
        default_factory=list,
        description="Sample canonical message IDs where entity was observed"
    )


class TopicEngagementFeatures(BaseModel):
    """Deterministic engagement totals and mathematical ratios."""
    model_config = ConfigDict(extra="forbid", frozen=True)

    total_views: int = Field(default=0, ge=0)
    total_forwards: int = Field(default=0, ge=0)
    total_replies: int = Field(default=0, ge=0)
    total_reactions: int = Field(default=0, ge=0)

    forward_to_view_ratio: float = Field(
        default=0.0,
        ge=0.0,
        description="sum(forwards) / max(sum(views), 1)"
    )
    reply_to_view_ratio: float = Field(
        default=0.0,
        ge=0.0,
        description="sum(replies) / max(sum(views), 1)"
    )
    reaction_to_view_ratio: float = Field(
        default=0.0,
        ge=0.0,
        description="sum(reactions) / max(sum(views), 1)"
    )
    emoji_polarity_score: float = Field(
        default=0.0,
        ge=-1.0,
        le=1.0,
        description="Deterministic emoji heuristic: (positive - negative) / max(total_reactions, 1)"
    )
    peak_views_message_id: str | None = Field(
        default=None,
        description="Canonical ID of message with highest view count in the topic"
    )


class TopicPropagationFeatures(BaseModel):
    """Deterministic platform-observed forwarding and syndication signals."""
    model_config = ConfigDict(extra="forbid", frozen=True)

    observed_forward_count: int = Field(
        default=0,
        ge=0,
        description="Count of messages with is_forward=True and origin_source_id present"
    )
    direct_forward_ratio: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="observed_forward_count / total_topic_messages"
    )
    unique_origin_channels: list[str] = Field(
        default_factory=list,
        description="Distinct origin channels identified from forward metadata"
    )
    unique_amplifying_channels: list[str] = Field(
        default_factory=list,
        description="Distinct verified broadcasting channels that re-broadcasted forwarded content"
    )
    cross_channel_observed_spread: int = Field(
        default=0,
        ge=0,
        description="Count of forwards where known broadcasting_channel_id differs from origin_channel_id"
    )
    uncredited_syndication_count: int = Field(
        default=0,
        ge=0,
        description="Count of near-duplicate messages (similarity >= threshold) without forward tags"
    )


class TopicTemporalFeatures(BaseModel):
    """Deterministic temporal metrics and publication cadence signals."""
    model_config = ConfigDict(extra="forbid", frozen=True)

    first_published_at: datetime = Field(description="Earliest message publication timestamp (UTC)")
    last_published_at: datetime = Field(description="Latest message publication timestamp (UTC)")
    timespan_seconds: float = Field(ge=0.0, description="Total elapsed seconds between first and last message")
    messages_per_hour: float | None = Field(
        default=None,
        ge=0.0,
        description="total_messages / timespan_hours, or None if single message or 0s timespan"
    )

    peak_window_utc: str = Field(description="ISO 8601 hour window with maximum message count (e.g. 2026-09-02T19:00)")
    peak_window_message_count: int = Field(ge=0)
    burstiness_index: float | None = Field(
        default=None,
        ge=-1.0,
        le=1.0,
        description="Normalized dispersion of inter-arrival times: (sigma - mu) / (sigma + mu), or None if <3 messages or 0s timespan"
    )
    channel_entry_velocity: float | None = Field(
        default=None,
        ge=0.0,
        description="Distinct new channels publishing per hour, or None if single message or 0s timespan"
    )


class EnrichedTopicCandidate(BaseModel):
    """Unified analytical object coupling a 4E TopicRecord with its 4F contextual features."""
    model_config = ConfigDict(extra="forbid")

    topic_id: str = Field(description="Neutral topic identifier linking to 4E TopicRecord (e.g. topic_000)")
    message_count: int = Field(ge=1)
    percentage_of_dataset: float = Field(ge=0.0, le=100.0)
    representative_keywords: list[str] = Field(default_factory=list)

    entities: list[TopicEntity] = Field(default_factory=list)
    engagement: TopicEngagementFeatures
    propagation: TopicPropagationFeatures
    temporal: TopicTemporalFeatures


class TopicEnrichmentResult(BaseModel):
    """Complete diagnostic and analytical report of topic feature enrichment."""
    model_config = ConfigDict(extra="forbid")

    dataset_source: str
    total_messages_analyzed: int = Field(ge=0)
    total_topics_enriched: int = Field(ge=0)
    enriched_topics: list[EnrichedTopicCandidate] = Field(default_factory=list)
    unassigned_noise_count: int = Field(ge=0)

    syndication_similarity_threshold: float = Field(default=0.92, ge=0.5, le=1.0)
    enrichment_latency_seconds: float = Field(default=0.0, ge=0.0, description="Time spent extracting 4F topic features")
    topic_discovery_latency_seconds: float | None = Field(default=None, ge=0.0, description="Time spent in 4E embedding inference")
    clustering_latency_seconds: float | None = Field(default=None, ge=0.0, description="Time spent in 4E clustering")
    total_pipeline_latency_seconds: float | None = Field(default=None, ge=0.0, description="Total wall-clock pipeline time")
    execution_time_seconds: float = Field(default=0.0, ge=0.0, description="Alias for backward compatibility")
    created_at_utc: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def to_dict(self) -> dict[str, Any]:
        """Serialize topic enrichment report to JSON-serializable dictionary."""
        return self.model_dump(mode="json")

    def save_json(self, output_path: Path | str, overwrite: bool = False, indent: int = 2) -> None:
        """Persist topic enrichment report to JSON with overwrite guard."""
        path = Path(output_path).resolve()
        if path.exists() and not overwrite:
            raise FileExistsError(
                f"Topic enrichment destination already exists: {path}\n"
                "Use overwrite=True or --overwrite to replace existing file."
            )

        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=indent, ensure_ascii=False)

