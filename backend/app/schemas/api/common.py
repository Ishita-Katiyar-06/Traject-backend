from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class PaginationMeta(BaseModel):
    """Metadata describing collection pagination state."""
    model_config = ConfigDict(extra="forbid")

    total: int = Field(ge=0, description="Total number of matching items across all pages")
    page: int = Field(ge=1, description="Current 1-indexed page number")
    page_size: int = Field(ge=1, le=100, description="Number of items requested per page")
    total_pages: int = Field(ge=0, description="Total number of available pages")
    has_next: bool = Field(description="True if another page is available after current page")
    has_prev: bool = Field(description="True if a preceding page exists before current page")


class ErrorDetail(BaseModel):
    """Structured error payload providing diagnostic details without leaking tracebacks."""
    model_config = ConfigDict(extra="forbid")

    code: str = Field(description="Machine-readable uppercase error code (e.g. RESOURCE_NOT_FOUND)")
    message: str = Field(description="Human-readable explanation of the error condition")
    details: dict[str, Any] = Field(default_factory=dict, description="Contextual error metadata")
    timestamp_utc: str = Field(description="UTC timestamp when error occurred (ISO-8601)")


class ErrorEnvelope(BaseModel):
    """Standardized top-level API error envelope."""
    model_config = ConfigDict(extra="forbid")

    error: ErrorDetail
