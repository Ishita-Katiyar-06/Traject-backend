import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch
import pytest

from app.normalizers.telegram import TelegramNormalizer
from app.replay.telegram_jsonl import (
    TelegramJSONLReplayer,
    iter_raw_telegram_jsonl,
    replay_directory,
    replay_file,
    validate_raw_telegram_record,
)
from app.schemas.canonical_message import CanonicalMessage, Platform


@pytest.fixture
def sample_raw_record():
    return {
        "id": 1082,
        "date": "2026-09-02T07:36:03+00:00",
        "peer_id": 3190072493,
        "chat": {
            "id": 3190072493,
            "title": "Genshin Updates",
            "username": "GenshinUpdate_STR",
            "type": "channel",
            "participants_count": None,
        },
        "from": {
            "id": 3190072493,
            "username": "GenshinUpdate_STR",
            "first_name": None,
            "last_name": None,
            "is_bot": False,
            "type": "user",
        },
        "message": "Character Selector Interface 7.1 #GenshinImpact",
        "media": {"type": "photo"},
        "fwd_from": None,
        "reply_to": None,
        "views": 12,
        "forwards": 0,
        "replies": 11,
        "reactions": [],
        "entities": [{"type": "hashtag", "text": "#GenshinImpact"}],
        "collected_at": "2026-09-02T19:43:25.067787+00:00",
        "raw_reference": "GenshinUpdate_STR_20260902_194324.jsonl:2",
    }


def test_read_valid_jsonl(tmp_path, sample_raw_record):
    """1. Test reading valid JSONL incrementally."""
    file_path = tmp_path / "valid.jsonl"
    file_path.write_text(json.dumps(sample_raw_record) + "\n", encoding="utf-8")

    lines = list(iter_raw_telegram_jsonl(file_path))
    assert len(lines) == 1
    line_num, record, err = lines[0]
    assert line_num == 1
    assert err is None
    assert record is not None
    assert record["id"] == 1082


def test_multiple_records_in_one_file(tmp_path, sample_raw_record):
    """2. Test reading multiple records in one file with 1-indexed line numbers."""
    rec1 = dict(sample_raw_record, id=101)
    rec2 = dict(sample_raw_record, id=102)
    rec3 = dict(sample_raw_record, id=103)

    file_path = tmp_path / "multi.jsonl"
    content = "\n".join([json.dumps(rec1), json.dumps(rec2), json.dumps(rec3)]) + "\n"
    file_path.write_text(content, encoding="utf-8")

    lines = list(iter_raw_telegram_jsonl(file_path))
    assert len(lines) == 3
    assert lines[0][0] == 1 and lines[0][1]["id"] == 101
    assert lines[1][0] == 2 and lines[1][1]["id"] == 102
    assert lines[2][0] == 3 and lines[2][1]["id"] == 103


def test_blank_line_behavior(tmp_path, sample_raw_record):
    """3. Test blank lines are ignored without producing false-positive errors."""
    file_path = tmp_path / "blanks.jsonl"
    content = f"\n  \n{json.dumps(sample_raw_record)}\n\n   \n"
    file_path.write_text(content, encoding="utf-8")

    lines = list(iter_raw_telegram_jsonl(file_path))
    assert len(lines) == 1
    line_num, record, err = lines[0]
    assert line_num == 3
    assert err is None
    assert record["id"] == 1082


def test_malformed_json_handling(tmp_path, sample_raw_record):
    """4. Test malformed JSON lines are reported with exact line number."""
    file_path = tmp_path / "corrupt.jsonl"
    content = f"{json.dumps(sample_raw_record)}\n{{invalid_json_string}}\n"
    file_path.write_text(content, encoding="utf-8")

    lines = list(iter_raw_telegram_jsonl(file_path))
    assert len(lines) == 2

    # Line 1: valid
    assert lines[0][0] == 1 and lines[0][2] is None
    # Line 2: malformed
    assert lines[1][0] == 2
    assert lines[1][1] is None
    assert "Malformed JSON" in lines[1][2]


