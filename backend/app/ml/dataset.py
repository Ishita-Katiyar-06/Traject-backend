import logging
from datetime import datetime
from pathlib import Path
from typing import Iterable

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.canonical_message import CanonicalMessage, Platform
from app.storage.parquet import read_canonical_messages

logger = logging.getLogger("traject.ml.dataset")


class MLTextRecord(BaseModel):
    """Lightweight, ML-oriented representation of a text-bearing CanonicalMessage.
    
    This model isolates the feature fields necessary for NLP, sentiment, topic modeling,
    and narrative intelligence from the broader storage and topological contracts.
    """
    model_config = ConfigDict(extra="forbid", frozen=True)

    canonical_id: str
    platform: Platform
    published_at: datetime
    text_content: str
    language: str | None = None
    has_media: bool = False
    is_forward: bool = False
    views_count: int | None = None
    forwards_count: int | None = None
    replies_count: int | None = None
    urls: list[str] = Field(default_factory=list)
    hashtags: list[str] = Field(default_factory=list)
    mentions: list[str] = Field(default_factory=list)
    raw_reference: str | None = None


def load_canonical_dataset(parquet_path: Path | str) -> list[CanonicalMessage]:
    """Load a processed dataset from Apache Parquet into validated CanonicalMessage objects.
    
    Invariants:
    - Reads from the durable processed Parquet storage layer.
    - Preserves all 27 CanonicalMessage fields, UTC microsecond timestamps, lists, and maps.
    - Does not mutate the Parquet file or any underlying raw storage.
    
    Args:
        parquet_path: Filepath to the processed .parquet dataset.
        
    Returns:
        list[CanonicalMessage]: Reconstructed domain message models.
        
    Raises:
        FileNotFoundError: If the specified Parquet file does not exist.
        ValueError: If the file is not a valid Parquet dataset.
    """
    path = Path(parquet_path).resolve()
    if not path.is_file():
        raise FileNotFoundError(f"Processed Parquet dataset not found: {path}")

    try:
        messages = read_canonical_messages(path)
    except Exception as exc:
        raise ValueError(f"Failed to read Parquet dataset from {path}: {exc}") from exc

    logger.debug("Loaded %d CanonicalMessages from %s", len(messages), path)
    return messages


def prepare_ml_text_records(messages: Iterable[CanonicalMessage]) -> list[MLTextRecord]:
    """Filter and prepare CanonicalMessage records for text-based ML workflows.
    
    Filtering Rule:
    - Only messages with non-empty text_content are retained.
    - Media-only messages (text_content == "" and has_media == True) are valid
      canonical records, but are systematically excluded from text datasets.
    - Empty-body records (text_content == "" and has_media == False) are excluded.
    
    Args:
        messages: Iterable of CanonicalMessage domain models.
        
    Returns:
        list[MLTextRecord]: Filtered and structured text records.
    """
    records: list[MLTextRecord] = []
    for msg in messages:
        if not msg.text_content or not msg.text_content.strip():
            continue

        records.append(
            MLTextRecord(
                canonical_id=msg.canonical_id,
                platform=msg.platform,
                published_at=msg.published_at,
                text_content=msg.text_content,
                language=msg.language,
                has_media=msg.has_media,
                is_forward=msg.is_forward,
                views_count=msg.views_count,
                forwards_count=msg.forwards_count,
                replies_count=msg.replies_count,
                urls=list(msg.urls),
                hashtags=list(msg.hashtags),
                mentions=list(msg.mentions),
                raw_reference=msg.raw_reference,
            )
        )

    logger.debug("Prepared %d MLTextRecords from %d inputs", len(records), len(list(messages)) if isinstance(messages, list) else -1)
    return records


class LanguageAwareMLTextRecord(BaseModel):
    """Enriched, ML-ready text record carrying original text, normalized text, and detected language."""
    model_config = ConfigDict(extra="forbid", frozen=True)

    canonical_id: str
    platform: Platform
    published_at: datetime
    original_text: str
    normalized_text: str
    detected_language: str
    language_confidence: float
    has_media: bool = False
    is_forward: bool = False
    views_count: int | None = None
    forwards_count: int | None = None
    replies_count: int | None = None
    urls: list[str] = Field(default_factory=list)
    hashtags: list[str] = Field(default_factory=list)
    mentions: list[str] = Field(default_factory=list)
    raw_reference: str | None = None


def prepare_language_aware_records(
    messages: Iterable[CanonicalMessage],
    confidence_threshold: float = 0.70,
) -> list[LanguageAwareMLTextRecord]:
    """Filter, normalize, and language-identify CanonicalMessage records for downstream ML.
    
    Processing Steps:
    1. Filter: Excludes media-only (text == '' and has_media == True) and empty-body records.
    2. Preserve: Retains original CanonicalMessage.text_content in original_text.
    3. Normalize: Applies safe social text normalization to produce normalized_text.
    4. Detect: Runs deterministic offline language identification on normalized_text.
    5. Retain: Preserves all canonical identities, timestamps, entities, and provenance.
    
    Args:
        messages: Iterable of CanonicalMessage domain models.
        confidence_threshold: Minimum probability required for language acceptance.
        
    Returns:
        list[LanguageAwareMLTextRecord]: Normalized, language-annotated text records.
    """
    from app.ml.language import identify_language
    from app.ml.normalization import normalize_social_text

    records: list[LanguageAwareMLTextRecord] = []
    for msg in messages:
        if not msg.text_content or not msg.text_content.strip():
            continue

        original_text = msg.text_content
        normalized_text = normalize_social_text(original_text)
        lang_res = identify_language(normalized_text, confidence_threshold=confidence_threshold)

        records.append(
            LanguageAwareMLTextRecord(
                canonical_id=msg.canonical_id,
                platform=msg.platform,
                published_at=msg.published_at,
                original_text=original_text,
                normalized_text=normalized_text,
                detected_language=lang_res.language,
                language_confidence=lang_res.confidence,
                has_media=msg.has_media,
                is_forward=msg.is_forward,
                views_count=msg.views_count,
                forwards_count=msg.forwards_count,
                replies_count=msg.replies_count,
                urls=list(msg.urls),
                hashtags=list(msg.hashtags),
                mentions=list(msg.mentions),
                raw_reference=msg.raw_reference,
            )
        )

    logger.debug("Prepared %d LanguageAwareMLTextRecords", len(records))
    return records

