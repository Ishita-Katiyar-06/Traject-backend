import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Any, Sequence
import time



import torch
import transformers

from app.ml.sentiment.inference import SentimentModelAdapter
from app.ml.sentiment.models import (
    ClassificationMetrics,
    ConfusionMatrix,
    EvaluationResult,
    PerExamplePrediction,
    SentimentLabel,
    SentimentPrediction,
)

logger = logging.getLogger("traject.ml.sentiment.evaluation")

STANDARD_LABELS = [
    SentimentLabel.NEGATIVE.value,
    SentimentLabel.NEUTRAL.value,
    SentimentLabel.POSITIVE.value,
]


def compute_classification_metrics(
    gold_labels: Sequence[str],
    predicted_labels: Sequence[str],
) -> tuple[float, float, dict[str, ClassificationMetrics], ConfusionMatrix]:
    """Compute Accuracy, per-class Precision/Recall/F1, Macro F1, and Confusion Matrix in pure Python.
    
    Zero scikit-learn dependency required. Implements standard multi-class evaluation rules
    with safe division-by-zero protection.
    
    Args:
        gold_labels: Sequence of ground-truth sentiment labels.
        predicted_labels: Sequence of model-predicted sentiment labels.
        
    Returns:
        tuple containing (accuracy, macro_f1, per_class_dict, confusion_matrix).
    """
    total = len(gold_labels)
    if total == 0:
        empty_matrix = {g: {p: 0 for p in STANDARD_LABELS} for g in STANDARD_LABELS}
        empty_per_class = {
            c: ClassificationMetrics(precision=0.0, recall=0.0, f1=0.0, support=0)
            for c in STANDARD_LABELS
        }
        return 0.0, 0.0, empty_per_class, ConfusionMatrix(matrix=empty_matrix)

    # 1. Overall Accuracy
    correct_count = sum(1 for g, p in zip(gold_labels, predicted_labels) if g == p)
    accuracy = round(correct_count / total, 4)

    # 2. Confusion Matrix initialization
    matrix = {g: {p: 0 for p in STANDARD_LABELS} for g in STANDARD_LABELS}
    for g, p in zip(gold_labels, predicted_labels):
        if g in matrix and p in matrix[g]:
            matrix[g][p] += 1
        elif g in matrix:
            # Handle out-of-vocabulary prediction gracefully
            matrix[g][SentimentLabel.NEUTRAL.value] += 1

    # 3. Per-Class Precision, Recall, F1
    per_class: dict[str, ClassificationMetrics] = {}
    f1_scores: list[float] = []

    for c in STANDARD_LABELS:
        tp = sum(1 for g, p in zip(gold_labels, predicted_labels) if g == c and p == c)
        fp = sum(1 for g, p in zip(gold_labels, predicted_labels) if g != c and p == c)
        fn = sum(1 for g, p in zip(gold_labels, predicted_labels) if g == c and p != c)
        support = sum(1 for g in gold_labels if g == c)

        precision = round(tp / (tp + fp), 4) if (tp + fp) > 0 else 0.0
        recall = round(tp / (tp + fn), 4) if (tp + fn) > 0 else 0.0
        f1 = (
            round((2 * precision * recall) / (precision + recall), 4)
            if (precision + recall) > 0
            else 0.0
        )

        per_class[c] = ClassificationMetrics(
            precision=precision,
            recall=recall,
            f1=f1,
            support=support,
        )
        f1_scores.append(f1)

    # 4. Macro F1 (unweighted average of class F1s)
    macro_f1 = round(sum(f1_scores) / len(f1_scores), 4)

    confusion = ConfusionMatrix(labels=STANDARD_LABELS, matrix=matrix)
    return accuracy, macro_f1, per_class, confusion