def test_missing_required_raw_fields():
    """5. Test pre-validation flags missing required fields with clear messages."""
    # Missing id
    is_valid, err = validate_raw_telegram_record({"date": "2026-09-02T00:00:00Z", "peer_id": 123})
    assert not is_valid
    assert "'id' or 'message_id'" in err.lower()


    # Missing author/peer
    is_valid, err = validate_raw_telegram_record({"id": 100, "date": "2026-09-02T00:00:00Z"})
    assert not is_valid
    assert "chat or author identifier" in err.lower()

    # Missing timestamp
    is_valid, err = validate_raw_telegram_record({"id": 100, "peer_id": 123})
    assert not is_valid
    assert "missing telegram timestamp" in err.lower()


def test_normalization_of_valid_replay_record(tmp_path, sample_raw_record):
    """6. Test normalization produces a valid CanonicalMessage."""
    file_path = tmp_path / "record.jsonl"
    file_path.write_text(json.dumps(sample_raw_record) + "\n", encoding="utf-8")

    records = list(replay_file(file_path))
    assert len(records) == 1
    rec = records[0]

    assert rec.is_success
    assert rec.error is None
    assert isinstance(rec.canonical_message, CanonicalMessage)
    assert rec.canonical_message.platform == Platform.TELEGRAM
    assert rec.canonical_message.native_id == "1082"
    assert rec.canonical_message.canonical_id == "telegram:3190072493:1082"
    assert "#GenshinImpact" in rec.canonical_message.hashtags


def test_provenance_tracking(tmp_path, sample_raw_record):
    """7. Test provenance captures source file, line number, and raw reference."""
    file_path = tmp_path / "provenance_test.jsonl"
    file_path.write_text(json.dumps(sample_raw_record) + "\n", encoding="utf-8")

    records = list(replay_file(file_path))
    rec = records[0]

    assert rec.source_file == str(file_path.resolve())
    assert rec.line_number == 1
    assert rec.canonical_message.raw_reference == "GenshinUpdate_STR_20260902_194324.jsonl:2"


def test_single_file_replay(tmp_path, sample_raw_record):
    """8. Test running replay on a single file path via TelegramJSONLReplayer."""
    file_path = tmp_path / "single.jsonl"
    file_path.write_text(json.dumps(sample_raw_record) + "\n", encoding="utf-8")

    summary = TelegramJSONLReplayer.run(file_path)
    assert summary.files_processed == 1
    assert summary.records_read == 1
    assert summary.records_normalized == 1
    assert summary.records_failed == 0
    assert len(summary.failures) == 0


def test_directory_replay(tmp_path, sample_raw_record):
    """9. Test running replay over a directory with multiple .jsonl files."""
    f1 = tmp_path / "batch_01.jsonl"
    f2 = tmp_path / "batch_02.jsonl"

    f1.write_text(json.dumps(sample_raw_record) + "\n", encoding="utf-8")
    f2.write_text(json.dumps(sample_raw_record) + "\n", encoding="utf-8")

    summary = TelegramJSONLReplayer.run(tmp_path)
    assert summary.files_processed == 2
    assert summary.records_read == 2
    assert summary.records_normalized == 2
    assert summary.records_failed == 0


def test_deterministic_ordering(tmp_path, sample_raw_record):
    """10. Test directory replay processes files in deterministic sorted alphabetical order."""
    f_z = tmp_path / "z_batch.jsonl"
    f_a = tmp_path / "a_batch.jsonl"
    f_m = tmp_path / "m_batch.jsonl"

    rec_z = dict(sample_raw_record, id=999)
    rec_a = dict(sample_raw_record, id=111)
    rec_m = dict(sample_raw_record, id=555)

    f_z.write_text(json.dumps(rec_z) + "\n", encoding="utf-8")
    f_a.write_text(json.dumps(rec_a) + "\n", encoding="utf-8")
    f_m.write_text(json.dumps(rec_m) + "\n", encoding="utf-8")

    replayed = list(replay_directory(tmp_path))
    assert len(replayed) == 3

    # Must follow a_batch -> m_batch -> z_batch
    assert Path(replayed[0].source_file).name == "a_batch.jsonl"
    assert replayed[0].canonical_message.native_id == "111"

    assert Path(replayed[1].source_file).name == "m_batch.jsonl"
    assert replayed[1].canonical_message.native_id == "555"

    assert Path(replayed[2].source_file).name == "z_batch.jsonl"
    assert replayed[2].canonical_message.native_id == "999"


