"""Meta Threads ingestion and collector module for TRAJECT."""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.collectors.threads.client import ThreadsClient, ThreadsCredentials
    from app.collectors.threads.collector import ThreadsCollector
    from app.collectors.threads.serializer import ThreadsMessageSerializer

__all__ = [
    "ThreadsClient",
    "ThreadsCredentials",
    "ThreadsCollector",
    "ThreadsMessageSerializer",
]


def __getattr__(name: str):
    if name in ("ThreadsClient", "ThreadsCredentials"):
        from app.collectors.threads.client import ThreadsClient, ThreadsCredentials
        return locals()[name]
    if name == "ThreadsCollector":
        from app.collectors.threads.collector import ThreadsCollector
        return ThreadsCollector
    if name == "ThreadsMessageSerializer":
        from app.collectors.threads.serializer import ThreadsMessageSerializer
        return ThreadsMessageSerializer
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
