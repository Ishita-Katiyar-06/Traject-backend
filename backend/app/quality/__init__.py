from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.quality.validation import (
        QualityIssue,
        QualityReport,
        QualitySeverity,
        check_message_quality,
        process_quality,
    )


def __getattr__(name: str):
    import app.quality.validation as v
    if hasattr(v, name):
        return getattr(v, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "QualitySeverity",
    "QualityIssue",
    "QualityReport",
    "check_message_quality",
    "process_quality",
]