def test_preserves_original_collected_at(tmp_path, sample_raw_record):
    """11. Test replay retains the original collected_at timestamp from raw payload rather than replacing with 'now'."""
    raw_collected_str = "2026-09-02T19:43:25.067787+00:00"
    file_path = tmp_path / "timestamp.jsonl"
    file_path.write_text(json.dumps(sample_raw_record) + "\n", encoding="utf-8")

    records = list(replay_file(file_path))
    canonical = records[0].canonical_message

    expected_dt = datetime.fromisoformat(raw_collected_str).astimezone(timezone.utc)
    assert canonical.collected_at == expected_dt
    # Ensure it's the 2026-09-02 timestamp from the payload, not the current run time
    assert canonical.collected_at.day == 2
    assert canonical.collected_at.hour == 19


def test_raw_files_unmodified(tmp_path, sample_raw_record):
    """12. Test that replaying does not modify, rewrite, or truncate raw files."""
    file_path = tmp_path / "immutable.jsonl"
    content = json.dumps(sample_raw_record) + "\n"
    file_path.write_text(content, encoding="utf-8")

    # Hash before replay
    hash_before = hashlib.sha256(file_path.read_bytes()).hexdigest()

    # Replay twice
    list(replay_file(file_path))
    TelegramJSONLReplayer.run(file_path)

    # Hash after replay
    hash_after = hashlib.sha256(file_path.read_bytes()).hexdigest()
    assert hash_before == hash_after


def test_malformed_record_does_not_abort_subsequent_valid_records(tmp_path, sample_raw_record):
    """13. Test malformed JSON or schema errors do not crash subsequent valid lines."""
    valid_rec1 = dict(sample_raw_record, id=101)
    bad_json_line = "{not a valid json line"
    bad_schema_line = json.dumps({"date": "2026-09-02T00:00:00Z"})  # missing id and author
    valid_rec2 = dict(sample_raw_record, id=102)

    file_path = tmp_path / "mixed.jsonl"
    lines = [
        json.dumps(valid_rec1),
        bad_json_line,
        bad_schema_line,
        json.dumps(valid_rec2),
    ]
    file_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    summary = TelegramJSONLReplayer.run(file_path)

    assert summary.records_read == 4
    assert summary.records_normalized == 2
    assert summary.records_failed == 2

    # Verify which lines succeeded and failed
    assert summary.results[0].line_number == 1 and summary.results[0].is_success
    assert summary.results[1].line_number == 2 and not summary.results[1].is_success
    assert summary.results[2].line_number == 3 and not summary.results[2].is_success
    assert summary.results[3].line_number == 4 and summary.results[3].is_success


def test_no_telethon_client_or_network_used(tmp_path, sample_raw_record):
    """14. Test that the replay module runs completely offline without instantiating Telethon."""
    file_path = tmp_path / "offline.jsonl"
    file_path.write_text(json.dumps(sample_raw_record) + "\n", encoding="utf-8")

    # Ensure no TelethonClient is instantiated during replay
    with patch("telethon.TelegramClient.__init__", side_effect=AssertionError("Telethon must not be called in replay!")):
        summary = TelegramJSONLReplayer.run(file_path)
        assert summary.records_normalized == 1


def test_replay_uses_existing_normalizer(tmp_path, sample_raw_record):
    """15. Regression test proving replay calls TelegramNormalizer.normalize rather than a duplicate implementation."""
    file_path = tmp_path / "single.jsonl"
    file_path.write_text(json.dumps(sample_raw_record) + "\n", encoding="utf-8")

    with patch.object(TelegramNormalizer, "normalize", wraps=TelegramNormalizer.normalize) as mock_norm:
        list(replay_file(file_path))
        assert mock_norm.call_count == 1
        call_args = mock_norm.call_args
        assert call_args.args[0]["id"] == 1082
