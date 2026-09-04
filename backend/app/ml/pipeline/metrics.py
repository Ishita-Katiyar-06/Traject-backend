import sys
from typing import Any
from pydantic import BaseModel, ConfigDict, Field


def get_process_peak_rss_mb() -> float:
    """Retrieve operating system Peak Resident Set Size (RSS) for current process in MB.
    
    Uses Windows GetProcessMemoryInfo (PeakWorkingSetSize) on Windows,
    and getrusage (ru_maxrss) on POSIX / macOS.
    """
    if sys.platform == "win32":
        try:
            import ctypes
            from ctypes import wintypes

            class PROCESS_MEMORY_COUNTERS(ctypes.Structure):
                _fields_ = [
                    ("cb", wintypes.DWORD),
                    ("PageFaultCount", wintypes.DWORD),
                    ("PeakWorkingSetSize", ctypes.c_size_t),
                    ("WorkingSetSize", ctypes.c_size_t),
                    ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                    ("QuotaPagedPoolUsage", ctypes.c_size_t),
                    ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                    ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                    ("PagefileUsage", ctypes.c_size_t),
                    ("PeakPagefileUsage", ctypes.c_size_t),
                ]

            psapi = ctypes.WinDLL("psapi")
            kernel32 = ctypes.WinDLL("kernel32")
            GetProcessMemoryInfo = psapi.GetProcessMemoryInfo
            GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.POINTER(PROCESS_MEMORY_COUNTERS), wintypes.DWORD]
            GetProcessMemoryInfo.restype = wintypes.BOOL

            handle = kernel32.GetCurrentProcess()
            counters = PROCESS_MEMORY_COUNTERS()
            counters.cb = ctypes.sizeof(PROCESS_MEMORY_COUNTERS)
            if GetProcessMemoryInfo(handle, ctypes.byref(counters), counters.cb):
                return round(counters.PeakWorkingSetSize / (1024 * 1024), 2)
        except Exception:
            pass

    try:
        import resource
        ru = resource.getrusage(resource.RUSAGE_SELF)
        if sys.platform == "darwin":
            return round(ru.ru_maxrss / (1024 * 1024), 2)
        return round(ru.ru_maxrss / 1024, 2)
    except Exception:
        pass

    return 0.0


class PipelineStageMetrics(BaseModel):
    """Fine-grained, audit-ready latency and performance metrics for each pipeline stage."""
    model_config = ConfigDict(extra="forbid", frozen=True)

    # Stage Latencies (in seconds)
    language_detection_seconds: float = Field(ge=0.0, default=0.0)
    normalization_seconds: float = Field(ge=0.0, default=0.0)
    sentiment_load_seconds: float = Field(ge=0.0, default=0.0)
    sentiment_inference_seconds: float = Field(ge=0.0, default=0.0)
    embedding_load_seconds: float = Field(ge=0.0, default=0.0)
    embedding_inference_seconds: float = Field(ge=0.0, default=0.0)
    topic_discovery_seconds: float = Field(ge=0.0, default=0.0)
    feature_enrichment_seconds: float = Field(ge=0.0, default=0.0)
    narrative_assessment_seconds: float = Field(ge=0.0, default=0.0)
    total_runtime_seconds: float = Field(ge=0.0, default=0.0)

    # Cold Start vs Warm Latency Breakdown
    cold_start_time_seconds: float = Field(ge=0.0, default=0.0)
    warm_inference_time_seconds: float = Field(ge=0.0, default=0.0)

    # Throughput (samples/sec)
    sentiment_throughput_samples_per_sec: float = Field(ge=0.0, default=0.0)
    embedding_throughput_samples_per_sec: float = Field(ge=0.0, default=0.0)

    # Record Accounting
    records_ingested: int = Field(ge=0, default=0)
    records_processed: int = Field(ge=0, default=0)
    records_skipped: int = Field(ge=0, default=0)
    records_failed: int = Field(ge=0, default=0)

    # Inference Cache Accounting
    cache_hits: int = Field(ge=0, default=0)
    cache_misses: int = Field(ge=0, default=0)
    cache_hit_rate: float = Field(ge=0.0, le=1.0, default=0.0)

    # Memory Accounting
    peak_rss_mb: float = Field(ge=0.0, default=0.0, description="Process Peak Resident Set Size (RSS) in MB")
    peak_python_heap_mb: float = Field(ge=0.0, default=0.0, description="Peak Python interpreter heap memory allocated via tracemalloc in MB")
    peak_memory_mb: float = Field(ge=0.0, default=0.0, description="Backwards-compatible alias for peak_rss_mb")

    def to_dict(self) -> dict[str, Any]:
        return self.model_dump(mode="json")

