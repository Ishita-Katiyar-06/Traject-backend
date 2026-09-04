import json
import logging
import time
from pathlib import Path
from typing import Any, Sequence

from pydantic import BaseModel, ConfigDict, Field

from app.ml.sentiment.evaluation import compute_classification_metrics, load_evaluation_dataset
from app.ml.sentiment.inference import SentimentModelAdapter
from app.ml.sentiment.models import (
    ClassificationMetrics,
    ConfusionMatrix,
    SentimentLabel,
    SentimentPrediction,
)

logger = logging.getLogger("traject.ml.sentiment.comparison")


class LanguageMetrics(BaseModel):
    """Sub-benchmark metrics partitioned by specific language code."""
    model_config = ConfigDict(extra="forbid", frozen=True)

    language: str
    sample_count: int
    accuracy: float
    macro_f1: float
    per_class: dict[str, ClassificationMetrics]


class ModelBenchmarkSummary(BaseModel):
    """Holistic performance and quality profile for a candidate sentiment model."""
    model_config = ConfigDict(extra="forbid")

    model_id: str
    sample_count: int
    accuracy: float
    macro_f1: float
    per_class: dict[str, ClassificationMetrics]
    confusion_matrix: ConfusionMatrix
    language_metrics: dict[str, LanguageMetrics]

    load_time_seconds: float = 0.0
    warm_inference_seconds: float = 0.0
    throughput_samples_per_sec: float = 0.0
    model_disk_size_mb: float = 0.0


class SentimentModelComparison(BaseModel):
    """Comprehensive comparative evaluation between English and Multilingual models."""
    model_config = ConfigDict(extra="forbid")

    benchmark_dataset: str
    english_model: ModelBenchmarkSummary
    multilingual_model: ModelBenchmarkSummary

    delta_accuracy: float = Field(
        description="multilingual_accuracy - english_accuracy (positive indicates multilingual advantage)"
    )
    delta_macro_f1: float = Field(
        description="multilingual_macro_f1 - english_macro_f1"
    )
    language_deltas: dict[str, dict[str, float]] = Field(
        default_factory=dict,
        description="Per-language delta breakdown (accuracy and macro F1)"
    )

    recommendation: str
    recommendation_reason: str
    limitations: str

    def to_dict(self) -> dict[str, Any]:
        """Serialize comparison report to primitive dictionary."""
        return self.model_dump()

    def save_json(self, output_path: Path | str, overwrite: bool = False, indent: int = 2) -> None:
        """Persist comparison report to JSON with overwrite guard."""
        path = Path(output_path).resolve()
        if path.exists() and not overwrite:
            raise FileExistsError(
                f"Comparison report destination already exists: {path}\n"
                "Use overwrite=True or --overwrite to replace existing file."
            )

        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=indent)


def compute_language_wise_metrics(
    examples: Sequence[dict[str, Any]],
    predictions: Sequence[SentimentPrediction],
) -> dict[str, LanguageMetrics]:
    """Compute separate accuracy and metrics for each language in the evaluation dataset.
    
    Args:
        examples: Benchmark records containing 'language' and 'label'.
        predictions: Model predictions matching examples order.
        
    Returns:
        dict[str, LanguageMetrics]: Metrics mapped by ISO language code.
    """
    by_lang: dict[str, list[tuple[str, str]]] = {}
    for ex, pred in zip(examples, predictions):
        lang = str(ex.get("language", "unknown")).lower()
        by_lang.setdefault(lang, []).append((ex["label"], pred.label.value))

    results: dict[str, LanguageMetrics] = {}
    for lang, pairs in sorted(by_lang.items()):
        golds = [p[0] for p in pairs]
        preds = [p[1] for p in pairs]
        acc, macro_f1, per_class, _ = compute_classification_metrics(golds, preds)
        results[lang] = LanguageMetrics(
            language=lang,
            sample_count=len(pairs),
            accuracy=acc,
            macro_f1=macro_f1,
            per_class=per_class,
        )

    return results


def measure_inference_performance(
    adapter: SentimentModelAdapter,
    texts: Sequence[str],
    batch_size: int = 16,
    warmup: bool = True,
    repetitions: int = 3,
) -> tuple[float, float]:
    """Measure warm inference latency and throughput across multiple repetitions.
    
    Args:
        adapter: Model adapter instance.
        texts: Sequence of texts to evaluate.
        batch_size: Batch size for execution.
        warmup: Whether to perform a warmup pass.
        repetitions: Number of benchmark passes to average.
        
    Returns:
        tuple[float, float]: (average_seconds, samples_per_second).
    """
    text_list = list(texts)
    if not text_list:
        return 0.0, 0.0

    if warmup:
        # Run one warmup pass on a single batch
        adapter.predict_batch(text_list[: min(batch_size, len(text_list))], batch_size=batch_size)

    durations: list[float] = []
    for _ in range(max(1, repetitions)):
        t0 = time.perf_counter()
        adapter.predict_batch(text_list, batch_size=batch_size)
        durations.append(time.perf_counter() - t0)

    avg_seconds = sum(durations) / len(durations)
    throughput = len(text_list) / avg_seconds if avg_seconds > 0 else 0.0
    return round(avg_seconds, 4), round(throughput, 2)


