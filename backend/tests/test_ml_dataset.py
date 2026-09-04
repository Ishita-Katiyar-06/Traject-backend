import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
import pytest

from app.ml.dataset import (
    MLTextRecord,
    load_canonical_dataset,
    prepare_ml_text_records,
)
from app.ml.inspection import (
    MLDatasetInspection,
    compute_numeric_distribution,
    inspect_canonical_dataset,
)
from app.schemas.canonical_message import AuthorType, CanonicalMessage, Platform
from app.storage.parquet import write_canonical_messages


@pytest.fixture
def sample_canonical_message():
    return CanonicalMessage(
        canonical_id="telegram:123456:100",
        platform=Platform.TELEGRAM,
        native_id="100",
        author_id="123456",
        author_username="test_channel",
        author_type=AuthorType.CHANNEL,
        channel_title="Test Channel",
        subscriber_count=1000,
        published_at=datetime(2026, 9, 2, 10, 0, 0, tzinfo=timezone.utc),
        collected_at=datetime(2026, 9, 2, 12, 0, 0, tzinfo=timezone.utc),
        text_content="Alpha beta gamma delta",
        language="en",
        media_types=["photo"],
        has_media=True,
        is_forward=False,
        is_repost=False,
        origin_source_id=None,
        reply_to_id=None,
        thread_id=None,
        views_count=50,
        forwards_count=5,
        replies_count=2,
        reactions={"👍": 10},
        urls=["https://example.com/news"],
        hashtags=["#intel"],
        mentions=["@channel"],
        raw_reference="test_batch.jsonl:1",
    )


def test_empty_dataset_inspection():
    """1. Verify empty dataset handled safely without division by zero."""
    inspection = inspect_canonical_dataset([], dataset_path="empty.parquet")
    assert inspection.total_records == 0
    assert inspection.text_records == 0
    assert inspection.media_only_records == 0
    assert inspection.empty_body_records == 0
    assert inspection.usable_text_percentage == 0.0
    assert inspection.media_only_percentage == 0.0
    assert inspection.text_characters.mean == 0.0
    assert inspection.text_words.mean == 0.0


def test_text_bearing_statistics(sample_canonical_message):
    """2. Verify text character and word distributions with known lengths."""
    # msg1: "one two three" -> 13 chars, 3 words
    m1 = sample_canonical_message.model_copy(
        update={"canonical_id": "telegram:1:1", "text_content": "one two three"}
    )
    # msg2: "hello world" -> 11 chars, 2 words
    m2 = sample_canonical_message.model_copy(
        update={"canonical_id": "telegram:1:2", "text_content": "hello world"}
    )
    # msg3: "a b c d e" -> 9 chars, 5 words
    m3 = sample_canonical_message.model_copy(
        update={"canonical_id": "telegram:1:3", "text_content": "a b c d e"}
    )

    inspection = inspect_canonical_dataset([m1, m2, m3])

    assert inspection.total_records == 3
    assert inspection.text_records == 3

    # Characters: [13, 11, 9] -> min 9, max 13, mean 11.0, median 11.0
    assert inspection.text_characters.min == 9
    assert inspection.text_characters.max == 13
    assert inspection.text_characters.mean == 11.0
    assert inspection.text_characters.median == 11.0

    # Words: [3, 2, 5] -> min 2, max 5, mean 3.33, median 3.0
    assert inspection.text_words.min == 2
    assert inspection.text_words.max == 5
    assert inspection.text_words.mean == 3.33
    assert inspection.text_words.median == 3.0


def test_media_only_records_excluded_from_text_records(sample_canonical_message):
    """3. Verify media-only messages are counted as media-only and excluded from text ML datasets."""
    media_only = sample_canonical_message.model_copy(
        update={
            "text_content": "",
            "has_media": True,
            "media_types": ["photo"],
        }
    )

    inspection = inspect_canonical_dataset([media_only])
    assert inspection.total_records == 1
    assert inspection.text_records == 0
    assert inspection.media_only_records == 1
    assert inspection.empty_body_records == 0
    assert inspection.usable_text_percentage == 0.0
    assert inspection.media_only_percentage == 100.0

    # Test ML text preparation systematically excludes media-only records
    ml_records = prepare_ml_text_records([media_only])
    assert len(ml_records) == 0


def test_empty_body_records(sample_canonical_message):
    """4. Verify records with neither text nor media are classified as empty-body."""
    empty_body = sample_canonical_message.model_copy(
        update={
            "text_content": "",
            "has_media": False,
            "media_types": [],
        }
    )

    inspection = inspect_canonical_dataset([empty_body])
    assert inspection.total_records == 1
    assert inspection.text_records == 0
    assert inspection.media_only_records == 0
    assert inspection.empty_body_records == 1

    ml_records = prepare_ml_text_records([empty_body])
    assert len(ml_records) == 0


def test_language_distribution(sample_canonical_message):
    """5. Verify language counts, missing language mapped to 'unknown', and alphabetical key ordering."""
    langs = ["ru", "en", None, "ru", ""]
    messages = [
        sample_canonical_message.model_copy(
            update={"canonical_id": f"telegram:1:{i}", "language": lang}
        )
        for i, lang in enumerate(langs)
    ]

    inspection = inspect_canonical_dataset(messages)

    assert inspection.total_records == 5
    # Alphabetical order: en, ru, unknown
    assert list(inspection.language_counts.keys()) == ["en", "ru", "unknown"]
    assert inspection.language_counts == {"en": 1, "ru": 2, "unknown": 2}
    assert inspection.language_percentages == {"en": 20.0, "ru": 40.0, "unknown": 40.0}


