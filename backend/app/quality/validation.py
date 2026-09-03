import json
import logging
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import StrEnum
from pathlib import Path
from typing import Any, Iterable

from app.schemas.canonical_message import CanonicalMessage, Platform

logger = logging.getLogger("traject.quality.validation")


class QualitySeverity(StrEnum):
    """Severity levels for data quality validation issues."""
    ERROR = "error"
    WARNING = "warning"


@dataclass
class QualityIssue:
    """Individual data quality diagnostic issue."""
    code: str
    severity: QualitySeverity
    message: str
    canonical_id: str | None = None
    source_file: str | None = None
    line_number: int | None = None
    raw_reference: str | None = None
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert issue to primitive dictionary."""
        data = asdict(self)
        data["severity"] = self.severity.value
        return {k: v for k, v in data.items() if v is not None and v != {}}


@dataclass
class QualityReport:
    """Dataset-level quality, validation, and deduplication audit report."""
    dataset_platform: str = "telegram"
    generated_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    records_seen: int = 0
    records_normalized: int = 0
    records_valid: int = 0
    records_invalid: int = 0
    duplicates_detected: int = 0
    records_written: int = 0
    issues: list[QualityIssue] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert quality report to JSON-serializable dictionary."""
        return {
            "dataset_platform": self.dataset_platform,
            "generated_at": self.generated_at,
            "records_seen": self.records_seen,
            "records_normalized": self.records_normalized,
            "records_valid": self.records_valid,
            "records_invalid": self.records_invalid,
            "duplicates_detected": self.duplicates_detected,
            "records_written": self.records_written,
            "metadata": self.metadata,
            "issues": [issue.to_dict() for issue in self.issues],
        }

    def save_json(self, output_path: Path | str, indent: int = 2) -> None:
        """Write report to a formatted JSON file."""
        path = Path(output_path).resolve()
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=indent)


def check_message_quality(
    msg: CanonicalMessage,
    provenance: dict[str, Any] | None = None,
) -> list[QualityIssue]:
    """Perform deterministic data quality and consistency checks on a CanonicalMessage.
    
    Args:
        msg: Validated CanonicalMessage domain model.
        provenance: Optional dictionary containing source_file, line_number, raw_reference.
        
    Returns:
        list[QualityIssue]: Discovered warnings and errors.
    """
    issues: list[QualityIssue] = []
    prov = provenance or {}
    source_file = prov.get("source_file")
    line_number = prov.get("line_number")
    raw_reference = prov.get("raw_reference") or msg.raw_reference

    # 1. Identity checks
    if not msg.canonical_id or not str(msg.canonical_id).strip():
        issues.append(
            QualityIssue(
                code="EMPTY_CANONICAL_ID",
                severity=QualitySeverity.ERROR,
                message="canonical_id is empty or whitespace",
                canonical_id=None,
                source_file=source_file,
                line_number=line_number,
                raw_reference=raw_reference,
            )
        )

    # 2. Platform checks
    if msg.platform not in (Platform.TELEGRAM, Platform.X):
        issues.append(
            QualityIssue(
                code="UNSUPPORTED_PLATFORM",
                severity=QualitySeverity.ERROR,
                message=f"Unsupported platform: '{msg.platform}'",
                canonical_id=msg.canonical_id,
                source_file=source_file,
                line_number=line_number,
                raw_reference=raw_reference,
            )
        )

    # 3. Temporal consistency checks
    if msg.published_at.tzinfo is None or msg.collected_at.tzinfo is None:
        issues.append(
            QualityIssue(
                code="NAIVE_TIMESTAMP",
                severity=QualitySeverity.ERROR,
                message="published_at or collected_at is naive (must be UTC)",
                canonical_id=msg.canonical_id,
                source_file=source_file,
                line_number=line_number,
                raw_reference=raw_reference,
            )
        )
    elif msg.collected_at < msg.published_at:
        issues.append(
            QualityIssue(
                code="INVALID_TIMESTAMP_ORDER",
                severity=QualitySeverity.ERROR,
                message=(
                    f"collected_at ({msg.collected_at.isoformat()}) precedes "
                    f"published_at ({msg.published_at.isoformat()})"
                ),
                canonical_id=msg.canonical_id,
                source_file=source_file,
                line_number=line_number,
                raw_reference=raw_reference,
                details={
                    "published_at": msg.published_at.isoformat(),
                    "collected_at": msg.collected_at.isoformat(),
                },
            )
        )

    # 4. Content checks (media-only is completely valid; completely empty body is warning)
    has_text = bool(msg.text_content and msg.text_content.strip())
    has_media = bool(msg.has_media or msg.media_types)
    if not has_text and not has_media:
        issues.append(
            QualityIssue(
                code="EMPTY_MESSAGE_BODY",
                severity=QualitySeverity.WARNING,
                message="Message contains neither text content nor attached media",
                canonical_id=msg.canonical_id,
                source_file=source_file,
                line_number=line_number,
                raw_reference=raw_reference,
            )
        )

    # 5. Engagement checks
    for metric_name in ("views_count", "forwards_count", "replies_count", "subscriber_count"):
        val = getattr(msg, metric_name, None)
        if val is not None and val < 0:
            issues.append(
                QualityIssue(
                    code="NEGATIVE_ENGAGEMENT_METRIC",
                    severity=QualitySeverity.ERROR,
                    message=f"Engagement metric '{metric_name}' is negative ({val})",
                    canonical_id=msg.canonical_id,
                    source_file=source_file,
                    line_number=line_number,
                    raw_reference=raw_reference,
                )
            )

    if msg.reactions:
        for emoji, count in msg.reactions.items():
            if count < 0:
                issues.append(
                    QualityIssue(
                        code="NEGATIVE_REACTION_COUNT",
                        severity=QualitySeverity.ERROR,
                        message=f"Reaction '{emoji}' has negative count ({count})",
                        canonical_id=msg.canonical_id,
                        source_file=source_file,
                        line_number=line_number,
                        raw_reference=raw_reference,
                    )
                )

    # 6. Provenance check
    if not raw_reference or not str(raw_reference).strip():
        issues.append(
            QualityIssue(
                code="MISSING_RAW_REFERENCE",
                severity=QualitySeverity.WARNING,
                message="raw_reference pointer is missing from message",
                canonical_id=msg.canonical_id,
                source_file=source_file,
                line_number=line_number,
                raw_reference=None,
            )
        )

    return issues


