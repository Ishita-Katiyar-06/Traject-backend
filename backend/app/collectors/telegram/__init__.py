from typing import TYPE_CHECKING
from app.collectors.telegram.client import TelegramClientFactory, TelegramCredentials
from app.collectors.telegram.serializer import TelethonMessageSerializer
from app.collectors.telegram.registry import (
    SourceType,
    TelegramSourceEntry,
    TelegramSourceRegistry,
    load_telegram_source_registry,
)

if TYPE_CHECKING:
    from app.collectors.telegram.collector import (
        CollectionResult,
        MultiCollectionResult,
        TelegramCollector,
        parse_telegram_sources,
    )
    from app.collectors.telegram.corpus_builder import (
        CorpusManifest,
        TelegramCorpusBuilder,
        TelegramCorpusConfig,
    )


def __getattr__(name: str):
    if name in ("TelegramCollector", "CollectionResult", "MultiCollectionResult", "parse_telegram_sources"):
        from app.collectors.telegram import collector
        return getattr(collector, name)
    if name in ("TelegramCorpusBuilder", "TelegramCorpusConfig", "CorpusManifest"):
        from app.collectors.telegram import corpus_builder
        return getattr(corpus_builder, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "TelegramClientFactory",
    "TelegramCredentials",
    "TelethonMessageSerializer",
    "TelegramCollector",
    "CollectionResult",
    "MultiCollectionResult",
    "parse_telegram_sources",
    "SourceType",
    "TelegramSourceEntry",
    "TelegramSourceRegistry",
    "load_telegram_source_registry",
    "TelegramCorpusBuilder",
    "TelegramCorpusConfig",
    "CorpusManifest",
]
