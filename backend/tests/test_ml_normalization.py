import hashlib
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
import pytest

from app.ml.dataset import (
    LanguageAwareMLTextRecord,
    prepare_language_aware_records,
)
from app.ml.language import inspect_canonical_languages
from app.ml.normalization import normalize_social_text
from app.schemas.canonical_message import AuthorType, CanonicalMessage, Platform
from app.storage.parquet import write_canonical_messages


@pytest.fixture
def social_canonical_message():
    return CanonicalMessage(
        canonical_id="telegram:98765:1",
        platform=Platform.TELEGRAM,
        native_id="1",
        author_id="98765",
        author_username="narrative_intel",
        author_type=AuthorType.CHANNEL,
        channel_title="Narrative Intelligence",
        subscriber_count=5000,
        published_at=datetime(2026, 9, 2, 12, 0, 0, tzinfo=timezone.utc),
        collected_at=datetime(2026, 9, 2, 14, 0, 0, tzinfo=timezone.utc),
        text_content="   BREAKING: Joint cyber drill announced!   #CyberSec @CERT_In https://cert-in.org.in  🔥🔥🔥   ",
        language=None,
        media_types=[],
        has_media=False,
        is_forward=False,
        is_repost=False,
        origin_source_id=None,
        reply_to_id=None,
        thread_id=None,
        views_count=100,
        forwards_count=10,
        replies_count=2,
        reactions={"🔥": 50},
        urls=["https://cert-in.org.in"],
        hashtags=["#CyberSec"],
        mentions=["@CERT_In"],
        raw_reference="batch_01.jsonl:1",
    )


def test_social_cues_preserved():
    """1. Verify normalization preserves hashtags, mentions, URLs, emojis, case, and exclamation marks."""
    raw = "  URGENT: Meeting @Pentagon about #AI and #CyberDefense! Visit https://dod.gov 🚨🚨🚨  "
    norm = normalize_social_text(raw)

    assert "#AI" in norm
    assert "#CyberDefense" in norm
    assert "@Pentagon" in norm
    assert "https://dod.gov" in norm
    assert "🚨🚨🚨" in norm
    assert "URGENT:" in norm  # case preserved
    assert norm.startswith("URGENT:")
    assert norm.endswith("🚨🚨🚨")


def test_whitespace_normalization():
    """2. Verify horizontal whitespace, tabs, and spaces are collapsed to single spaces per line."""
    raw = "This   is  \t a   sentence    with\t\tmultiple   spaces."
    norm = normalize_social_text(raw)
    assert norm == "This is a sentence with multiple spaces."


def test_line_break_normalization():
    """3. Verify CRLF conversion and paragraph separation (3+ newlines collapsed to 2)."""
    raw = "Header\r\n\r\n\r\n\r\nParagraph one.\r\n\r\nParagraph two.\r\n"
    norm = normalize_social_text(raw)
    expected = "Header\n\nParagraph one.\n\nParagraph two."
    assert norm == expected


def test_unicode_nfc_normalization():
    """4. Verify canonical NFC composition ensures consistent byte representations."""
    # 'e' + combining acute accent (NFD) vs 'é' (NFC)
    decomposed = "e\u0301le\u0301phant"
    composed = "\u00e9l\u00e9phant"
    assert decomposed != composed

    norm = normalize_social_text(decomposed)
    assert norm == composed
    assert unicodedata.is_normalized("NFC", norm)


def test_original_text_preservation(social_canonical_message):
    """5. Verify CanonicalMessage.text_content and record.original_text remain intact."""
    records = prepare_language_aware_records([social_canonical_message])
    assert len(records) == 1
    rec = records[0]

    assert rec.original_text == social_canonical_message.text_content
    assert rec.normalized_text != rec.original_text
    assert rec.normalized_text == "BREAKING: Joint cyber drill announced! #CyberSec @CERT_In https://cert-in.org.in 🔥🔥🔥"


def test_media_only_exclusion(social_canonical_message):
    """6. Verify media-only messages are systematically excluded from language-aware records."""
    media_only = social_canonical_message.model_copy(
        update={"text_content": "", "has_media": True, "media_types": ["photo"]}
    )
    records = prepare_language_aware_records([media_only])
    assert len(records) == 0


def test_prepare_language_aware_records(social_canonical_message):
    """7. Verify end-to-end language detection and normalization in LanguageAwareMLTextRecord."""
    records = prepare_language_aware_records([social_canonical_message])
    assert len(records) == 1
    rec = records[0]

    assert isinstance(rec, LanguageAwareMLTextRecord)
    assert rec.canonical_id == "telegram:98765:1"
    assert rec.detected_language == "en"
    assert rec.language_confidence >= 0.70
    assert rec.urls == ["https://cert-in.org.in"]
    assert rec.hashtags == ["#CyberSec"]


def test_parquet_and_jsonl_immutability(tmp_path, social_canonical_message):
    """8. Verify SHA-256 of Parquet dataset remains strictly invariant after language inspection."""
    parquet_path = tmp_path / "test.parquet"
    write_canonical_messages([social_canonical_message], parquet_path)
    hash_before = hashlib.sha256(parquet_path.read_bytes()).hexdigest()

    # Run inspection
    inspect_canonical_languages([social_canonical_message], dataset_path=str(parquet_path))

    hash_after = hashlib.sha256(parquet_path.read_bytes()).hexdigest()
    assert hash_before == hash_after
