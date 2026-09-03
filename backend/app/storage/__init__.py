from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.storage.parquet import (
        CANONICAL_MESSAGE_ARROW_SCHEMA,
        ProcessedDatasetSummary,
        build_processed_dataset,
        canonical_messages_to_arrow_table,
        read_canonical_messages,
        read_parquet_metadata,
        write_canonical_messages,
    )


def __getattr__(name: str):
    import app.storage.parquet as p
    if hasattr(p, name):
        return getattr(p, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "CANONICAL_MESSAGE_ARROW_SCHEMA",
    "ProcessedDatasetSummary",
    "write_canonical_messages",
    "read_canonical_messages",
    "read_parquet_metadata",
    "canonical_messages_to_arrow_table",
    "build_processed_dataset",
]
