from pydantic import BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    """Operational health, liveness, and artifact readiness response model."""
    model_config = ConfigDict(extra="forbid")

    status: str = Field(description="Operational status: 'healthy' (all artifacts loaded) or 'degraded'")
    version: str = Field(description="API service release version")
    artifacts_loaded: bool = Field(description="True if precomputed analytics artifacts are loaded in memory")
    timestamp_utc: str = Field(description="Current system evaluation timestamp in UTC (ISO-8601)")
    dataset_source: str | None = Field(default=None, description="Active dataset identifier or filename")
    active_records_count: int | None = Field(default=None, description="Total canonical messages loaded in memory")
    active_narratives_count: int | None = Field(default=None, description="Total prioritized narratives loaded in memory")
