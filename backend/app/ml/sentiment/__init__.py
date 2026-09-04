from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.ml.sentiment.comparison import (
        LanguageMetrics,
        ModelBenchmarkSummary,
        SentimentModelComparison,
        compute_language_wise_metrics,
        evaluate_model_profile,
        generate_comparison_recommendation,
        measure_inference_performance,
    )
    from app.ml.sentiment.evaluation import (
        compute_classification_metrics,
        evaluate_model,
        load_evaluation_dataset,
        run_real_dataset_inference,
    )
    from app.ml.sentiment.inference import (
        EnglishSentimentModel,
        MultilingualSentimentModel,
        SentimentModel,
        SentimentModelAdapter,
        normalize_sentiment_label,
    )
    from app.ml.sentiment.models import (
        ClassificationMetrics,
        ConfusionMatrix,
        EvaluationResult,
        PerExamplePrediction,
        SentimentLabel,
        SentimentPrediction,
    )


def __getattr__(name: str):
    import app.ml.sentiment.models as m
    if hasattr(m, name):
        return getattr(m, name)
    import app.ml.sentiment.inference as i
    if hasattr(i, name):
        return getattr(i, name)
    import app.ml.sentiment.evaluation as e
    if hasattr(e, name):
        return getattr(e, name)
    import app.ml.sentiment.comparison as c
    if hasattr(c, name):
        return getattr(c, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "SentimentLabel",
    "SentimentPrediction",
    "ClassificationMetrics",
    "ConfusionMatrix",
    "EvaluationResult",
    "PerExamplePrediction",
    "SentimentModel",
    "SentimentModelAdapter",
    "EnglishSentimentModel",
    "MultilingualSentimentModel",
    "normalize_sentiment_label",
    "compute_classification_metrics",
    "load_evaluation_dataset",
    "evaluate_model",
    "run_real_dataset_inference",
    "LanguageMetrics",
    "ModelBenchmarkSummary",
    "SentimentModelComparison",
    "compute_language_wise_metrics",
    "measure_inference_performance",
    "evaluate_model_profile",
    "generate_comparison_recommendation",
]
