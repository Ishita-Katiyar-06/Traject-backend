from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class TopicKeyword(BaseModel):
    """Representative keyword extracted from cluster vocabulary with importance weight."""
    model_config = ConfigDict(extra="forbid", frozen=True)

    keyword: str
    score: float = Field(ge=0.0, description="Normalized TF-IDF or frequency importance score")


class TopicRecord(BaseModel):
    """Structured descriptor for a semantically cohesive topic cluster."""
    model_config = ConfigDict(extra="forbid")

    topic_id: str = Field(description="Neutral topic identifier (e.g. topic_000)")
    cluster_label: int = Field(ge=0, description="Internal integer cluster index from HDBSCAN")
    message_count: int = Field(ge=1, description="Total messages assigned to this topic")
    percentage_of_dataset: float = Field(ge=0.0, le=100.0, description="Percentage of total input dataset")
    representative_keywords: list[TopicKeyword] = Field(default_factory=list)
    representative_message_ids: list[str] = Field(
        default_factory=list,
        description="Canonical IDs of messages closest to cluster centroid"
    )
    sample_message_ids: list[str] = Field(
        default_factory=list,
        description="All canonical IDs assigned to this topic"
    )


class ClusteringConfig(BaseModel):
    """Parameters governing semantic vector clustering."""
    model_config = ConfigDict(extra="forbid", frozen=True)

    algorithm: str = "HDBSCAN"
    min_cluster_size: int = Field(default=2, ge=2)
    min_samples: int | None = Field(default=1, ge=1)
    metric: str = "euclidean"
    cluster_selection_method: str = "eom"


class TopicDiscoveryResult(BaseModel):
    """Complete, serializable result report of an unsupervised topic discovery run."""
    model_config = ConfigDict(extra="forbid")

    model_id: str = Field(description="Pretrained sentence embedding model identifier")
    embedding_dimension: int = Field(gt=0)
    total_input_messages: int = Field(ge=0)
    clustered_messages: int = Field(ge=0)
    noise_messages: int = Field(ge=0)
    number_of_topics: int = Field(ge=0)

    topic_records: list[TopicRecord] = Field(default_factory=list)
    noise_message_ids: list[str] = Field(default_factory=list)
    clustering_config: ClusteringConfig

    load_time_seconds: float = 0.0
    embedding_time_seconds: float = 0.0
    clustering_time_seconds: float = 0.0
    total_time_seconds: float = 0.0
    silhouette_score: float | None = None
    created_at_utc: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def to_dict(self) -> dict[str, Any]:
        """Serialize topic discovery report to primitive dictionary."""
        return self.model_dump()

    def save_json(self, output_path: Path | str, overwrite: bool = False, indent: int = 2) -> None:
        """Persist topic discovery summary to JSON with overwrite guard."""
        path = Path(output_path).resolve()
        if path.exists() and not overwrite:
            raise FileExistsError(
                f"Topic discovery report destination already exists: {path}\n"
                "Use overwrite=True or --overwrite to replace existing file."
            )

        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=indent, ensure_ascii=False)