def load_evaluation_dataset(dataset_path: Path | str) -> list[dict[str, Any]]:
    """Load evaluation examples from a JSONL or CSV file."""
    path = Path(dataset_path).resolve()
    if not path.is_file():
        raise FileNotFoundError(f"Evaluation dataset not found: {path}")

    examples: list[dict[str, Any]] = []
    with open(path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, start=1):
            line_str = line.strip()
            if not line_str:
                continue
            try:
                record = json.loads(line_str)
                examples.append(record)
            except json.JSONDecodeError as exc:
                logger.warning("Skipping invalid JSON line at %s:%d: %s", path.name, line_num, exc)

    return examples


def evaluate_model(
    adapter: SentimentModelAdapter,
    dataset_path: Path | str,
    batch_size: int = 16,
    notes: str | None = None,
) -> tuple[EvaluationResult, list[PerExamplePrediction]]:
    """Evaluate a candidate sentiment model against a benchmark dataset.
    
    Args:
        adapter: Initialized SentimentModelAdapter.
        dataset_path: Path to evaluation JSONL benchmark file.
        batch_size: Batch size for inference.
        notes: Optional descriptive notes.
        
    Returns:
        tuple[EvaluationResult, list[PerExamplePrediction]]: Summary result and detailed predictions.
    """
    examples = load_evaluation_dataset(dataset_path)
    if not examples:
        raise ValueError(f"No evaluation records found in {dataset_path}")

    texts = [ex["text"] for ex in examples]
    gold_labels = [ex["label"] for ex in examples]

    predictions: list[SentimentPrediction] = adapter.predict_batch(texts, batch_size=batch_size)

    pred_labels = [p.label.value for p in predictions]

    accuracy, macro_f1, per_class, confusion = compute_classification_metrics(
        gold_labels=gold_labels,
        predicted_labels=pred_labels,
    )

    per_example_results: list[PerExamplePrediction] = []
    for ex, pred in zip(examples, predictions):
        gold = ex["label"]
        pred_val = pred.label.value
        per_example_results.append(
            PerExamplePrediction(
                id=str(ex.get("id", "unknown")),
                text=ex["text"],
                gold_label=gold,
                predicted_label=pred_val,
                confidence=pred.confidence,
                scores=pred.scores,
                correct=(gold == pred_val),
                model_id=adapter.model_id,
            )
        )

    result = EvaluationResult(
        model_id=adapter.model_id,
        evaluation_dataset=str(Path(dataset_path).name),
        sample_count=len(examples),
        accuracy=accuracy,
        macro_f1=macro_f1,
        per_class=per_class,
        confusion_matrix=confusion,
        device=adapter.device_name,
        library_versions={
            "torch": torch.__version__,
            "transformers": transformers.__version__,
        },
        notes=notes,
    )

    return result, per_example_results


def _format_cli_evaluation(result: EvaluationResult) -> str:
    """Format evaluation metrics and confusion matrix for terminal display."""
    lines = [
        "TRAJECT Pretrained Sentiment Model Evaluation",
        "",
        f"Model:    {result.model_id}",
        f"Dataset:  {result.evaluation_dataset} ({result.sample_count} samples)",
        f"Device:   {result.device}",
        "",
        f"Accuracy: {result.accuracy:.4f} ({result.accuracy * 100:.1f}%)",
        f"Macro F1: {result.macro_f1:.4f}",
        "",
        "Per-Class Metrics:",
        "  Class      Precision   Recall    F1-Score  Support",
        "  ---------  ----------  --------  --------  -------",
    ]

    for label in STANDARD_LABELS:
        metrics = result.per_class.get(label)
        if metrics:
            lines.append(
                f"  {label:<9}  {metrics.precision:<10.4f}  {metrics.recall:<8.4f}  {metrics.f1:<8.4f}  {metrics.support:<7}"
            )

    lines.extend([
        "",
        "Confusion Matrix:",
        "                 Predicted",
        "              neg   neu   pos",
    ])

    mat = result.confusion_matrix.matrix
    for gold_cat, abbrev in [("negative", "Actual neg"), ("neutral", "Actual neu"), ("positive", "Actual pos")]:
        row = mat.get(gold_cat, {})
        neg_cnt = row.get("negative", 0)
        neu_cnt = row.get("neutral", 0)
        pos_cnt = row.get("positive", 0)
        lines.append(f"  {abbrev:<11} {neg_cnt:>4}  {neu_cnt:>4}  {pos_cnt:>4}")

    return "\n".join(lines)


