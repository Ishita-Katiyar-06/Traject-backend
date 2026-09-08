"""
Milestone 8D: Emerging Trend Forecasting Engine Runner & Evaluation Script.

Executes:
1. Production batch forecast artifact generation at the latest available cutoff.
2. 6-cutoff walk-forward backtest evaluating Baselines A, B, C, D, and E (Combined Emerging Trend Score).
3. Calibration & weight analysis comparing developmental cutoffs (1-3) vs test cutoffs (4-6).
4. Persists immutable forecast artifact to data/processed/telegram/emerging_trend_forecasts.json.
5. Persists evaluation report to data/reports/forecasting_engine_8d_report.json.
"""

from datetime import datetime, timezone
import json
import logging
from pathlib import Path

from app.core.config import find_repo_root
from app.ml.forecasting.backtest import WalkForwardBacktester
from app.ml.forecasting.engine import EmergingTrendForecastingEngine
from app.storage.engagement_observations import read_engagement_observations
from app.storage.parquet import read_canonical_messages

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("milestone_8d_forecast")


def main():
    repo_root = find_repo_root()
    parquet_path = repo_root / "data" / "processed" / "telegram" / "telegram_messages.parquet"
    obs_path = repo_root / "data" / "processed" / "telegram" / "telegram_engagement_observations.parquet"
    forecast_output_path = repo_root / "data" / "processed" / "telegram" / "emerging_trend_forecasts.json"
    report_output_path = repo_root / "data" / "reports" / "forecasting_engine_8d_report.json"

    logger.info("Loading canonical messages from %s", parquet_path)
    messages = read_canonical_messages(parquet_path)
    logger.info("Loaded %d canonical messages.", len(messages))

    obs = []
    if obs_path.exists():
        logger.info("Loading engagement observations from %s", obs_path)
        obs = read_engagement_observations(obs_path)
        logger.info("Loaded %d engagement observations.", len(obs))

    # 1. Define the 6 chronological walk-forward cutoffs
    cutoffs = [
        datetime(2026, 8, 31, 12, 0, 0, tzinfo=timezone.utc),
        datetime(2026, 9, 1, 12, 0, 0, tzinfo=timezone.utc),
        datetime(2026, 9, 2, 12, 0, 0, tzinfo=timezone.utc),
        datetime(2026, 9, 3, 12, 0, 0, tzinfo=timezone.utc),
        datetime(2026, 9, 4, 12, 0, 0, tzinfo=timezone.utc),
        datetime(2026, 9, 5, 12, 0, 0, tzinfo=timezone.utc),
    ]

    # 2. Run Primary 24-Hour Walk-Forward Backtest
    logger.info("Starting Walk-Forward Backtest (Horizon H=24h) with Baselines A, B, C, D, and E (Combined)...")
    tester = WalkForwardBacktester(
        messages=messages,
        engagement_observations=obs,
        history_window_days=30.0,
    )
    artifact_24h = tester.run_walk_forward_backtest(
        cutoff_timestamps=cutoffs,
        horizon_hours=24,
        lookback_hours=48.0,
        prominence_percentile=0.85,
    )

    # 3. Run Auxiliary 6-Hour Walk-Forward Backtest
    logger.info("Starting Auxiliary Walk-Forward Backtest (Horizon H=6h)...")
    artifact_6h = tester.run_walk_forward_backtest(
        cutoff_timestamps=cutoffs,
        horizon_hours=6,
        lookback_hours=48.0,
        prominence_percentile=0.85,
    )

    # 4. Generate Production Batch Forecast Artifact for Latest Cutoff (2026-09-05 12:00:00 UTC)
    latest_cutoff = cutoffs[-1]
    logger.info("Generating production batch forecast artifact for latest cutoff: %s", latest_cutoff)
    engine = EmergingTrendForecastingEngine()
    forecast_artifact = engine.generate_forecast_artifact(
        messages=messages,
        cutoff_at=latest_cutoff,
        engagement_observations=obs,
        history_window_days=30.0,
        lookback_hours=48.0,
        horizon_hours=24,
        output_path=forecast_output_path,
    )
    logger.info("Generated %d topic forecasts in %s", len(forecast_artifact.forecasts), forecast_output_path)

    # 5. Compile Comprehensive Report
    report = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "selected_production_strategy": "volume_velocity_hybrid",
        "production_strategy_version": "8D.1_production_freeze",
        "score_formula": "0.50 * within_cutoff_percentile(messages_24h) + 0.50 * within_cutoff_percentile(velocity_6h)",
        "primary_horizon_24h": artifact_24h.model_dump(mode="json"),
        "auxiliary_horizon_6h": artifact_6h.model_dump(mode="json"),
        "latest_forecast_summary": {
            "artifact_id": forecast_artifact.artifact_id,
            "cutoff_at_utc": forecast_artifact.cutoff_at_utc.isoformat(),
            "forecasting_strategy": forecast_artifact.metadata.get("forecasting_strategy"),
            "total_candidates": forecast_artifact.total_candidate_topics,
            "top_emerging_topics": [
                {
                    "rank": fc.forecast_rank,
                    "topic_id": fc.topic_id,
                    "score": fc.forecast_score,
                    "tier": fc.forecast_tier.value,
                    "trajectory": fc.trajectory_phase.value,
                    "confidence": fc.confidence_tier.value,
                    "recent_messages": fc.recent_message_count,
                    "velocity_6h": fc.growth_velocity,
                    "diffusion_rate": fc.channel_diffusion_rate,
                }
                for fc in forecast_artifact.forecasts[:10]
            ],
        },
    }

    report_8d1_path = repo_root / "data" / "reports" / "forecasting_strategy_8d1_report.json"
    report_output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(report_output_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    with open(report_8d1_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    logger.info("Saved reports to %s and %s", report_output_path, report_8d1_path)

    # 6. Print Summary Tables
    print("\n=========================================================================================")
    print("                 MILESTONE 8D.1 PRODUCTION STRATEGY BENCHMARK (H=24h)                    ")
    print("=========================================================================================")
    print(f"{'Baseline / Strategy':<28} | {'ROC-AUC':<8} | {'PR-AUC':<8} | {'F1':<6} | {'P@5':<6} | {'P@10':<6} | {'R@10':<6}")
    print("-----------------------------------------------------------------------------------------")
    for name, res in artifact_24h.baseline_results.items():
        print(f"{name:<28} | {res.roc_auc:<8.4f} | {res.pr_auc:<8.4f} | {res.f1:<6.4f} | {res.precision_at_5:<6.4f} | {res.precision_at_10:<6.4f} | {res.recall_at_10:<6.4f}")
    print("=========================================================================================\n")


if __name__ == "__main__":
    main()
