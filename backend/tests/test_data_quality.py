import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
import pytest

from app.quality.validation import (
    QualityIssue,
    QualityReport,
    QualitySeverity,
    check_message_quality,
    process_quality,
)
from app.replay.telegram_jsonl import ReplayRecord
from app.schemas.canonical_message import AuthorType, CanonicalMessage, Platform
from app.storage.parquet import build_processed_dataset, read_canonical_messages


@pytest.fixture
def base_canonical_message():
    return CanonicalMessage(
        canonical_id="telegram:3190072493:1082",
        platform=Platform.TELEGRAM,
        native_id="1082",
        author_id="3190072493",
        author_username="GenshinUpdate_STR",
        author_type=AuthorType.CHANNEL,
        channel_title="Genshin Updates",
        subscriber_count=50000,
        published_at=datetime(2026, 9, 2, 7, 36, 3, tzinfo=timezone.utc),
        collected_at=datetime(2026, 9, 2, 19, 43, 25, tzinfo=timezone.utc),
        text_content="Character Selector Interface 7.1 #GenshinImpact",
        language="en",
        media_types=["photo"],
        has_media=True,
        is_forward=False,
        is_repost=False,
        origin_source_id=None,
        reply_to_id=None,
        thread_id=None,
        views_count=12,
        forwards_count=0,
        replies_count=11,
        reactions={"👍": 12},
        urls=[],
        hashtags=["#GenshinImpact"],
        mentions=[],
        raw_reference="GenshinUpdate_STR_20260902_194324.jsonl:2",
    )


def test_valid_message_passes_quality(base_canonical_message):
    """1. Test that a fully compliant CanonicalMessage produces zero quality errors."""
    issues = check_message_quality(base_canonical_message)
    errors = [i for i in issues if i.severity == QualitySeverity.ERROR]
    assert len(errors) == 0


def test_missing_canonical_id_rejected(base_canonical_message):
    """2. Test that an empty or whitespace canonical_id is flagged as ERROR."""
    msg = base_canonical_message.model_copy(update={"canonical_id": ""})
    issues = check_message_quality(msg)
    error_codes = [i.code for i in issues if i.severity == QualitySeverity.ERROR]
    assert "EMPTY_CANONICAL_ID" in error_codes


def test_invalid_timestamp_ordering_rejected(base_canonical_message):
    """3. Test that collected_at < published_at is flagged as ERROR."""
    msg = base_canonical_message.model_copy(
        update={
            "published_at": datetime(2026, 9, 2, 12, 0, 0, tzinfo=timezone.utc),
            "collected_at": datetime(2026, 9, 2, 11, 0, 0, tzinfo=timezone.utc),
        }
    )
    issues = check_message_quality(msg)
    error_codes = [i.code for i in issues if i.severity == QualitySeverity.ERROR]
    assert "INVALID_TIMESTAMP_ORDER" in error_codes


