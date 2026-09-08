"""
Milestone 8D: Emerging Trend Forecasting Engine.

Implements a deterministic, interpretable, reproducible, and causally validated
forecasting engine that predicts future topic prominence over a 24-hour horizon.

Product Semantics:
- Unit: Topic
- Score: Emerging Trend Score (relative momentum/prominence likelihood in [0.0, 1.0])
- Horizon: Next 24 Hours (6-Hour auxiliary)
- Tiers: STRONG_EMERGENCE, MODERATE_EMERGENCE, EARLY_SIGNAL, LOW_MOMENTUM
- Trajectory: ACCELERATING, GROWING, PERSISTENT, STABLE, WEAKENING, INSUFFICIENT_DATA
- Confidence: HIGH, MEDIUM, LOW, INSUFFICIENT_DATA

All feature normalization is computed strictly within the candidate population at cutoff T.
Zero future information is accessed.
"""

from collections import Counter
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
from typing import Any, Mapping, Sequence

from enum import StrEnum
from app.schemas.canonical_message import CanonicalMessage
from app.schemas.engagement_observation import EngagementObservation
from app.schemas.forecasting import (
    ConfidenceTier,
    EmergingTrendForecast,
    EmergingTrendForecastArtifact,
    ForecastTier,
    TrajectoryPhase,
)
from app.schemas.topic_kinetics import TopicTemporalKinetics
from app.temporal.kinetics import compute_topic_temporal_kinetics

logger = logging.getLogger(__name__)


class ForecastingStrategy(StrEnum):
    """Supported emerging trend forecast ranking strategies."""
    VOLUME = "volume"
    VELOCITY = "velocity"
    VOLUME_VELOCITY_HYBRID = "volume_velocity_hybrid"
    COMPOSITE_EXPERIMENTAL = "composite_experimental"


