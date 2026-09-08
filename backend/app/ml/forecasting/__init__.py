"""
Milestone 8C / 8C.1: Emerging Trend Forecasting Package.
"""
from app.ml.forecasting.backtest import WalkForwardBacktester
from app.ml.forecasting.causal_topic import (
    CausalTopicRepresentation,
    build_causal_topics,
    project_future_messages_to_causal_topics,
)
from app.ml.forecasting.engine import EmergingTrendForecastingEngine, ForecastingStrategy

__all__ = [
    "WalkForwardBacktester",
    "CausalTopicRepresentation",
    "build_causal_topics",
    "project_future_messages_to_causal_topics",
    "EmergingTrendForecastingEngine",
    "ForecastingStrategy",
]