def run_real_dataset_inference(
    parquet_path: Path | str,
    output_path: Path | str,
    model_id: str = "cardiffnlp/twitter-roberta-base-sentiment-latest",
    overwrite: bool = False,
) -> list[dict[str, Any]]:
    """Run pretrained sentiment model inference on a canonical Parquet dataset.
    
    Processing Steps:
    1. Loads canonical messages via load_canonical_dataset.
    2. Prepares language-aware records via prepare_language_aware_records (filtering media-only messages).
    3. Runs batch prediction via SentimentModelAdapter.
    4. Writes derived analytical predictions JSONL with overwrite guard.
    5. Leaves original Parquet and raw JSONL completely untouched.
    """
    from app.ml.dataset import load_canonical_dataset, prepare_language_aware_records

    in_path = Path(parquet_path).resolve()
    out_path = Path(output_path).resolve()

    if not in_path.is_file():
        raise FileNotFoundError(f"Input Parquet dataset not found: {in_path}")

    if out_path.exists() and not overwrite:
        raise FileExistsError(
            f"Output predictions file already exists: {out_path}\n"
            "Use overwrite=True or --overwrite to replace existing file."
        )

    messages = load_canonical_dataset(in_path)
    records = prepare_language_aware_records(messages)

    if not records:
        logger.warning("No text-bearing records found in %s", in_path)
        return []

    adapter = SentimentModelAdapter(model_id)
    texts = [r.normalized_text for r in records]
    predictions = adapter.predict_batch(texts)

    results: list[dict[str, Any]] = []
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with open(out_path, "w", encoding="utf-8") as f:
        for rec, pred in zip(records, predictions):
            item = {
                "canonical_id": rec.canonical_id,
                "detected_language": rec.detected_language,
                "text": rec.original_text,
                "normalized_text": rec.normalized_text,
                "model_id": pred.model_id,
                "predicted_label": pred.label.value,
                "confidence": pred.confidence,
                "scores": pred.scores,
            }
            results.append(item)
            f.write(json.dumps(item, ensure_ascii=False) + "\n")

    logger.info("Saved %d real-data sentiment predictions to %s", len(results), out_path)
    return results


