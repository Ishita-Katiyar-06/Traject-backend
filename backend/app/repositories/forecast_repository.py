"""
Milestone 8E: Forecast Artifact Repository.

Thread-safe, cached repository managing persistence, retrieval, schema validation,
and in-memory caching of precomputed Emerging Trend Forecast artifacts.
"""

from datetime import datetime, timezone
import json
import logging
from pathlib import Path
from threading import Lock
from typing import Any

from app.core.config import find_repo_root
from app.schemas.forecasting import (
    EmergingTrendForecast,
    EmergingTrendForecastArtifact,
    ForecastArtifactSummary,
    ForecastTier,
    ForecastingStatusResponse,
)

logger = logging.getLogger("traject.repositories.forecast")


class ForecastArtifactRepository:
    """Thread-safe cached query repository for precomputed forecast artifacts."""

    def __init__(self, artifact_path: Path | None = None) -> None:
        self.artifact_path = artifact_path or (
            find_repo_root() / "data" / "processed" / "telegram" / "emerging_trend_forecasts.json"
        )
        self._lock = Lock()
        self._cached_artifact: EmergingTrendForecastArtifact | None = None
        self._cached_mtime: float | None = None

    def _load_artifact(self) -> EmergingTrendForecastArtifact:
        """Load and validate the forecast artifact from disk with mtime-based caching."""
        with self._lock:
            if not self.artifact_path.is_file():
                raise FileNotFoundError(
                    f"Forecast artifact not found at {self.artifact_path}. Run batch forecasting first."
                )

            current_mtime = self.artifact_path.stat().st_mtime
            if self._cached_artifact is not None and self._cached_mtime == current_mtime:
                return self._cached_artifact

            logger.info("Loading forecast artifact from %s (mtime: %s)", self.artifact_path, current_mtime)
            try:
                with open(self.artifact_path, "r", encoding="utf-8") as f:
                    raw_data = json.load(f)
                artifact = EmergingTrendForecastArtifact.model_validate(raw_data)
            except Exception as exc:
                logger.error("Failed to parse forecast artifact at %s: %s", self.artifact_path, exc)
                raise ValueError(f"Corrupted forecast artifact at {self.artifact_path}: {exc}") from exc

            self._cached_artifact = artifact
            self._cached_mtime = current_mtime
            return artifact

    def get_artifact(self) -> EmergingTrendForecastArtifact:
        """Retrieve the current validated forecast artifact."""
        return self._load_artifact()

    def get_status(self) -> ForecastingStatusResponse:
        """Retrieve operational health, availability, and provenance metadata."""
        try:
            art = self._load_artifact()
            strat = art.metadata.get("forecasting_strategy") or "volume_velocity_hybrid"
            strat_ver = art.metadata.get("forecasting_strategy_version") or "8D.1_production_freeze"
            last_mod = None
            if self.artifact_path.is_file():
                last_mod = datetime.fromtimestamp(self.artifact_path.stat().st_mtime, tz=timezone.utc)
            return ForecastingStatusResponse(
                status="healthy",
                artifact_available=True,
                artifact_id=art.artifact_id,
                cutoff_at_utc=art.cutoff_at_utc,
                generated_at_utc=art.generated_at_utc,
                total_candidate_topics=art.total_candidate_topics,
                total_forecasts=len(art.forecasts),
                forecasting_strategy=strat,
                forecasting_strategy_version=strat_ver,
                score_version=art.score_version,
                horizon_hours=art.horizon_hours,
                supported_horizons=[24, 6],
                last_modified_utc=last_mod,
            )
        except FileNotFoundError:
            return ForecastingStatusResponse(
                status="degraded",
                artifact_available=False,
                total_candidate_topics=0,
                total_forecasts=0,
            )
        except Exception as exc:
            logger.warning("Forecast artifact status check encountered error: %s", exc)
            return ForecastingStatusResponse(
                status="error",
                artifact_available=False,
                total_candidate_topics=0,
                total_forecasts=0,
            )

    def get_forecasts(
        self,
        horizon_hours: int = 24,
        min_score: float = 0.0,
        tier: ForecastTier | None = None,
        limit: int = 50,
    ) -> tuple[ForecastArtifactSummary, list[EmergingTrendForecast]]:
        """Retrieve filtered, canonically ranked forecasts and summary metadata."""
        artifact = self._load_artifact()

        # Canonically sorted by forecast_rank ascending
        forecasts = sorted(artifact.forecasts, key=lambda fc: fc.forecast_rank)

        # 1. Filter by minimum score
        if min_score > 0.0:
            forecasts = [fc for fc in forecasts if fc.forecast_score >= min_score]

        # 2. Filter by categorical tier
        if tier is not None:
            forecasts = [fc for fc in forecasts if fc.forecast_tier == tier]

        # 3. Apply limit
        sliced_forecasts = forecasts[:limit]

        # 4. Enrich forecasts with topic names and representative keywords from topic catalog
        try:
            from app.repositories.artifact_repository import get_artifact_repository
            art_repo = get_artifact_repository()
            if art_repo.artifacts_loaded:
                for fc in sliced_forecasts:
                    t = art_repo.get_topic_by_id(fc.topic_id)
                    if t:
                        if not fc.topic_name:
                            fc.topic_name = t.trend_name or (", ".join(k.keyword for k in t.representative_keywords[:3]))
                        if not fc.topic_keywords and t.representative_keywords:
                            fc.topic_keywords = [k.keyword for k in t.representative_keywords[:5]]
        except Exception as enrich_exc:
            logger.debug("Could not enrich forecast topic names: %s", enrich_exc)
        strat = artifact.metadata.get("forecasting_strategy") or "volume_velocity_hybrid"
        strat_ver = artifact.metadata.get("forecasting_strategy_version") or "8D.1_production_freeze"

        summary = ForecastArtifactSummary(
            artifact_id=artifact.artifact_id,
            generated_at_utc=artifact.generated_at_utc,
            cutoff_at_utc=artifact.cutoff_at_utc,
            horizon_hours=artifact.horizon_hours,
            forecasting_strategy=strat,
            forecasting_strategy_version=strat_ver,
            score_version=artifact.score_version,
            total_candidate_topics=artifact.total_candidate_topics,
            returned_topics_count=len(sliced_forecasts),
            metadata=artifact.metadata,
        )

        return summary, sliced_forecasts


_shared_forecast_repository: ForecastArtifactRepository | None = None


def get_forecast_repository() -> ForecastArtifactRepository:
    """Dependency provider injecting the shared ForecastArtifactRepository."""
    global _shared_forecast_repository
    if _shared_forecast_repository is None:
        _shared_forecast_repository = ForecastArtifactRepository()
    return _shared_forecast_repository
