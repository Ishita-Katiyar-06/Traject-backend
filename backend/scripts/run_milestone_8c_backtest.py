"""Run Milestone 8C: Emerging Trend Forecasting - Target Definition & Walk-Forward Backtesting.

This script executes the deterministic walk-forward evaluation protocol across
historical cutoff points on real Telegram messages and frozen topic clusters.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import List

from app.ml.forecasting.backtest import WalkForwardBacktester
from app.schemas.forecasting import WalkForwardBacktestArtifact

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def run_milestone_8c():
    backend_dir = Path(__file__).resolve().parent.parent
    project_root = backend_dir.parent
    data_dir = project_root / "data"
    parquet_path = data_dir / "processed" / "telegram" / "telegram_messages.parquet"
    artifact_path = data_dir / "processed" / "telegram" / "telegram_messages-analytics-artifact.json"
    observations_path = data_dir / "processed" / "telegram" / "telegram_engagement_observations.parquet"
    output_report_path = data_dir / "reports" / "forecasting_backtest_8c.json"
    output_report_path.parent.mkdir(parents=True, exist_ok=True)

    logger.info("Initializing WalkForwardBacktester from real artifacts...")
    backtester = WalkForwardBacktester.from_artifacts(
        messages_path=parquet_path if parquet_path.exists() else None,
        artifact_path=artifact_path if artifact_path.exists() else None,
        observations_path=observations_path if observations_path.exists() else None,
    )

    n_msgs = len(backtester.messages) if backtester.messages is not None else len(backtester.topic_messages)
    logger.info(
        f"Loaded backtester with {n_msgs} corpus messages."
    )

    # 6 historical evaluation cutoffs during high-density window
    cutoffs: List[datetime] = [
        datetime(2026, 8, 31, 12, 0, tzinfo=timezone.utc),
        datetime(2026, 9, 1, 12, 0, tzinfo=timezone.utc),
        datetime(2026, 9, 2, 12, 0, tzinfo=timezone.utc),
        datetime(2026, 9, 3, 12, 0, tzinfo=timezone.utc),
        datetime(2026, 9, 4, 12, 0, tzinfo=timezone.utc),
        datetime(2026, 9, 5, 12, 0, tzinfo=timezone.utc),
    ]

    print("=" * 80)
    print("MILESTONE 8C: WALK-FORWARD BACKTEST EXECUTION (REAL ARTIFACTS)")
    print("=" * 80)

    # Run for 24h primary horizon
    logger.info("Executing Walk-Forward Backtest for Primary Horizon H=24h...")
    artifact_24h = backtester.run_walk_forward_backtest(
        cutoff_timestamps=cutoffs,
        horizon_hours=24,
    )

    # Run for 6h auxiliary horizon
    logger.info("Executing Walk-Forward Backtest for Auxiliary Horizon H=6h...")
    artifact_6h = backtester.run_walk_forward_backtest(
        cutoff_timestamps=cutoffs,
        horizon_hours=6,
    )

    total_eval_24h = sum(c.candidate_topics_count for c in artifact_24h.cutoffs)
    total_eval_6h = sum(c.candidate_topics_count for c in artifact_6h.cutoffs)

    # 1. Print Cutoff Table for 24h
    print("\n" + "=" * 115)
    print("HISTORICAL CUTOFF & ACCOUNTING SUMMARY (PRIMARY HORIZON H=24h)")
    print("=" * 115)
    print(f"{'Cutoff ID':<22} | {'Timestamp (UTC)':<18} | {'Total <=T':<9} | {'Cand Msgs':<9} | {'Excl Msgs':<9} | {'Cands':<5} | {'Active':<6} | {'Zeros':<5} | {'Prom':<5} | {'Pos %':<6}")
    print("-" * 115)
    for c in artifact_24h.cutoffs:
        t_str = c.cutoff_at_utc.strftime("%Y-%m-%d %H:%M")
        print(f"{c.cutoff_id:<22} | {t_str:<18} | {c.total_messages_available:<9} | {c.candidate_messages_count:<9} | {c.excluded_messages_count:<9} | {c.candidate_topics_count:<5} | {c.active_future_topics_count:<6} | {c.zero_future_topics_count:<5} | {c.prominent_future_topics_count:<5} | {c.positive_percentage:<5.1f}%")

    # 2. Print Per-Cutoff Baseline Results for 24h
    print("\n" + "=" * 95)
    print("PER-CUTOFF BASELINE RESULTS (PRIMARY HORIZON H=24h)")
    print("=" * 95)
    for c in artifact_24h.cutoffs:
        t_str = c.cutoff_at_utc.strftime("%Y-%m-%d %H:%M")
        c_res = artifact_24h.per_cutoff_baseline_results.get(c.cutoff_id, {})
        print(f"\nCutoff {c.cutoff_id} ({t_str}) — Candidates: {c.candidate_topics_count}, Prominent: {c.prominent_future_topics_count} ({c.positive_percentage:.1f}%):")
        print(f"  {'Baseline':<26} | {'ROC-AUC':<8} | {'PR-AUC':<8} | {'P@5':<6} | {'P@10':<6} | {'R@10':<6}")
        print("  " + "-" * 70)
        for b_name in ["BaselineA_Volume", "BaselineB_Velocity", "BaselineC_Growth", "BaselineD_Kinetics"]:
            b = c_res.get(b_name)
            if b:
                roc_str = f"{b.roc_auc:.4f}" if b.roc_auc is not None else "N/A"
                pr_str = f"{b.pr_auc:.4f}" if b.pr_auc is not None else "N/A"
                print(f"  {b.baseline_name:<26} | {roc_str:<8} | {pr_str:<8} | {b.precision_at_5:<6.4f} | {b.precision_at_10:<6.4f} | {b.recall_at_10:<6.4f}")

    # 3. Print Aggregate Summary Results for 24h
    print("\n" + "=" * 95)
    print(f"AGGREGATE RESULTS: PRIMARY HORIZON H=24h ({total_eval_24h} topic-cutoff instances, {artifact_24h.data_quality_summary['positive_samples']} positives [{artifact_24h.data_quality_summary['positive_rate']*100:.1f}%])")
    print("=" * 95)
    print(f"{'Baseline':<28} | {'ROC-AUC':<8} | {'PR-AUC':<8} | {'F1':<6} | {'P@5':<6} | {'P@10':<6} | {'R@10':<6}")
    print("-" * 95)
    for b in artifact_24h.baseline_results.values():
        roc_str = f"{b.roc_auc:.4f}" if b.roc_auc is not None else "N/A"
        pr_str = f"{b.pr_auc:.4f}" if b.pr_auc is not None else "N/A"
        print(
            f"{b.baseline_name:<28} | {roc_str:<8} | {pr_str:<8} | {b.f1:<6.4f} | {b.precision_at_5:<6.4f} | {b.precision_at_10:<6.4f} | {b.recall_at_10:<6.4f}"
        )

    # 4. Print Aggregate Summary Results for 6h
    print("\n" + "=" * 95)
    print(f"AGGREGATE RESULTS: AUXILIARY HORIZON H=6h ({total_eval_6h} topic-cutoff instances, {artifact_6h.data_quality_summary['positive_samples']} positives [{artifact_6h.data_quality_summary['positive_rate']*100:.1f}%])")
    print("=" * 95)
    print(f"{'Baseline':<28} | {'ROC-AUC':<8} | {'PR-AUC':<8} | {'F1':<6} | {'P@5':<6} | {'P@10':<6} | {'R@10':<6}")
    print("-" * 95)
    for b in artifact_6h.baseline_results.values():
        roc_str = f"{b.roc_auc:.4f}" if b.roc_auc is not None else "N/A"
        pr_str = f"{b.pr_auc:.4f}" if b.pr_auc is not None else "N/A"
        print(
            f"{b.baseline_name:<28} | {roc_str:<8} | {pr_str:<8} | {b.f1:<6.4f} | {b.precision_at_5:<6.4f} | {b.precision_at_10:<6.4f} | {b.recall_at_10:<6.4f}"
        )

    # Save comprehensive report artifact
    combined_report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "primary_horizon_24h": artifact_24h.model_dump(mode="json"),
        "auxiliary_horizon_6h": artifact_6h.model_dump(mode="json"),
    }

    with open(output_report_path, "w", encoding="utf-8") as f:
        json.dump(combined_report, f, indent=2)

    logger.info(f"Saved complete 8C backtest report to: {output_report_path}")
    print(f"\nReport generated at: {output_report_path}")


if __name__ == "__main__":
    run_milestone_8c()
