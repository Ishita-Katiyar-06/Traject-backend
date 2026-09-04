import json
from enum import StrEnum
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SentimentLabel(StrEnum):
    """Standardized three-class sentiment categories for TRAJECT analytics."""
    NEGATIVE = "negative"
    NEUTRAL = "neutral"
    POSITIVE = "positive"


class SentimentPrediction(BaseModel):
    """Output prediction for a single social-media text snippet."""
    model_config = ConfigDict(extra="forbid", frozen=True)

    label: SentimentLabel
    confidence: float
    scores: dict[str, float]
    model_id: str


class ClassificationMetrics(BaseModel):
    """Evaluation metrics for a single sentiment class."""
    model_config = ConfigDict(extra="forbid", frozen=True)

    precision: float
    recall: float
    f1: float
    support: int


class ConfusionMatrix(BaseModel):
    """Square confusion matrix representing actual vs predicted counts."""
    model_config = ConfigDict(extra="forbid", frozen=True)

    labels: list[str] = Field(
        default_factory=lambda: [SentimentLabel.NEGATIVE.value, SentimentLabel.NEUTRAL.value, SentimentLabel.POSITIVE.value]
    )
    matrix: dict[str, dict[str, int]] = Field(default_factory=dict)


class PerExamplePrediction(BaseModel):
    """Individual prediction result matched against ground truth for qualitative error analysis."""
    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str
    text: str
    gold_label: str
    predicted_label: str
    confidence: float
    scores: dict[str, float]
    correct: bool
    model_id: str


class EvaluationResult(BaseModel):
    """Comprehensive, typed evaluation report for a candidate sentiment model."""
    model_config = ConfigDict(extra="forbid")

    model_id: str
    model_revision: str | None = None
    evaluation_dataset: str = ""
    sample_count: int = 0

    accuracy: float = 0.0
    macro_f1: float = 0.0

    per_class: dict[str, ClassificationMetrics] = Field(default_factory=dict)
    confusion_matrix: ConfusionMatrix = Field(default_factory=ConfusionMatrix)

    device: str = "cpu"
    library_versions: dict[str, str] = Field(default_factory=dict)
    notes: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert evaluation result to primitive dictionary."""
        return self.model_dump()

    def save_json(self, output_path: Path | str, overwrite: bool = False, indent: int = 2) -> None:
        """Write evaluation report to formatted JSON with overwrite guard.
        
        Args:
            output_path: Target JSON destination path.
            overwrite: Whether to overwrite existing file.
            indent: Indentation for formatting.
            
        Raises:
            FileExistsError: If destination exists and overwrite is False.
        """
        path = Path(output_path).resolve()
        if path.exists() and not overwrite:
            raise FileExistsError(
                f"Evaluation report destination already exists: {path}\n"
                "Use overwrite=True or --overwrite to replace existing file."
            )

        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=indent)
