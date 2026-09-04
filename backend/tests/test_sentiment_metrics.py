import json
from pathlib import Path
import pytest

from app.ml.sentiment.evaluation import (
    compute_classification_metrics,
    load_evaluation_dataset,
)
from app.ml.sentiment.inference import normalize_sentiment_label
from app.ml.sentiment.models import (
    ClassificationMetrics,
    ConfusionMatrix,
    EvaluationResult,
    SentimentLabel,
)


def test_perfect_predictions_metrics():
    """1. Test that 100% agreement produces accuracy 1.0 and macro F1 1.0."""
    gold = ["negative", "neutral", "positive", "negative", "positive"]
    pred = ["negative", "neutral", "positive", "negative", "positive"]

    acc, macro_f1, per_class, conf = compute_classification_metrics(gold, pred)

    assert acc == 1.0
    assert macro_f1 == 1.0
    for label in ["negative", "neutral", "positive"]:
        assert per_class[label].precision == 1.0
        assert per_class[label].recall == 1.0
        assert per_class[label].f1 == 1.0

    assert conf.matrix["negative"]["negative"] == 2
    assert conf.matrix["neutral"]["neutral"] == 1
    assert conf.matrix["positive"]["positive"] == 2
    assert conf.matrix["negative"]["positive"] == 0


def test_imbalanced_classification_metrics():
    """2. Test precision, recall, and F1 calculations on imbalanced predictions."""
    gold = ["negative", "negative", "neutral", "positive"]
    pred = ["negative", "neutral",  "neutral", "neutral"]

    # negative: TP=1, FP=0, FN=1 -> Prec=1.0, Rec=0.5, F1=0.6667
    # neutral:  TP=1, FP=2, FN=0 -> Prec=1/3=0.3333, Rec=1.0, F1=0.5
    # positive: TP=0, FP=0, FN=1 -> Prec=0.0, Rec=0.0, F1=0.0
    acc, macro_f1, per_class, conf = compute_classification_metrics(gold, pred)

    assert acc == 0.5  # 2 of 4 correct
    assert per_class["negative"].precision == 1.0
    assert per_class["negative"].recall == 0.5
    assert per_class["negative"].f1 == 0.6667

    assert per_class["neutral"].precision == 0.3333
    assert per_class["neutral"].recall == 1.0
    assert per_class["neutral"].f1 == 0.5

    assert per_class["positive"].precision == 0.0
    assert per_class["positive"].recall == 0.0
    assert per_class["positive"].f1 == 0.0

    expected_macro = round((0.6667 + 0.5 + 0.0) / 3, 4)
    assert macro_f1 == expected_macro


def test_confusion_matrix_construction():
    """3. Test confusion matrix correctly accumulates actual vs predicted counts."""
    gold = ["negative", "positive", "neutral"]
    pred = ["neutral",  "positive", "negative"]

    _, _, _, conf = compute_classification_metrics(gold, pred)

    assert conf.matrix["negative"]["neutral"] == 1
    assert conf.matrix["positive"]["positive"] == 1
    assert conf.matrix["neutral"]["negative"] == 1
    assert conf.matrix["negative"]["negative"] == 0


def test_empty_evaluation_set_handling():
    """4. Test empty inputs do not cause division by zero."""
    acc, macro_f1, per_class, conf = compute_classification_metrics([], [])
    assert acc == 0.0
    assert macro_f1 == 0.0
    assert per_class["negative"].precision == 0.0
    assert per_class["neutral"].recall == 0.0


def test_zero_predicted_class_safe_division():
    """5. Test class with zero positive predictions safely yields 0.0 precision without errors."""
    gold = ["negative", "negative"]
    pred = ["negative", "negative"]

    acc, macro_f1, per_class, _ = compute_classification_metrics(gold, pred)
    assert per_class["positive"].precision == 0.0
    assert per_class["positive"].recall == 0.0
    assert per_class["positive"].f1 == 0.0


def test_label_normalization_schemes():
    """6. Test arbitrary model label schemes normalize to standardized SentimentLabel."""
    # Hugging Face default label strings
    assert normalize_sentiment_label("LABEL_0") == SentimentLabel.NEGATIVE
    assert normalize_sentiment_label("LABEL_1") == SentimentLabel.NEUTRAL
    assert normalize_sentiment_label("LABEL_2") == SentimentLabel.POSITIVE

    # String variations
    assert normalize_sentiment_label("neg") == SentimentLabel.NEGATIVE
    assert normalize_sentiment_label("negative") == SentimentLabel.NEGATIVE
    assert normalize_sentiment_label("Negative") == SentimentLabel.NEGATIVE
    assert normalize_sentiment_label("neu") == SentimentLabel.NEUTRAL
    assert normalize_sentiment_label("neutral") == SentimentLabel.NEUTRAL
    assert normalize_sentiment_label("pos") == SentimentLabel.POSITIVE
    assert normalize_sentiment_label("positive") == SentimentLabel.POSITIVE

    # Numeric indices
    assert normalize_sentiment_label(0) == SentimentLabel.NEGATIVE
    assert normalize_sentiment_label(1) == SentimentLabel.NEUTRAL
    assert normalize_sentiment_label(2) == SentimentLabel.POSITIVE

    # Unrecognized falls back safely
    assert normalize_sentiment_label("unknown_tag") == SentimentLabel.NEUTRAL


def test_evaluation_result_json_serialization(tmp_path):
    """7. Test EvaluationResult serializes to valid JSON with overwrite guard."""
    conf = ConfusionMatrix(
        matrix={
            "negative": {"negative": 5, "neutral": 0, "positive": 0},
            "neutral": {"negative": 0, "neutral": 5, "positive": 0},
            "positive": {"negative": 0, "neutral": 0, "positive": 5},
        }
    )
    result = EvaluationResult(
        model_id="test-model",
        sample_count=15,
        accuracy=1.0,
        macro_f1=1.0,
        confusion_matrix=conf,
    )

    out_file = tmp_path / "eval_report.json"
    result.save_json(out_file)

    assert out_file.exists()
    content = json.loads(out_file.read_text(encoding="utf-8"))
    assert content["model_id"] == "test-model"
    assert content["accuracy"] == 1.0

    # Test overwrite protection
    with pytest.raises(FileExistsError):
        result.save_json(out_file, overwrite=False)

    result.save_json(out_file, overwrite=True)


def test_manual_evaluation_fixture_structure():
    """8. Test manual_evaluation.jsonl fixture exists, has 30 records, balanced labels, and required fields."""
    fixture_path = Path(__file__).parent / "fixtures" / "sentiment" / "manual_evaluation.jsonl"
    assert fixture_path.is_file(), f"Benchmark fixture not found: {fixture_path}"

    examples = load_evaluation_dataset(fixture_path)
    assert len(examples) == 30

    labels = [ex["label"] for ex in examples]
    assert labels.count("negative") == 10
    assert labels.count("neutral") == 10
    assert labels.count("positive") == 10

    for ex in examples:
        assert "id" in ex
        assert "text" in ex and len(ex["text"].strip()) > 0
        assert ex["label"] in ("negative", "neutral", "positive")
        assert "language" in ex