def run_real_dataset_comparison(
    parquet_path: Path | str,
    output_path: Path | str,
    model_1: str = "cardiffnlp/twitter-roberta-base-sentiment-latest",
    model_2: str = "cardiffnlp/twitter-xlm-roberta-base-sentiment",
    overwrite: bool = False,
) -> dict[str, Any]:
    """Run dual qualitative sentiment inference on a real Parquet dataset and compare model outputs.
    
    Generates side-by-side predictions for every text-bearing message and calculates agreement rate.
    """
    from app.ml.dataset import load_canonical_dataset, prepare_language_aware_records

    in_path = Path(parquet_path).resolve()
    out_path = Path(output_path).resolve()

    if not in_path.is_file():
        raise FileNotFoundError(f"Input Parquet dataset not found: {in_path}")

    if out_path.exists() and not overwrite:
        raise FileExistsError(
            f"Output comparison file already exists: {out_path}\n"
            "Use overwrite=True or --overwrite to replace existing file."
        )

    messages = load_canonical_dataset(in_path)
    records = prepare_language_aware_records(messages)

    if not records:
        logger.warning("No text-bearing records found in %s", in_path)
        return {"total_records": 0, "agreements": 0, "disagreements": 0}

    texts = [r.normalized_text for r in records]

    print(f"Loading Model 1: {model_1}...")
    adapter_1 = SentimentModelAdapter(model_1)
    preds_1 = adapter_1.predict_batch(texts)

    print(f"Loading Model 2: {model_2}...")
    adapter_2 = SentimentModelAdapter(model_2)
    preds_2 = adapter_2.predict_batch(texts)

    items: list[dict[str, Any]] = []
    agreements = 0
    disagreements = 0
    dist_1: dict[str, int] = {}
    dist_2: dict[str, int] = {}

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        for rec, p1, p2 in zip(records, preds_1, preds_2):
            l1 = p1.label.value
            l2 = p2.label.value
            dist_1[l1] = dist_1.get(l1, 0) + 1
            dist_2[l2] = dist_2.get(l2, 0) + 1

            agree = (l1 == l2)
            if agree:
                agreements += 1
            else:
                disagreements += 1

            item = {
                "canonical_id": rec.canonical_id,
                "detected_language": rec.detected_language,
                "text": rec.original_text,
                "model_1": {
                    "model_id": model_1,
                    "predicted_label": l1,
                    "confidence": p1.confidence,
                    "scores": p1.scores,
                },
                "model_2": {
                    "model_id": model_2,
                    "predicted_label": l2,
                    "confidence": p2.confidence,
                    "scores": p2.scores,
                },
                "agreement": agree,
            }
            items.append(item)
            f.write(json.dumps(item, ensure_ascii=False) + "\n")

    summary = {
        "dataset": str(in_path.name),
        "total_records": len(items),
        "model_1": model_1,
        "model_2": model_2,
        "model_1_distribution": dist_1,
        "model_2_distribution": dist_2,
        "agreements": agreements,
        "disagreements": disagreements,
        "agreement_rate": round(agreements / len(items), 4) if items else 0.0,
    }

    return summary


def _format_comparison_display(comparison: Any) -> str:
    """Format comparative evaluation for terminal display."""
    en = comparison.english_model
    mul = comparison.multilingual_model

    lines = [
        "================================================================================",
        "TRAJECT Pretrained Sentiment Model Comparison (Milestone 4D)",
        "================================================================================",
        f"Benchmark Dataset: {comparison.benchmark_dataset} ({en.sample_count} samples)",
        "",
        "1. OVERALL BENCHMARK PERFORMANCE:",
        f"  Metric       English Model ({en.model_id.split('/')[-1]})   Multilingual Model ({mul.model_id.split('/')[-1]})   Delta",
        "  -----------  -------------------------------------  ------------------------------------------  -------",
        f"  Accuracy     {en.accuracy * 100:>6.2f}%                                {mul.accuracy * 100:>6.2f}%                                  {comparison.delta_accuracy * 100:>+6.2f}%",
        f"  Macro F1     {en.macro_f1:>7.4f}                                 {mul.macro_f1:>7.4f}                                   {comparison.delta_macro_f1:>+7.4f}",
        "",
        "2. LANGUAGE BREAKDOWN:",
        "  Lang  Samples  English Acc  Multi Acc   Multi - En Delta",
        "  ----  -------  -----------  ----------  ----------------",
    ]

    all_langs = sorted(set(list(en.language_metrics.keys()) + list(mul.language_metrics.keys())))
    for lang in all_langs:
        en_l = en.language_metrics.get(lang)
        mul_l = mul.language_metrics.get(lang)
        count = en_l.sample_count if en_l else (mul_l.sample_count if mul_l else 0)
        en_acc_str = f"{en_l.accuracy * 100:.1f}%" if en_l else "N/A"
        mul_acc_str = f"{mul_l.accuracy * 100:.1f}%" if mul_l else "N/A"
        delta = (mul_l.accuracy - en_l.accuracy) * 100 if (en_l and mul_l) else 0.0
        lines.append(
            f"  {lang:<4}  {count:<7}  {en_acc_str:<11}  {mul_acc_str:<10}  {delta:>+6.1f}%"
        )

    lines.extend([
        "",
        "3. PERFORMANCE & EFFICIENCY (CPU):",
        f"  Metric                      English Model          Multilingual Model",
        "  --------------------------  ---------------------  ---------------------",
        f"  Model Disk Size             {en.model_disk_size_mb:>7.1f} MB             {mul.model_disk_size_mb:>7.1f} MB",
        f"  Warm Inference Latency      {en.warm_inference_seconds:>7.3f} s              {mul.warm_inference_seconds:>7.3f} s",
        f"  Throughput (samples/sec)    {en.throughput_samples_per_sec:>7.1f}                {mul.throughput_samples_per_sec:>7.1f}",
        "",
        "4. RECOMMENDATION:",
        f"  >>> {comparison.recommendation}",
        f"  Reason: {comparison.recommendation_reason}",
        "",
        "5. LIMITATIONS:",
        f"  {comparison.limitations}",
        "================================================================================",
    ])

    return "\n".join(lines)


