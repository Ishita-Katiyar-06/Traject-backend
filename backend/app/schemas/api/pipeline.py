from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class CacheStatus(BaseModel):
    """Current inference cache status."""
    model_config = ConfigDict(extra="forbid")

    enabled: bool
    hit_rate: float


class PipelineStatusResponse(BaseModel):
    """High-level status and provenance of the ML pipeline run."""
    model_config = ConfigDict(extra="forbid")

    status: str = Field(description="Pipeline status: 'idle', 'running', or 'completed'")
    dataset_source: str = Field(description="Dataset source identifier")
    created_at_utc: str = Field(description="Timestamp of pipeline completion (ISO-8601)")
    pipeline_version: str = Field(default="4h.v1")
    cache_status: CacheStatus | None = None

    # Milestone 6D additive collection and snapshot metadata
    collection_mode: str | None = Field(default=None, description="Collection operational mode (e.g. 'incremental')")
    last_collection_run: str | None = Field(default=None, description="Timestamp of most recent collection run (ISO-8601)")
    last_successful_collection: str | None = Field(default=None, description="Timestamp of latest successful collection run (ISO-8601)")
    source_count: int | None = Field(default=None, description="Total sources tracked")
    successful_source_count: int | None = Field(default=None, description="Number of sources successfully collected in last run")
    failed_source_count: int | None = Field(default=None, description="Number of sources that failed in last run")
    last_new_record_count: int | None = Field(default=None, description="Number of new canonical records added in last run")
    cumulative_record_count: int | None = Field(default=None, description="Total cumulative records in dataset")
    corpus_snapshot_id: str | None = Field(default=None, description="Unique snapshot identifier for underlying corpus")
    analytics_generated_at: str | None = Field(default=None, description="Timestamp when analytics artifact was generated")

    # Milestone 6E additive operational freshness and temporal monitoring
    analytics_current: bool = Field(default=True, description="True if analytics reflect latest corpus snapshot")
    stale_analytics_reason: str | None = Field(default=None, description="Operational explanation if analytics are stale")
    active_lineages_count: int | None = Field(default=None, description="Count of currently active temporal lineages")
    last_temporal_update: str | None = Field(default=None, description="Timestamp of latest temporal lineage update (ISO-8601)")


class StageLatencies(BaseModel):
    model_config = ConfigDict(extra="forbid")

    language_detection: float
    normalization: float
    sentiment_load: float
    sentiment_inference: float
    embedding_load: float
    embedding_inference: float
    topic_discovery: float
    feature_enrichment: float
    narrative_assessment: float
    total_runtime: float


class ExecutionBreakdown(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cold_start_time_seconds: float
    warm_inference_time_seconds: float


class ThroughputSamples(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sentiment: float
    embedding: float


class RecordAccounting(BaseModel):
    model_config = ConfigDict(extra="forbid")

    records_ingested: int
    records_processed: int
    records_skipped: int
    records_failed: int


class CachePerformance(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cache_hits: int
    cache_misses: int
    cache_hit_rate: float


class MemoryFootprint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    peak_process_rss_mb: float
    peak_python_heap_mb: float


class PipelineMetricsResponse(BaseModel):
    """Audit-ready observability and latency breakdown of the ML pipeline run."""
    model_config = ConfigDict(extra="forbid")

    stage_latencies_seconds: StageLatencies
    execution_breakdown: ExecutionBreakdown
    throughput_samples_per_sec: ThroughputSamples
    record_accounting: RecordAccounting
    cache_performance: CachePerformance
    memory_footprint_mb: MemoryFootprint