def test_social_entity_counts(sample_canonical_message):
    """6. Verify accurate tracking of URLs, hashtags, and mentions."""
    m_with_entities = sample_canonical_message.model_copy(
        update={
            "urls": ["https://ntro.gov.in"],
            "hashtags": ["#SIH2026"],
            "mentions": ["@cybersec"],
        }
    )
    m_plain = sample_canonical_message.model_copy(
        update={"urls": [], "hashtags": [], "mentions": []}
    )

    inspection = inspect_canonical_dataset([m_with_entities, m_plain])

    assert inspection.total_records == 2
    assert inspection.url_records == 1
    assert inspection.url_percentage == 50.0
    assert inspection.hashtag_records == 1
    assert inspection.hashtag_percentage == 50.0
    assert inspection.mention_records == 1
    assert inspection.mention_percentage == 50.0


def test_forward_repost_counts(sample_canonical_message):
    """7. Verify forwards and reposts counting."""
    m_fwd = sample_canonical_message.model_copy(update={"is_forward": True})
    m_direct = sample_canonical_message.model_copy(update={"is_forward": False, "is_repost": False})

    inspection = inspect_canonical_dataset([m_fwd, m_direct])
    assert inspection.forward_records == 1
    assert inspection.forward_percentage == 50.0


def test_inspection_determinism(sample_canonical_message):
    """8. Verify running inspection twice on identical inputs produces identical metrics."""
    msgs = [sample_canonical_message, sample_canonical_message]
    insp1 = inspect_canonical_dataset(msgs, dataset_path="test.parquet")
    insp2 = inspect_canonical_dataset(msgs, dataset_path="test.parquet")

    d1 = insp1.to_dict()
    d2 = insp2.to_dict()
    # Exclude generated_at timestamp from strict equality
    d1.pop("generated_at")
    d2.pop("generated_at")
    assert d1 == d2


def test_ml_dataset_loader_parquet_roundtrip(tmp_path, sample_canonical_message):
    """9. Verify load_canonical_dataset correctly loads CanonicalMessage objects from Parquet."""
    parquet_path = tmp_path / "roundtrip.parquet"
    write_canonical_messages([sample_canonical_message], parquet_path)

    loaded_messages = load_canonical_dataset(parquet_path)
    assert len(loaded_messages) == 1
    loaded = loaded_messages[0]

    assert loaded.canonical_id == sample_canonical_message.canonical_id
    assert loaded.platform == sample_canonical_message.platform
    assert loaded.published_at == sample_canonical_message.published_at
    assert loaded.text_content == sample_canonical_message.text_content
    assert loaded.reactions == sample_canonical_message.reactions
    assert loaded.urls == sample_canonical_message.urls


def test_ml_text_record_conversion(sample_canonical_message):
    """10. Verify prepare_ml_text_records generates frozen MLTextRecord with expected fields."""
    records = prepare_ml_text_records([sample_canonical_message])
    assert len(records) == 1
    rec = records[0]

    assert isinstance(rec, MLTextRecord)
    assert rec.canonical_id == sample_canonical_message.canonical_id
    assert rec.text_content == sample_canonical_message.text_content
    assert rec.language == sample_canonical_message.language
    assert rec.views_count == sample_canonical_message.views_count

    # Frozen immutability check
    with pytest.raises(Exception):
        rec.text_content = "modified"  # type: ignore


def test_json_report_generation(tmp_path, sample_canonical_message):
    """11. Verify inspection report serializes cleanly to JSON with expected structure."""
    inspection = inspect_canonical_dataset([sample_canonical_message], dataset_path="dataset.parquet")
    report_file = tmp_path / "report.json"
    inspection.save_json(report_file)

    assert report_file.exists()
    content = json.loads(report_file.read_text(encoding="utf-8"))
    assert content["total_records"] == 1
    assert content["text_records"] == 1
    assert "language_counts" in content
    assert "text_characters" in content
    assert "text_words" in content


def test_json_report_overwrite_protection(tmp_path, sample_canonical_message):
    """12. Verify overwrite guard protects existing inspection JSON reports."""
    inspection = inspect_canonical_dataset([sample_canonical_message])
    report_file = tmp_path / "report.json"
    report_file.write_text("existing", encoding="utf-8")

    with pytest.raises(FileExistsError):
        inspection.save_json(report_file, overwrite=False)

    inspection.save_json(report_file, overwrite=True)
    assert json.loads(report_file.read_text(encoding="utf-8"))["total_records"] == 1


def test_raw_jsonl_and_parquet_immutability(tmp_path, sample_canonical_message):
    """13. Verify SHA-256 hash of Parquet file is identical before and after loading and inspection."""
    parquet_path = tmp_path / "test_immutability.parquet"
    write_canonical_messages([sample_canonical_message], parquet_path)
    hash_before = hashlib.sha256(parquet_path.read_bytes()).hexdigest()

    loaded = load_canonical_dataset(parquet_path)
    inspect_canonical_dataset(loaded, dataset_path=str(parquet_path))

    hash_after = hashlib.sha256(parquet_path.read_bytes()).hexdigest()
    assert hash_before == hash_after


def test_zero_heavy_dependencies():
    """14. Verify no unnecessary heavy ML frameworks (spacy, tensorflow, bertopic) are loaded in dataset core."""
    forbidden_modules = ["spacy", "bertopic", "tensorflow"]
    for mod in forbidden_modules:
        assert mod not in sys.modules, f"Forbidden heavy dependency '{mod}' was loaded into sys.modules"




def test_missing_parquet_raises_filenotfound():
    """15. Verify loader raises FileNotFoundError when target Parquet does not exist."""
    with pytest.raises(FileNotFoundError):
        load_canonical_dataset("nonexistent.parquet")