def process_quality(
    records: Iterable[Any],
    dataset_platform: str = "telegram",
    metadata: dict[str, Any] | None = None,
) -> tuple[list[CanonicalMessage], QualityReport]:
    """Execute quality validation and deterministic deduplication on a collection of records.
    
    Deduplication Policy:
    - Primary key: `canonical_id` ('telegram:{chat_id}:{message_id}').
    - Policy: First occurrence wins.
    - Duplicate occurrences are rejected and logged in the QualityReport with provenance
      pointing to both the first and duplicate occurrences.
      
    Args:
        records: Iterable of ReplayRecord or CanonicalMessage instances.
        dataset_platform: Identifier of target platform.
        metadata: Custom metadata dictionary to attach to QualityReport.
        
    Returns:
        tuple[list[CanonicalMessage], QualityReport]: Clean unique messages and full report.
    """
    report = QualityReport(
        dataset_platform=dataset_platform,
        metadata=metadata or {},
    )

    clean_messages: list[CanonicalMessage] = []
    seen_canonical_ids: dict[str, dict[str, Any]] = {}

    for item in records:
        report.records_seen += 1

        # Extract message and provenance
        if hasattr(item, "canonical_message") and hasattr(item, "source_file"):
            # It's a ReplayRecord
            if not item.is_success or item.canonical_message is None:
                report.records_invalid += 1
                report.issues.append(
                    QualityIssue(
                        code="REPLAY_PARSE_ERROR",
                        severity=QualitySeverity.ERROR,
                        message=item.error or "Unknown replay failure",
                        source_file=item.source_file,
                        line_number=item.line_number,
                    )
                )
                continue

            msg: CanonicalMessage = item.canonical_message
            prov = {
                "source_file": item.source_file,
                "line_number": item.line_number,
                "raw_reference": msg.raw_reference or f"{Path(item.source_file).name}:{item.line_number}",
            }
        elif isinstance(item, CanonicalMessage):
            msg = item
            prov = {
                "source_file": None,
                "line_number": None,
                "raw_reference": msg.raw_reference,
            }
        else:
            report.records_invalid += 1
            report.issues.append(
                QualityIssue(
                    code="UNRECOGNIZED_RECORD_TYPE",
                    severity=QualitySeverity.ERROR,
                    message=f"Unsupported item type in quality pipeline: {type(item).__name__}",
                )
            )
            continue

        report.records_normalized += 1

        # 1. Quality validation checks
        issues = check_message_quality(msg, provenance=prov)
        has_errors = any(i.severity == QualitySeverity.ERROR for i in issues)

        if has_errors:
            report.records_invalid += 1
            report.issues.extend(issues)
            continue

        # Record warnings if any
        warnings = [i for i in issues if i.severity == QualitySeverity.WARNING]
        if warnings:
            report.issues.extend(warnings)

        # 2. Deterministic Deduplication by canonical_id
        canonical_id = msg.canonical_id
        if canonical_id in seen_canonical_ids:
            report.duplicates_detected += 1
            first_prov = seen_canonical_ids[canonical_id]
            first_loc = f"{first_prov.get('source_file') or 'unknown'}:{first_prov.get('line_number') or 'unknown'}"
            curr_loc = f"{prov.get('source_file') or 'unknown'}:{prov.get('line_number') or 'unknown'}"

            report.issues.append(
                QualityIssue(
                    code="DUPLICATE_CANONICAL_ID",
                    severity=QualitySeverity.WARNING,
                    message=(
                        f"Duplicate canonical_id '{canonical_id}' detected. "
                        f"First occurrence at {first_loc}; duplicate at {curr_loc}. "
                        "Applying first-occurrence-wins policy (duplicate discarded)."
                    ),
                    canonical_id=canonical_id,
                    source_file=prov.get("source_file"),
                    line_number=prov.get("line_number"),
                    raw_reference=prov.get("raw_reference"),
                    details={
                        "first_occurrence": first_prov,
                        "duplicate_occurrence": prov,
                    },
                )
            )
            continue

        # Keep first occurrence
        seen_canonical_ids[canonical_id] = prov
        report.records_valid += 1
        clean_messages.append(msg)

    report.records_written = len(clean_messages)
    return clean_messages, report
