"""
Milestone 8E: Emerging Trend Forecasting Service.

Implements business logic, validation, and domain operations for the
Emerging Trend Forecasting subsystem. Injects the ForecastArtifactRepository
to retrieve precomputed forecasts with zero runtime inference overhead.
"""

import logging

from app.repositories.forecast_repository import ForecastArtifactRepository, get_forecast_repository
from app.schemas.forecasting import (
    EmergingTrendForecast,
    EmergingTrendsApiResponse,
    ForecastArtifactSummary,
    ForecastTier,
    ForecastingStatusResponse,
)

logger = logging.getLogger("traject.services.forecast")

SUPPORTED_HORIZONS: set[int] = {24, 6}


class EmergingTrendForecastService:
    """Service layer coordinating emerging trend forecast retrieval and filtering."""

    def __init__(self, repository: ForecastArtifactRepository | None = None) -> None:
        self._repository = repository or get_forecast_repository()

    def get_emerging_trends(
        self,
        horizon_hours: int = 24,
        min_score: float = 0.0,
        tier: ForecastTier | None = None,
        limit: int = 50,
    ) -> EmergingTrendsApiResponse:
        """Retrieve filtered, canonically ranked forecasts within an API envelope.
        
        Args:
            horizon_hours: Forecast horizon in hours. Must be 24 (primary) or 6 (auxiliary).
            min_score: Minimum emerging trend score filter [0.0, 1.0].
            tier: Optional categorical tier filter.
            limit: Maximum number of forecasts to return [1, 200].
            
        Returns:
            EmergingTrendsApiResponse envelope with artifact metadata summary and forecast items.
            
        Raises:
            ValueError: If horizon_hours, min_score, or limit are invalid.
            FileNotFoundError: If the precomputed forecast artifact does not exist on disk.
        """
        if horizon_hours not in SUPPORTED_HORIZONS:
            raise ValueError(
                f"Unsupported horizon_hours: {horizon_hours}. Supported horizons: {sorted(SUPPORTED_HORIZONS)}"
            )

        if not (0.0 <= min_score <= 1.0):
            raise ValueError(f"min_score must be between 0.0 and 1.0, got {min_score}")

        if not (1 <= limit <= 200):
            raise ValueError(f"limit must be between 1 and 200, got {limit}")

        summary, forecasts = self._repository.get_forecasts(
            horizon_hours=horizon_hours,
            min_score=min_score,
            tier=tier,
            limit=limit,
        )

        return EmergingTrendsApiResponse(
            artifact=summary,
            forecasts=forecasts,
        )

    def get_status(self) -> ForecastingStatusResponse:
        """Retrieve operational health, availability, and provenance metadata."""
        return self._repository.get_status()


def get_forecast_service(
    repository: ForecastArtifactRepository | None = None,
) -> EmergingTrendForecastService:
    """Factory provider for EmergingTrendForecastService."""
    return EmergingTrendForecastService(repository=repository)