def _main() -> None:
    """CLI entrypoint for running sentiment model evaluation."""
    from app.ml.sentiment.comparison import (
        SentimentModelComparison,
        evaluate_model_profile,
        generate_comparison_recommendation,
    )

    parser = argparse.ArgumentParser(
        description="Evaluate pretrained sentiment models on TRAJECT benchmark datasets.",
    )
    parser.add_argument(
        "--input",
        default=None,
        help="Path to the evaluation benchmark dataset (JSONL).",
    )
    parser.add_argument(
        "--model",
        default="cardiffnlp/twitter-roberta-base-sentiment-latest",
        help="Hugging Face model repository identifier.",
    )
    parser.add_argument(
        "--compare-with",
        default=None,
        help="Optional second model identifier for side-by-side comparative benchmarking.",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Optional path to output the evaluation summary / comparison as a JSON report.",
    )
    parser.add_argument(
        "--predictions-output",
        default=None,
        help="Optional path to output detailed per-example predictions as JSONL.",
    )
    parser.add_argument(
        "--real-parquet",
        default=None,
        help="Optional path to real Parquet dataset to run qualitative inference.",
    )
    parser.add_argument(
        "--real-output",
        default=None,
        help="Optional path to output real-data qualitative predictions JSONL.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing output files if they exist.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=16,
        help="Inference batch size (default: 16).",
    )

    args = parser.parse_args()

    # Mode 1: Real dataset qualitative inference
    if args.real_parquet:
        if not args.real_output:
            print("Error: --real-output is required when --real-parquet is specified.", file=sys.stderr)
            sys.exit(1)

        if args.compare_with:
            print(f"Running dual qualitative comparison on {args.real_parquet}...")
            comp_summary = run_real_dataset_comparison(
                parquet_path=args.real_parquet,
                output_path=args.real_output,
                model_1=args.model,
                model_2=args.compare_with,
                overwrite=args.overwrite,
            )
            print(f"Completed dual inference on {comp_summary['total_records']} records.")
            print(f"Agreement rate: {comp_summary['agreement_rate'] * 100:.1f}% ({comp_summary['agreements']} agreed, {comp_summary['disagreements']} disagreed).")
            print(f"Saved side-by-side qualitative comparisons to:\n  {args.real_output}")
            return
        else:
            print(f"Running qualitative sentiment inference on {args.real_parquet}...")
            results = run_real_dataset_inference(
                parquet_path=args.real_parquet,
                output_path=args.real_output,
                model_id=args.model,
                overwrite=args.overwrite,
            )
            print(f"Completed inference on {len(results)} records. Saved to:\n  {args.real_output}")
            return

    # Mode 2: Benchmark evaluation & comparison
    if not args.input:
        print("Error: --input benchmark dataset is required.", file=sys.stderr)
        sys.exit(1)

    input_path = Path(args.input).resolve()
    if not input_path.is_file():
        print(f"Error: Evaluation dataset not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    # Comparative evaluation mode
    if args.compare_with:
        print(f"Running comparative evaluation on {input_path.name}...")
        print(f"Initializing Model 1: {args.model}...")
        t0 = time.perf_counter()
        adapter_1 = SentimentModelAdapter(args.model)
        load_1 = time.perf_counter() - t0

        print(f"Initializing Model 2: {args.compare_with}...")
        t0 = time.perf_counter()
        adapter_2 = SentimentModelAdapter(args.compare_with)
        load_2 = time.perf_counter() - t0

        print(f"Evaluating Model 1: {args.model}...")
        summary_1, preds_1 = evaluate_model_profile(adapter_1, input_path, load_time_seconds=load_1, batch_size=args.batch_size)

        print(f"Evaluating Model 2: {args.compare_with}...")
        summary_2, preds_2 = evaluate_model_profile(adapter_2, input_path, load_time_seconds=load_2, batch_size=args.batch_size)

        # Build comparison object (Model 1 = English or base, Model 2 = Multilingual)
        rec, rec_reason = generate_comparison_recommendation(summary_1, summary_2)
        lang_deltas: dict[str, dict[str, float]] = {}
        for l in summary_1.language_metrics:
            if l in summary_2.language_metrics:
                lang_deltas[l] = {
                    "delta_accuracy": round(summary_2.language_metrics[l].accuracy - summary_1.language_metrics[l].accuracy, 4),
                    "delta_macro_f1": round(summary_2.language_metrics[l].macro_f1 - summary_1.language_metrics[l].macro_f1, 4),
                }

        comparison = SentimentModelComparison(
            benchmark_dataset=input_path.name,
            english_model=summary_1,
            multilingual_model=summary_2,
            delta_accuracy=round(summary_2.accuracy - summary_1.accuracy, 4),
            delta_macro_f1=round(summary_2.macro_f1 - summary_1.macro_f1, 4),
            language_deltas=lang_deltas,
            recommendation=rec,
            recommendation_reason=rec_reason,
            limitations="The Hindi and Russian sample sizes (n=2 each) are pilot evaluation samples and not statistically representative population benchmarks.",
        )

        print()
        print(_format_comparison_display(comparison))

        if args.output:
            out_path = Path(args.output).resolve()
            try:
                comparison.save_json(out_path, overwrite=args.overwrite)
                print(f"\nComparative evaluation report saved to:\n  {out_path}")
            except FileExistsError as err:
                print(f"\nError: {err}", file=sys.stderr)
                sys.exit(1)
        return

    # Single-model evaluation mode
    print(f"Initializing adapter for '{args.model}'...")
    try:
        adapter = SentimentModelAdapter(args.model)
    except Exception as exc:
        print(f"Error loading model '{args.model}': {exc}", file=sys.stderr)
        sys.exit(1)

    print(f"Evaluating {args.model} on {input_path.name}...")
    result, predictions = evaluate_model(
        adapter,
        input_path,
        batch_size=args.batch_size,
    )

    print()
    print(_format_cli_evaluation(result))

    if args.output:
        out_path = Path(args.output).resolve()
        try:
            result.save_json(out_path, overwrite=args.overwrite)
            print(f"\nEvaluation summary report saved to:\n  {out_path}")
        except FileExistsError as err:
            print(f"\nError: {err}", file=sys.stderr)
            sys.exit(1)

    if args.predictions_output:
        pred_path = Path(args.predictions_output).resolve()
        if pred_path.exists() and not args.overwrite:
            print(f"\nError: Predictions file already exists: {pred_path}", file=sys.stderr)
            sys.exit(1)
        pred_path.parent.mkdir(parents=True, exist_ok=True)
        with open(pred_path, "w", encoding="utf-8") as f:
            for p in predictions:
                f.write(json.dumps(p.model_dump(), ensure_ascii=False) + "\n")
        print(f"Detailed predictions saved to:\n  {pred_path}")


if __name__ == "__main__":
    _main()


