import json
from pathlib import Path

import pytest

from app.replay.discord_jsonl import DiscordJSONLReplayer, iter_raw_discord_jsonl
from app.schemas.canonical_message import Platform


def test_discord_replay_success(tmp_path: Path):
    fixture_path = Path(__file__).parent / "fixtures" / "discord" / "sample_messages.json"
    with open(fixture_path, "r", encoding="utf-8") as f:
        samples = json.load(f)

    jsonl_file = tmp_path / "test_discord_raw.jsonl"
    with open(jsonl_file, "w", encoding="utf-8") as f:
        for item in samples:
            f.write(json.dumps(item) + "\n")

    replayer = DiscordJSONLReplayer()
    summary = replayer.replay_path(jsonl_file)

    assert summary.files_processed == 1
    assert summary.records_read == 2
    assert summary.records_normalized == 2
    assert summary.records_failed == 0

    first_record = summary.results[0]
    assert first_record.is_success is True
    assert first_record.canonical_message.platform == Platform.DISCORD
    assert first_record.canonical_message.raw_reference == "test_discord_raw.jsonl:line_1"


def test_discord_replay_malformed_tolerance(tmp_path: Path):
    jsonl_file = tmp_path / "malformed_discord.jsonl"
    with open(jsonl_file, "w", encoding="utf-8") as f:
        f.write('{"id": "1", "timestamp": "2026-09-06T10:00:00Z", "content": "Valid"}\n')
        f.write('NOT_JSON_AT_ALL\n')
        f.write('{"missing_id": true}\n')
        f.write('{"id": "2", "timestamp": "2026-09-06T10:05:00Z", "content": "Also Valid"}\n')

    replayer = DiscordJSONLReplayer()
    summary = replayer.replay_path(jsonl_file)

    assert summary.records_read == 4
    assert summary.records_normalized == 2
    assert summary.records_failed == 2
    assert len(summary.failures) == 2
