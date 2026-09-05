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