def get_model_disk_size_mb(model_id: str) -> float:
    """Calculate approximate on-disk size of model weights in megabytes."""
    # Check local models/ folder
    candidate_paths = [
        Path(model_id),
        Path(__file__).resolve().parents[3] / "models" / model_id,
        Path.home() / ".cache" / "huggingface" / "hub" / f"models--{model_id.replace('/', '--')}",
    ]
    for p in candidate_paths:
        if p.is_dir():
            total_bytes = sum(f.stat().st_size for f in p.rglob("*") if f.is_file())
            return round(total_bytes / (1024 * 1024), 2)

    return 0.0


def evaluate_model_profile(
    adapter: SentimentModelAdapter,
    dataset_path: Path | str,
    load_time_seconds: float = 0.0,
    batch_size: int = 16,
) -> tuple[ModelBenchmarkSummary, list[SentimentPrediction]]:
    """Execute complete benchmark evaluation, timing, and language breakdown for a model."""
    examples = load_evaluation_dataset(dataset_path)
    texts = [ex["text"] for ex in examples]
    gold_labels = [ex["label"] for ex in examples]

    predictions = adapter.predict_batch(texts, batch_size=batch_size)
    pred_labels = [p.label.value for p in predictions]

    accuracy, macro_f1, per_class, confusion = compute_classification_metrics(gold_labels, pred_labels)
    lang_metrics = compute_language_wise_metrics(examples, predictions)

    warm_time, throughput = measure_inference_performance(adapter, texts, batch_size=batch_size)
    disk_size = get_model_disk_size_mb(adapter.model_id)

    summary = ModelBenchmarkSummary(
        model_id=adapter.model_id,
        sample_count=len(examples),
        accuracy=accuracy,
        macro_f1=macro_f1,
        per_class=per_class,
        confusion_matrix=confusion,
        language_metrics=lang_metrics,
        load_time_seconds=round(load_time_seconds, 3),
        warm_inference_seconds=warm_time,
        throughput_samples_per_sec=throughput,
        model_disk_size_mb=disk_size,
    )

    return summary, predictions


def generate_comparison_recommendation(
    en_summary: ModelBenchmarkSummary,
    multi_summary: ModelBenchmarkSummary,
) -> tuple[str, str]:
    """Generate an evidence-based recommendation comparing English and Multilingual models.
    
    Evaluates:
    - Overall accuracy delta
    - Non-English accuracy improvements
    - English retention (whether multilingual degrades English)
    - Throughput / latency overhead
    """
    en_acc = en_summary.accuracy
    multi_acc = multi_summary.accuracy

    en_in_en = en_summary.language_metrics.get("en")
    multi_in_en = multi_summary.language_metrics.get("en")

    en_score_en = en_in_en.accuracy if en_in_en else 0.0
    multi_score_en = multi_in_en.accuracy if multi_in_en else 0.0

    # Check non-English samples
    non_en_langs = [l for l in en_summary.language_metrics if l != "en"]
    multi_better_non_en = False
    for l in non_en_langs:
        en_l = en_summary.language_metrics[l].accuracy
        mul_l = multi_summary.language_metrics.get(l, LanguageMetrics(language=l, sample_count=0, accuracy=0, macro_f1=0, per_class={})).accuracy
        if mul_l > en_l:
            multi_better_non_en = True

    if multi_score_en >= en_score_en and multi_acc > en_acc:
        rec = "Use multilingual model globally"
        reason = (
            f"Multilingual model achieves superior overall accuracy ({multi_acc * 100:.1f}% vs {en_acc * 100:.1f}%) "
            f"without degrading English performance ({multi_score_en * 100:.1f}% vs {en_score_en * 100:.1f}%)."
        )
    elif multi_better_non_en and en_score_en > multi_score_en:
        rec = "Use English model for English and multilingual model for non-English"
        reason = (
            f"English model excels on English text ({en_score_en * 100:.1f}% vs {multi_score_en * 100:.1f}%), "
            "while the multilingual model provides superior non-English detection. Language routing preserves peak accuracy for both."
        )
    elif multi_better_non_en and multi_score_en == en_score_en:
        rec = "Use multilingual model globally"
        reason = (
            f"Multilingual model matches English performance on English ({multi_score_en * 100:.1f}%) "
            f"while unlocking non-English sentiment detection, lifting overall accuracy to {multi_acc * 100:.1f}%."
        )
    else:
        rec = "Keep English model as current baseline; collect more multilingual evaluation data before routing"
        reason = (
            f"Multilingual model did not demonstrate a compelling improvement over the English baseline "
            f"(English {en_acc * 100:.1f}% vs Multilingual {multi_acc * 100:.1f}%). Additional multilingual samples are required."
        )

    return rec, reason
