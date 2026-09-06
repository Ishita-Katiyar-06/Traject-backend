"""Discord ingestion and collector module for TRAJECT."""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.collectors.discord.client import DiscordClient, DiscordCredentials
    from app.collectors.discord.collector import DiscordCollector
    from app.collectors.discord.serializer import DiscordMessageSerializer

__all__ = [
    "DiscordClient",
    "DiscordCredentials",
    "DiscordCollector",
    "DiscordMessageSerializer",
]


def __getattr__(name: str):
    if name in ("DiscordClient", "DiscordCredentials"):
        from app.collectors.discord.client import DiscordClient, DiscordCredentials
        return locals()[name]
    if name == "DiscordCollector":
        from app.collectors.discord.collector import DiscordCollector
        return DiscordCollector
    if name == "DiscordMessageSerializer":
        from app.collectors.discord.serializer import DiscordMessageSerializer
        return DiscordMessageSerializer
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
