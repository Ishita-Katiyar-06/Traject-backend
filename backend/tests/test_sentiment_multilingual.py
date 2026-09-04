import json
from pathlib import Path
import pytest

from app.ml.sentiment.comparison import (
    LanguageMetrics,
    ModelBenchmarkSummary,
    SentimentModelComparison,
    compute_language_wise_metrics,
    generate_comparison_recommendation,
)
from app.ml.sentiment.inference import (
    EnglishSentimentModel,
    MultilingualSentimentModel,
    SentimentModel,
    SentimentModelAdapter,
)
from app.ml.sentiment.models import (
    ClassificationMetrics,
    ConfusionMatrix,
    SentimentLabel,
    SentimentPrediction,
)


def _make_dummy_prediction(label: str, confidence: float = 0.9, model_id: str = "test-model") -> SentimentPrediction:
    scores = {"negative": 0.0, "neutral": 0.0, "positive": 0.0}
    scores[label] = confidence
    return SentimentPrediction(
        label=SentimentLabel(label),
        confidence=confidence,
        scores=scores,
        model_id=model_id,
    )


def test_multilingual_model_inheritance():
    """1. Test that English and Multilingual models inherit from SentimentModel and have standard defaults."""
    assert issubclass(EnglishSentimentModel, SentimentModelAdapter)
    assert issubclass(MultilingualSentimentModel, SentimentModelAdapter)
    assert issubclass(SentimentModel, SentimentModelAdapter)
    assert EnglishSentimentModel.DEFAULT_MODEL_ID == "cardiffnlp/twitter-roberta-base-sentiment-latest"
    assert MultilingualSentimentModel.DEFAULT_MODEL_ID == "cardiffnlp/twitter-xlm-roberta-base-sentiment"


def test_language_wise_metrics_calculation():
    """2. Test language-wise metric breakdown splits accurately by ISO language code."""
    examples = [
        {"id": "1", "language": "en", "label": "positive"},
        {"id": "2", "language": "en", "label": "negative"},
        {"id": "3", "language": "hi", "label": "positive"},
        {"id": "4", "language": "hi", "label": "negative"},
        {"id": "5", "language": "ru", "label": "neutral"},
    ]
    # Predictions: English 100% correct, Hindi 1 wrong, Russian 100% correct
    predictions = [
        _make_dummy_prediction("positive"),
        _make_dummy_prediction("negative"),
        _make_dummy_prediction("positive"),
        _make_dummy_prediction("neutral"),  # wrong
        _make_dummy_prediction("neutral"),
    ]

    lang_metrics = compute_language_wise_metrics(examples, predictions)

    assert "en" in lang_metrics
    assert "hi" in lang_metrics
    assert "ru" in lang_metrics

    assert lang_metrics["en"].sample_count == 2
    assert lang_metrics["en"].accuracy == 1.0

    assert lang_metrics["hi"].sample_count == 2
    assert lang_metrics["hi"].accuracy == 0.5

    assert lang_metrics["ru"].sample_count == 1
    assert lang_metrics["ru"].accuracy == 1.0


def test_comparison_recommendation_routing():
    """3. Test recommendation resolves to hybrid routing when English beats multilingual on English but multilingual wins non-English."""
    dummy_per_class = {
        c: ClassificationMetrics(precision=1.0, recall=1.0, f1=1.0, support=1)
        for c in ["negative", "neutral", "positive"]
    }
    dummy_conf = ConfusionMatrix()

    en_summary = ModelBenchmarkSummary(
        model_id="en-model",
        sample_count=30,
        accuracy=0.8667,
        macro_f1=0.8704,
        per_class=dummy_per_class,
        confusion_matrix=dummy_conf,
        language_metrics={
            "en": LanguageMetrics(language="en", sample_count=26, accuracy=1.0, macro_f1=1.0, per_class=dummy_per_class),
            "hi": LanguageMetrics(language="hi", sample_count=2, accuracy=0.0, macro_f1=0.0, per_class=dummy_per_class),
            "ru": LanguageMetrics(language="ru", sample_count=2, accuracy=0.0, macro_f1=0.0, per_class=dummy_per_class),
        },
    )

    multi_summary = ModelBenchmarkSummary(
        model_id="multi-model",
        sample_count=30,
        accuracy=0.9000,
        macro_f1=0.9000,
        per_class=dummy_per_class,
        confusion_matrix=dummy_conf,
        language_metrics={
            "en": LanguageMetrics(language="en", sample_count=26, accuracy=0.9231, macro_f1=0.92, per_class=dummy_per_class),
            "hi": LanguageMetrics(language="hi", sample_count=2, accuracy=1.0, macro_f1=1.0, per_class=dummy_per_class),
            "ru": LanguageMetrics(language="ru", sample_count=2, accuracy=1.0, macro_f1=1.0, per_class=dummy_per_class),
        },
    )

    rec, reason = generate_comparison_recommendation(en_summary, multi_summary)
    assert rec == "Use English model for English and multilingual model for non-English"
    assert "routing" in reason.lower() or "hybrid" in reason.lower() or "superior non-english" in reason.lower()