class EmergingTrendForecastingEngine:
    """Production-oriented deterministic forecasting engine for emerging topics."""

    DEFAULT_WEIGHTS: dict[str, float] = {
        "velocity": 0.35,
        "volume": 0.30,
        "growth": 0.15,
        "diffusion": 0.10,
        "persistence": 0.10,
    }

    def __init__(
        self,
        strategy: ForecastingStrategy | str = ForecastingStrategy.VOLUME_VELOCITY_HYBRID,
        weights: Mapping[str, float] | None = None,
        score_version: str = "8D.1_vol_vel_hybrid_v1",
    ):
        if isinstance(strategy, str):
            strategy = ForecastingStrategy(strategy)
        self.strategy = strategy
        raw_weights = dict(weights or self.DEFAULT_WEIGHTS)
        total_w = sum(raw_weights.values())
        if total_w <= 0.0:
            raise ValueError(f"Sum of feature weights must be positive, got {total_w}")
        # Normalize weights to sum to 1.0
        self.weights = {k: round(v / total_w, 4) for k, v in raw_weights.items()}
        self.score_version = score_version

    @staticmethod
    def compute_within_cutoff_percentiles(values: Sequence[float]) -> list[float]:
        """Compute mid-rank (fractional ranking) percentiles strictly within a population at T.

        Returns values in [0.0, 1.0]. If all values are 0.0, all percentiles return 0.0.
        """
        n = len(values)
        if n == 0:
            return []
        if all(v == 0.0 for v in values):
            return [0.0] * n

        # Count frequencies for ties
        counts = Counter(values)
        accum = 0
        val_to_pct: dict[float, float] = {}
        for val, count in sorted(counts.items()):
            if val <= 0.0:
                val_to_pct[val] = 0.0
            else:
                mid_rank = accum + (count + 1) / 2.0
                val_to_pct[val] = round(mid_rank / n, 4)
            accum += count

        return [val_to_pct.get(v, 0.0) for v in values]

    @staticmethod
    def classify_trajectory_phase(feat: TopicTemporalKinetics) -> TrajectoryPhase:
        """Deterministic trajectory phase classification based strictly on causal 8A kinetics."""
        # 1. Check data sufficiency
        if feat.total_historical_messages < 3 or feat.messages_24h == 0:
            return TrajectoryPhase.INSUFFICIENT_DATA

        acc_24 = feat.acceleration_24h or 0.0
        acc_6 = feat.acceleration_6h or 0.0
        vel_chg_6 = feat.velocity_change_6h or 0.0
        vol_ratio = feat.volume_ratio_24h

        # 2. Accelerating: positive rate-of-change of velocity
        if feat.acceleration_available and (acc_24 > 0.0 or acc_6 > 0.0) and vel_chg_6 > 0.0:
            return TrajectoryPhase.ACCELERATING

        # 3. Growing: positive velocity change or strong volume expansion over prior 24h
        if vel_chg_6 > 0.0 or vol_ratio > 1.2:
            return TrajectoryPhase.GROWING

        # 4. Weakening: negative velocity change and dropping below historical baseline
        if vel_chg_6 < 0.0 and vol_ratio < 0.8:
            return TrajectoryPhase.WEAKENING

        # 5. Persistent: active across the majority of 24h windows with consistent volume
        if feat.active_window_count_24h >= 12 and 0.8 <= vol_ratio <= 1.2:
            return TrajectoryPhase.PERSISTENT

        # 6. Stable: steady baseline parity
        if 0.8 <= vol_ratio <= 1.2:
            return TrajectoryPhase.STABLE

        return TrajectoryPhase.INSUFFICIENT_DATA

    @staticmethod
    def classify_confidence_tier(feat: TopicTemporalKinetics) -> ConfidenceTier:
        """Deterministic confidence tier based on historical data depth at cutoff T.

        Reflects amount of evidence, multi-channel corroboration, and window coverage.
        Does NOT use any future information.
        """
        total_msgs = feat.total_historical_messages
        channels = feat.distinct_channels_24h
        active_windows = feat.active_window_count_24h

        if total_msgs >= 15 and channels >= 3 and active_windows >= 6 and feat.acceleration_available:
            return ConfidenceTier.HIGH
        elif total_msgs >= 5 and channels >= 2 and active_windows >= 3:
            return ConfidenceTier.MEDIUM
        elif total_msgs >= 3:
            return ConfidenceTier.LOW
        else:
            return ConfidenceTier.INSUFFICIENT_DATA

    def score_candidates(
        self,
        features_map: Mapping[str, TopicTemporalKinetics],
        cutoff_at: datetime,
        horizon_hours: int = 24,
    ) -> list[EmergingTrendForecast]:
        """Generate deterministic, ranked EmergingTrendForecast records for candidate topics at cutoff T.

        All normalization is computed strictly within the candidate population at cutoff T.
        """
        candidate_ids = sorted(features_map.keys())
        n = len(candidate_ids)
        if n == 0:
            return []

        now_utc = datetime.now(timezone.utc)

        # 1. Extract raw candidate feature vectors
        raw_velocity: list[float] = []
        raw_volume: list[float] = []
        raw_growth: list[float] = []
        raw_diffusion: list[float] = []
        raw_persistence: list[float] = []

        for t_id in candidate_ids:
            feat = features_map[t_id]
            # Velocity: 6h hourly rate
            raw_velocity.append(float(feat.velocity_6h))
            # Volume: 24h messages
            raw_volume.append(float(feat.messages_24h))
            # Growth: positive velocity change combined with volume ratio
            growth_mult = 1.0 + max(feat.velocity_change_6h or 0.0, 0.0)
            raw_growth.append(float(feat.velocity_6h * growth_mult))
            # Diffusion: channel diffusion rate in 24h
            raw_diffusion.append(float(feat.channel_diffusion_rate_24h))
            # Persistence: active hourly window coverage in 24h
            raw_persistence.append(float(feat.active_window_count_24h / 24.0))

        # 2. Within-cutoff causal percentile normalization (strictly <= T)
        norm_velocity = self.compute_within_cutoff_percentiles(raw_velocity)
        norm_volume = self.compute_within_cutoff_percentiles(raw_volume)
        norm_growth = self.compute_within_cutoff_percentiles(raw_growth)
        norm_diffusion = self.compute_within_cutoff_percentiles(raw_diffusion)
        norm_persistence = self.compute_within_cutoff_percentiles(raw_persistence)

        # 3. Compute Emerging Trend Score based on selected strategy
        w_vel = self.weights.get("velocity", 0.35)
        w_vol = self.weights.get("volume", 0.30)
        w_gro = self.weights.get("growth", 0.15)
        w_dif = self.weights.get("diffusion", 0.10)
        w_per = self.weights.get("persistence", 0.10)

        unranked_forecasts: list[dict[str, Any]] = []
        for i, t_id in enumerate(candidate_ids):
            feat = features_map[t_id]
            
            if self.strategy == ForecastingStrategy.VOLUME_VELOCITY_HYBRID:
                # Minimal validated 50/50 Volume + Velocity hybrid
                score = 0.50 * norm_volume[i] + 0.50 * norm_velocity[i]
            elif self.strategy == ForecastingStrategy.VOLUME:
                score = norm_volume[i]
            elif self.strategy == ForecastingStrategy.VELOCITY:
                score = norm_velocity[i]
            elif self.strategy == ForecastingStrategy.COMPOSITE_EXPERIMENTAL:
                score = (
                    w_vel * norm_velocity[i]
                    + w_vol * norm_volume[i]
                    + w_gro * norm_growth[i]
                    + w_dif * norm_diffusion[i]
                    + w_per * norm_persistence[i]
                )
            else:
                score = 0.50 * norm_volume[i] + 0.50 * norm_velocity[i]

            # Bound score strictly in [0.0, 1.0]
            bounded_score = round(max(0.0, min(1.0, score)), 4)

            trajectory = self.classify_trajectory_phase(feat)
            confidence = self.classify_confidence_tier(feat)

            # Feature availability flags
            has_eng = bool(getattr(feat, "engagement_features_available", False) and (feat.observed_views_delta_24h is not None))

            unranked_forecasts.append({
                "topic_id": t_id,
                "score": bounded_score,
                "feat": feat,
                "trajectory": trajectory,
                "confidence": confidence,
                "engagement_available": has_eng,
            })

        # 4. Rank candidates descending by score (secondary sort by velocity descending, then topic_id)
        ranked = sorted(
            unranked_forecasts,
            key=lambda x: (x["score"], x["feat"].velocity_6h, x["feat"].messages_24h),
            reverse=True,
        )

        # 5. Assign forecast tiers and construct final immutable schemas
        top_10_count = max(1, int(round(0.10 * n)))
        top_25_count = max(top_10_count + 1, int(round(0.25 * n)))
        top_50_count = max(top_25_count + 1, int(round(0.50 * n)))

        results: list[EmergingTrendForecast] = []
        for rank_idx, item in enumerate(ranked):
            rank = rank_idx + 1
            feat = item["feat"]

            if rank <= top_10_count:
                tier = ForecastTier.STRONG_EMERGENCE
            elif rank <= top_25_count:
                tier = ForecastTier.MODERATE_EMERGENCE
            elif rank <= top_50_count:
                tier = ForecastTier.EARLY_SIGNAL
            else:
                tier = ForecastTier.LOW_MOMENTUM

            results.append(
                EmergingTrendForecast(
                    topic_id=item["topic_id"],
                    cutoff_at=cutoff_at,
                    horizon_hours=horizon_hours,
                    forecast_score=item["score"],
                    forecast_rank=rank,
                    forecast_tier=tier,
                    trajectory_phase=item["trajectory"],
                    confidence_tier=item["confidence"],
                    historical_message_count=feat.total_historical_messages,
                    recent_message_count=feat.messages_24h,
                    messages_24h=feat.messages_24h,
                    baseline_message_count=feat.baseline_messages_24h,
                    growth_velocity=round(feat.velocity_6h, 4),
                    velocity_6h=round(feat.velocity_6h, 4),
                    acceleration_factor=round(feat.acceleration_24h, 4) if feat.acceleration_24h is not None else None,
                    persistence_score=round(feat.active_window_count_24h / 24.0, 4),
                    channel_diffusion_rate=round(feat.channel_diffusion_rate_24h, 4),
                    domain_diffusion_rate=round(feat.new_domains_24h / 24.0, 4) if hasattr(feat, "new_domains_24h") else 0.0,
                    burstiness_index=round(feat.burstiness_index, 4) if feat.burstiness_index is not None else None,
                    publication_kinetics_available=True,
                    acceleration_available=feat.acceleration_available,
                    engagement_signal_available=item["engagement_available"],
                    generated_at=now_utc,
                )
            )

        return results

    def generate_forecast_artifact(
        self,
        messages: Sequence[CanonicalMessage],
        cutoff_at: datetime,
        engagement_observations: Sequence[EngagementObservation] = (),
        source_domain_map: Mapping[str, str] | None = None,
        history_window_days: float = 30.0,
        lookback_hours: float = 48.0,
        horizon_hours: int = 24,
        output_path: Path | None = None,
    ) -> EmergingTrendForecastArtifact:
        """Build causal representation, extract kinetics, and generate immutable batch forecast artifact."""
        from app.ml.forecasting.causal_topic import build_causal_topics

        # 1. Build causal topic representation strictly <= cutoff_at
        rep = build_causal_topics(
            messages=messages,
            cutoff_at=cutoff_at,
            history_window_days=history_window_days,
            lookback_hours=lookback_hours,
        )

        candidates = sorted([t for t, p in rep.topic_profiles.items() if p.is_candidate])
        valid_obs = [ob for ob in engagement_observations if ob.observed_at <= cutoff_at]

        # 2. Extract deterministic kinetics strictly <= cutoff_at
        features_map: dict[str, TopicTemporalKinetics] = {}
        for t_id in candidates:
            past_msgs = rep.topic_messages.get(t_id, [])
            features_map[t_id] = compute_topic_temporal_kinetics(
                topic_id=t_id,
                messages=past_msgs,
                cutoff_at=cutoff_at,
                engagement_observations=valid_obs,
                source_domain_map=source_domain_map,
            )

        # 3. Score candidates with within-cutoff causal normalization
        forecasts = self.score_candidates(
            features_map=features_map,
            cutoff_at=cutoff_at,
            horizon_hours=horizon_hours,
        )

        artifact_slug = f"forecast_{cutoff_at.strftime('%Y%m%d_%H%M')}_h{horizon_hours}"
        artifact = EmergingTrendForecastArtifact(
            artifact_id=artifact_slug,
            generated_at_utc=datetime.now(timezone.utc),
            cutoff_at_utc=cutoff_at,
            horizon_hours=horizon_hours,
            causal_representation_version="8C.1_causal_hdbscan",
            feature_engine_version="8A_kinetics_v1",
            score_version=self.score_version,
            total_candidate_topics=len(forecasts),
            forecasts=forecasts,
            metadata={
                "forecasting_strategy": self.strategy.value,
                "forecasting_strategy_version": "8D.1_production_freeze",
                "feature_weights": self.weights if self.strategy == ForecastingStrategy.COMPOSITE_EXPERIMENTAL else {"volume": 0.50, "velocity": 0.50},
                "history_window_days": history_window_days,
                "lookback_hours": lookback_hours,
                "total_historical_messages_analyzed": rep.historical_messages_count,
            },
        )

        if output_path is not None:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(artifact.model_dump_json(indent=2))
            logger.info("Saved forecast artifact to %s", output_path)

        return artifact
