from typing import TYPE_CHECKING
from app.collectors.telegram.client import TelegramClientFactory, TelegramCredentials
from app.collectors.telegram.serializer import TelethonMessageSerializer

if TYPE_CHECKING:
    from app.collectors.telegram.collector import TelegramCollector


def __getattr__(name: str):
    if name == "TelegramCollector":
        from app.collectors.telegram.collector import TelegramCollector
        return TelegramCollector
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "TelegramClientFactory",
    "TelegramCredentials",
    "TelethonMessageSerializer",
    "TelegramCollector",
]
