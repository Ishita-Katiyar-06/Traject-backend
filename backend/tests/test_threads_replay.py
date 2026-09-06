import json
from pathlib import Path

import pytest

from app.replay.threads_jsonl import ThreadsJSONLReplayer, iter_raw_threads_jsonl
from app.schemas.canonical_message import Platform


def test_threads_replay_success(tmp_path: Path):
    fixture_path = Path(__file__).parent / "fixtures" / "threads" / "sample_threads.json"
    with open(fixture_path, "r", encoding="utf-8") as f:
        samples = json.load(f)

    jsonl_file = tmp_path / "test_threads_raw.jsonl"
    with open(jsonl_file, "w", encoding="utf-8") as f:
        for item in samples:
            f.write(json.dumps(item) + "\n")

    replayer = ThreadsJSONLReplayer()
    summary = replayer.replay_path(jsonl_file)

    assert summary.files_processed == 1
    assert summary.records_read == 2
    assert summary.records_normalized == 2
    assert summary.records_failed == 0

    first = summary.results[0]
    assert first.is_success is True
    assert first.canonical_message.platform == Platform.THREADS
    assert first.canonical_message.raw_reference == "test_threads_raw.jsonl:line_1"


def test_threads_replay_malformed(tmp_path: Path):
    jsonl_file = tmp_path / "malformed_threads.jsonl"
    with open(jsonl_file, "w", encoding="utf-8") as f:
        f.write('{"id": "1", "timestamp": "2026-09-06T10:00:00Z", "text": "Valid"}\n')
        f.write('CORRUPTED_LINE\n')
        f.write('{"missing_id": true}\n')

    replayer = ThreadsJSONLReplayer()
    summary = replayer.replay_path(jsonl_file)

    assert summary.records_read == 3
    assert summary.records_normalized == 1
    assert summary.records_failed == 2