def test_historical_messages_accepted(base_canonical_message):
    """4. Test that older historical messages are accepted as long as temporal ordering is consistent."""
    msg = base_canonical_message.model_copy(
        update={
            "published_at": datetime(2020, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
            "collected_at": datetime(2026, 9, 2, 19, 0, 0, tzinfo=timezone.utc),
        }
    )
    issues = check_message_quality(msg)
    errors = [i for i in issues if i.severity == QualitySeverity.ERROR]
    assert len(errors) == 0


def test_media_only_message_accepted(base_canonical_message):
    """5. Test that messages with media and empty text are completely accepted without errors or warnings."""
    msg = base_canonical_message.model_copy(
        update={
            "text_content": "",
            "has_media": True,
            "media_types": ["photo"],
        }
    )
    issues = check_message_quality(msg)
    assert len(issues) == 0


def test_empty_content_warning(base_canonical_message):
    """6. Test that messages with neither text nor media produce a WARNING, not an ERROR."""
    msg = base_canonical_message.model_copy(
        update={
            "text_content": "",
            "has_media": False,
            "media_types": [],
        }
    )
    issues = check_message_quality(msg)
    errors = [i for i in issues if i.severity == QualitySeverity.ERROR]
    warnings = [i for i in issues if i.severity == QualitySeverity.WARNING]
    assert len(errors) == 0
    assert any(w.code == "EMPTY_MESSAGE_BODY" for w in warnings)


def test_negative_engagement_rejected(base_canonical_message):
    """7. Test that negative engagement metrics or negative reactions produce an ERROR."""
    # Test through check_message_quality by overriding dict attribute directly
    bad_reactions = {"👍": -5}
    msg = base_canonical_message.model_copy(update={"reactions": bad_reactions})
    issues = check_message_quality(msg)
    error_codes = [i.code for i in issues if i.severity == QualitySeverity.ERROR]
    assert "NEGATIVE_REACTION_COUNT" in error_codes


def test_duplicate_canonical_ids_detected(base_canonical_message):
    """8. Test that duplicate canonical_ids are detected in process_quality."""
    m1 = base_canonical_message
    m2 = base_canonical_message.model_copy(update={"text_content": "Modified text duplicate"})

    clean, report = process_quality([m1, m2])
    assert report.records_seen == 2
    assert report.duplicates_detected == 1
    assert len(clean) == 1
    assert clean[0] == m1


def test_first_duplicate_occurrence_wins(base_canonical_message):
    """9. Test the first-occurrence-wins policy: first record is kept, second discarded."""
    m1 = base_canonical_message.model_copy(update={"text_content": "First occurrence text"})
    m2 = base_canonical_message.model_copy(update={"text_content": "Second occurrence text"})
    m3 = base_canonical_message.model_copy(
        update={"canonical_id": "telegram:3190072493:1083", "native_id": "1083", "text_content": "Distinct text"}
    )

    clean, report = process_quality([m1, m2, m3])
    assert report.records_seen == 3
    assert report.duplicates_detected == 1
    assert len(clean) == 2
    assert clean[0].text_content == "First occurrence text"
    assert clean[1].canonical_id == "telegram:3190072493:1083"


def test_duplicate_provenance_retained(base_canonical_message):
    """10. Test that duplicate records preserve provenance for both occurrences in the report."""
    rec1 = ReplayRecord(
        source_file="batch_01.jsonl",
        line_number=10,
        raw_record={},
        canonical_message=base_canonical_message,
    )
    rec2 = ReplayRecord(
        source_file="batch_02.jsonl",
        line_number=25,
        raw_record={},
        canonical_message=base_canonical_message,
    )

    clean, report = process_quality([rec1, rec2])
    assert report.duplicates_detected == 1

    dup_issues = [i for i in report.issues if i.code == "DUPLICATE_CANONICAL_ID"]
    assert len(dup_issues) == 1
    issue = dup_issues[0]

    assert issue.canonical_id == base_canonical_message.canonical_id
    assert "batch_01.jsonl:10" in issue.message
    assert "batch_02.jsonl:25" in issue.message
    assert issue.details["first_occurrence"]["source_file"] == "batch_01.jsonl"
    assert issue.details["first_occurrence"]["line_number"] == 10
    assert issue.details["duplicate_occurrence"]["source_file"] == "batch_02.jsonl"
    assert issue.details["duplicate_occurrence"]["line_number"] == 25


def test_identical_text_different_canonical_ids_not_deduplicated(base_canonical_message):
    """11. Test that messages with identical text but different canonical_ids are NOT deduplicated."""
    shared_text = "Breaking intelligence update for the region."
    m_channel_a = base_canonical_message.model_copy(
        update={
            "canonical_id": "telegram:111:100",
            "author_id": "111",
            "native_id": "100",
            "text_content": shared_text,
        }
    )
    m_channel_b = base_canonical_message.model_copy(
        update={
            "canonical_id": "telegram:222:100",
            "author_id": "222",
            "native_id": "100",
            "text_content": shared_text,
        }
    )

    clean, report = process_quality([m_channel_a, m_channel_b])
    assert report.records_seen == 2
    assert report.duplicates_detected == 0
    assert len(clean) == 2


def test_deterministic_ordering_preserved(base_canonical_message):
    """12. Test that input sequence order is preserved through quality processing."""
    m1 = base_canonical_message.model_copy(update={"canonical_id": "telegram:1:1", "native_id": "1"})
    m2 = base_canonical_message.model_copy(update={"canonical_id": "telegram:1:2", "native_id": "2"})
    m3 = base_canonical_message.model_copy(update={"canonical_id": "telegram:1:3", "native_id": "3"})

    clean, report = process_quality([m3, m1, m2])
    assert [m.native_id for m in clean] == ["3", "1", "2"]


def test_multiple_files_processed_deterministically(tmp_path, base_canonical_message):
    """13. Test multi-file replay preserves deterministic file order and line order."""
    f1 = tmp_path / "a_batch.jsonl"
    f2 = tmp_path / "b_batch.jsonl"

    rec1 = {
        "id": 1,
        "date": "2026-09-02T00:00:00Z",
        "peer_id": 100,
        "chat": {"id": 100},
        "collected_at": "2026-09-02T12:00:00Z",
    }
    rec2 = {
        "id": 2,
        "date": "2026-09-02T00:00:00Z",
        "peer_id": 100,
        "chat": {"id": 100},
        "collected_at": "2026-09-02T12:00:00Z",
    }
    f1.write_text(json.dumps(rec1) + "\n", encoding="utf-8")
    f2.write_text(json.dumps(rec2) + "\n", encoding="utf-8")

    out_parquet = tmp_path / "combined.parquet"
    summary = build_processed_dataset(tmp_path, out_parquet)

    assert summary.files_processed == 2
    assert summary.records_written == 2

    messages = read_canonical_messages(out_parquet)
    assert messages[0].canonical_id == "telegram:100:1"
    assert messages[1].canonical_id == "telegram:100:2"


def test_quality_report_metrics(base_canonical_message):
    """14. Test that QualityReport computes accurate summary metrics."""
    valid_m = base_canonical_message
    dup_m = base_canonical_message
    invalid_m = base_canonical_message.model_copy(
        update={
            "canonical_id": "telegram:1:99",
            "published_at": datetime(2026, 9, 2, 12, 0, 0, tzinfo=timezone.utc),
            "collected_at": datetime(2026, 9, 2, 10, 0, 0, tzinfo=timezone.utc),  # earlier
        }
    )

    clean, report = process_quality([valid_m, dup_m, invalid_m])

    assert report.records_seen == 3
    assert report.records_valid == 1
    assert report.records_invalid == 1
    assert report.duplicates_detected == 1
    assert report.records_written == 1
    assert len(clean) == 1


def test_quality_report_json_serialization(tmp_path, base_canonical_message):
    """15. Test that QualityReport serializes cleanly to JSON and excludes secret credentials."""
    _, report = process_quality([base_canonical_message], metadata={"dataset_version": "1.0.0"})
    report_file = tmp_path / "report.json"
    report.save_json(report_file)

    assert report_file.exists()
    content = report_file.read_text(encoding="utf-8")
    parsed = json.loads(content)

    assert parsed["dataset_platform"] == "telegram"
    assert parsed["records_written"] == 1
    assert parsed["metadata"]["dataset_version"] == "1.0.0"

    content_lower = content.lower()
    assert "api_hash" not in content_lower
    assert "phone" not in content_lower
    assert "password" not in content_lower


def test_invalid_records_excluded_from_parquet(tmp_path):
    """16. Test that invalid records are rejected by quality pipeline and excluded from Parquet."""
    valid_rec = {
        "id": 101,
        "date": "2026-09-02T10:00:00Z",
        "peer_id": 100,
        "chat": {"id": 100},
        "collected_at": "2026-09-02T12:00:00Z",
    }
    # Bad temporal ordering: collected_at precedes published_at
    invalid_rec = {
        "id": 102,
        "date": "2026-09-02T15:00:00Z",
        "peer_id": 100,
        "chat": {"id": 100},
        "collected_at": "2026-09-02T12:00:00Z",
    }

    raw_file = tmp_path / "mixed.jsonl"
    raw_file.write_text(f"{json.dumps(valid_rec)}\n{json.dumps(invalid_rec)}\n", encoding="utf-8")

    out_parquet = tmp_path / "result.parquet"
    summary = build_processed_dataset(raw_file, out_parquet)

    assert summary.records_read == 2
    assert summary.records_invalid == 1
    assert summary.records_written == 1

    messages = read_canonical_messages(out_parquet)
    assert len(messages) == 1
    assert messages[0].canonical_id == "telegram:100:101"


def test_duplicate_records_excluded_from_parquet(tmp_path):
    """17. Test that duplicate records (synthetic A, A, B fixture) do not enter Parquet twice."""
    rec_a = {
        "id": 100,
        "date": "2026-09-02T00:00:00Z",
        "peer_id": 999,
        "chat": {"id": 999},
        "collected_at": "2026-09-02T12:00:00Z",
    }
    rec_b = {
        "id": 200,
        "date": "2026-09-02T00:00:00Z",
        "peer_id": 999,
        "chat": {"id": 999},
        "collected_at": "2026-09-02T12:00:00Z",
    }

    # Fixture: A, A, B
    raw_file = tmp_path / "synthetic_dupes.jsonl"
    lines = [json.dumps(rec_a), json.dumps(rec_a), json.dumps(rec_b)]
    raw_file.write_text("\n".join(lines) + "\n", encoding="utf-8")

    out_parquet = tmp_path / "deduped.parquet"
    summary = build_processed_dataset(raw_file, out_parquet)

    assert summary.records_read == 3
    assert summary.duplicates_detected == 1
    assert summary.records_written == 2

    messages = read_canonical_messages(out_parquet)
    assert len(messages) == 2
    assert [m.native_id for m in messages] == ["100", "200"]


def test_paired_artifact_overwrite_protection(tmp_path, base_canonical_message):
    """18. Test that overwrite protection guards both Parquet and Quality Report JSON."""
    raw_file = tmp_path / "test.jsonl"
    raw_rec = {
        "id": 100,
        "date": "2026-09-02T00:00:00Z",
        "peer_id": 999,
        "chat": {"id": 999},
        "collected_at": "2026-09-02T12:00:00Z",
    }
    raw_file.write_text(json.dumps(raw_rec) + "\n", encoding="utf-8")

    out_parquet = tmp_path / "dataset.parquet"
    report_json = tmp_path / "dataset.quality.json"

    # First write succeeds and creates both artifacts
    build_processed_dataset(raw_file, out_parquet)
    assert out_parquet.exists()
    assert report_json.exists()

    # Second write without overwrite fails
    with pytest.raises(FileExistsError):
        build_processed_dataset(raw_file, out_parquet, overwrite=False)

    # With overwrite=True succeeds
    summary = build_processed_dataset(raw_file, out_parquet, overwrite=True)
    assert summary.records_written == 1


def test_raw_jsonl_remains_untouched_during_quality_pipeline(tmp_path):
    """19. Test that SHA-256 of raw JSONL is identical before and after quality & Parquet processing."""
    raw_file = tmp_path / "immutable_test.jsonl"
    raw_rec = {
        "id": 777,
        "date": "2026-09-02T00:00:00Z",
        "peer_id": 888,
        "chat": {"id": 888},
        "collected_at": "2026-09-02T12:00:00Z",
    }
    raw_file.write_text(json.dumps(raw_rec) + "\n", encoding="utf-8")
    hash_before = hashlib.sha256(raw_file.read_bytes()).hexdigest()

    out_parquet = tmp_path / "output.parquet"
    build_processed_dataset(raw_file, out_parquet)

    hash_after = hashlib.sha256(raw_file.read_bytes()).hexdigest()
    assert hash_before == hash_after