def test_comparison_recommendation_global():
    """4. Test recommendation resolves to global multilingual when multilingual matches English on English and wins non-English."""
    dummy_per_class = {
        c: ClassificationMetrics(precision=1.0, recall=1.0, f1=1.0, support=1)
        for c in ["negative", "neutral", "positive"]
    }
    dummy_conf = ConfusionMatrix()

    en_summary = ModelBenchmarkSummary(
        model_id="en-model",
        sample_count=30,
        accuracy=0.8667,
        macro_f1=0.8704,
        per_class=dummy_per_class,
        confusion_matrix=dummy_conf,
        language_metrics={
            "en": LanguageMetrics(language="en", sample_count=26, accuracy=1.0, macro_f1=1.0, per_class=dummy_per_class),
            "hi": LanguageMetrics(language="hi", sample_count=2, accuracy=0.0, macro_f1=0.0, per_class=dummy_per_class),
        },
    )

    multi_summary = ModelBenchmarkSummary(
        model_id="multi-model",
        sample_count=30,
        accuracy=0.9667,
        macro_f1=0.9667,
        per_class=dummy_per_class,
        confusion_matrix=dummy_conf,
        language_metrics={
            "en": LanguageMetrics(language="en", sample_count=26, accuracy=1.0, macro_f1=1.0, per_class=dummy_per_class),
            "hi": LanguageMetrics(language="hi", sample_count=2, accuracy=1.0, macro_f1=1.0, per_class=dummy_per_class),
        },
    )

    rec, _ = generate_comparison_recommendation(en_summary, multi_summary)
    assert rec == "Use multilingual model globally"


def test_comparison_json_serialization(tmp_path):
    """5. Test SentimentModelComparison serializes to formatted JSON with overwrite guard."""
    dummy_per_class = {
        c: ClassificationMetrics(precision=1.0, recall=1.0, f1=1.0, support=1)
        for c in ["negative", "neutral", "positive"]
    }
    dummy_conf = ConfusionMatrix()

    summary = ModelBenchmarkSummary(
        model_id="test-model",
        sample_count=10,
        accuracy=1.0,
        macro_f1=1.0,
        per_class=dummy_per_class,
        confusion_matrix=dummy_conf,
        language_metrics={},
    )

    comp = SentimentModelComparison(
        benchmark_dataset="manual_evaluation.jsonl",
        english_model=summary,
        multilingual_model=summary,
        delta_accuracy=0.0,
        delta_macro_f1=0.0,
        language_deltas={"en": {"delta_accuracy": 0.0}},
        recommendation="Keep English model as current baseline; collect more multilingual evaluation data before routing",
        recommendation_reason="Test reason",
        limitations="Pilot benchmark",
    )

    out_file = tmp_path / "comparison.json"
    comp.save_json(out_file)
    assert out_file.exists()

    content = json.loads(out_file.read_text(encoding="utf-8"))
    assert content["benchmark_dataset"] == "manual_evaluation.jsonl"
    assert "english_model" in content
    assert "multilingual_model" in content

    # Test overwrite protection
    with pytest.raises(FileExistsError):
        comp.save_json(out_file, overwrite=False)

    comp.save_json(out_file, overwrite=True)
