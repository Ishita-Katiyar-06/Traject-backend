import json
from pathlib import Path

import pytest

from app.normalizers.threads import ThreadsNormalizer
from app.schemas.canonical_message import AuthorType, CanonicalMessage, Platform


def test_threads_normalizer_fixture():
    fixture_path = Path(__file__).parent / "fixtures" / "threads" / "sample_threads.json"
    with open(fixture_path, "r", encoding="utf-8") as f:
        samples = json.load(f)

    # 1. Image post with engagement
    cmsg1 = ThreadsNormalizer.normalize(
        samples[0],
        raw_reference="threads_test.jsonl:line_1",
    )

    assert isinstance(cmsg1, CanonicalMessage)
    assert cmsg1.platform == Platform.THREADS
    assert cmsg1.native_id == "18012345678901234"
    assert cmsg1.canonical_id == "threads:18012345678901234"
    assert cmsg1.author_username == "thakur_saransh_rana"
    assert cmsg1.author_type == AuthorType.USER
    assert cmsg1.has_media is True
    assert "photo" in cmsg1.media_types
    assert cmsg1.reactions == {"likes": 42}
    assert cmsg1.replies_count == 5
    assert cmsg1.forwards_count == 4  # 3 reposts + 1 quote
    assert cmsg1.views_count == 1500
    assert "growth" in cmsg1.hashtags
    assert "motivation" in cmsg1.hashtags
    assert "https://threads.net/@thakur_saransh_rana" in cmsg1.urls

    # 2. Text-only post
    cmsg2 = ThreadsNormalizer.normalize(samples[1])
    assert cmsg2.platform == Platform.THREADS
    assert cmsg2.has_media is False
    assert cmsg2.media_types == []
    assert "saransh" in cmsg2.mentions
    assert "tech" in cmsg2.hashtags


def test_threads_normalizer_invalid():
    with pytest.raises(TypeError):
        ThreadsNormalizer.normalize("invalid")

    with pytest.raises(ValueError, match="missing 'id'"):
        ThreadsNormalizer.normalize({"text": "No ID"})

    with pytest.raises(ValueError, match="Missing timestamp"):
        ThreadsNormalizer.normalize({"id": "180"})
