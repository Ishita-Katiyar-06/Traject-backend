from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.replay.telegram_jsonl import (
        ReplayRecord,
        ReplaySummary,
        TelegramJSONLReplayer,
        iter_raw_telegram_jsonl,
        replay_directory,
        replay_file,
        validate_raw_telegram_record,
    )


def __getattr__(name: str):
    import app.replay.telegram_jsonl as tj
    if hasattr(tj, name):
        return getattr(tj, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "ReplayRecord",
    "ReplaySummary",
    "TelegramJSONLReplayer",
    "iter_raw_telegram_jsonl",
    "validate_raw_telegram_record",
    "replay_file",
    "replay_directory",
]
