from datetime import datetime, timezone, timedelta
import pytest
from pydantic import ValidationError

from app.schemas.canonical_message import AuthorType, CanonicalMessage, Platform


def test_valid_canonical_message():
    """Test creating a fully populated valid CanonicalMessage."""
    now_utc = datetime.now(timezone.utc)
    msg = CanonicalMessage(
        canonical_id="telegram:123456",
        platform=Platform.TELEGRAM,
        native_id="123456",
        author_id="998877",
        author_username="test_channel",
        author_type=AuthorType.CHANNEL,
        channel_title="Test Intelligence Channel",
        subscriber_count=15000,
        published_at=now_utc,
        collected_at=now_utc,
        text_content="Situation update on regional developments #intel",
        language="en",
        media_types=["photo"],
        has_media=True,
        is_forward=False,
        is_repost=False,
        origin_source_id=None,
        reply_to_id=None,
        thread_id=None,
        views_count=5200,
        forwards_count=120,
        replies_count=35,
        reactions={"👍": 250, "🔥": 45},
        urls=["https://example.com/report"],
        hashtags=["#intel"],
        mentions=["@test_channel"],
        raw_reference="data/raw/telegram/batch_01.jsonl:10",
    )

    assert msg.canonical_id == "telegram:123456"
    assert msg.platform == Platform.TELEGRAM
    assert msg.native_id == "123456"
    assert msg.has_media is True
    assert msg.views_count == 5200
    assert msg.reactions["👍"] == 250


def test_invalid_platform_rejection():
    """Test that unsupported platforms are strictly rejected."""
    now_utc = datetime.now(timezone.utc)
    with pytest.raises(ValidationError) as excinfo:
        CanonicalMessage(
            canonical_id="unsupported:123",
            platform="unsupported_platform",  # type: ignore[arg-type]
            native_id="123",
            author_id="author_1",
            published_at=now_utc,
            collected_at=now_utc,
        )
    assert "Input should be 'telegram', 'x', 'discord' or 'threads'" in str(excinfo.value)


def test_missing_required_fields():
    """Test that omitting required fields raises validation error."""
    with pytest.raises(ValidationError) as excinfo:
        CanonicalMessage(
            canonical_id="telegram:101",
            platform=Platform.TELEGRAM,
            # missing native_id, author_id, published_at, collected_at
        )
    errors = excinfo.value.errors()
    missing_fields = {e["loc"][0] for e in errors}
    assert "native_id" in missing_fields
    assert "author_id" in missing_fields
    assert "published_at" in missing_fields
    assert "collected_at" in missing_fields


def test_utc_timestamp_validation():
    """Test that naive datetimes are rejected and non-UTC timezones are normalized to UTC."""
    # 1. Naive datetime must be rejected
    naive_dt = datetime(2026, 9, 3, 12, 0, 0)
    with pytest.raises(ValidationError) as excinfo:
        CanonicalMessage(
            canonical_id="telegram:200",
            platform=Platform.TELEGRAM,
            native_id="200",
            author_id="author_1",
            published_at=naive_dt,
            collected_at=datetime.now(timezone.utc),
        )
    assert "Datetime must be timezone-aware" in str(excinfo.value)

    # 2. Timezone with offset (e.g. IST +05:30) must be normalized to UTC
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    ist_dt = datetime(2026, 9, 3, 15, 30, 0, tzinfo=ist_tz)
    msg = CanonicalMessage(
        canonical_id="telegram:201",
        platform=Platform.TELEGRAM,
        native_id="201",
        author_id="author_1",
        published_at=ist_dt,
        collected_at=datetime.now(timezone.utc),
    )
    assert msg.published_at.tzinfo == timezone.utc
    assert msg.published_at.hour == 10  # 15:30 IST - 5:30 = 10:00 UTC


def test_stable_canonical_id_generation():
    """Test deterministic canonical_id helper and model validator consistency."""
    # Chat-scoped Telegram ID
    gen_tg_scoped = CanonicalMessage.build_canonical_id(Platform.TELEGRAM, "100", chat_id="-100123456789")
    assert gen_tg_scoped == "telegram:-100123456789:100"

    # Unscoped / compound Telegram ID
    gen_tg = CanonicalMessage.build_canonical_id(Platform.TELEGRAM, "999888")
    assert gen_tg == "telegram:999888"

    # Platform X canonical ID
    gen_x = CanonicalMessage.build_canonical_id(Platform.X, "18273645")
    assert gen_x == "x:18273645"

    now_utc = datetime.now(timezone.utc)
    # Valid scoped Telegram message
    msg = CanonicalMessage(
        canonical_id="telegram:-100123456789:100",
        platform=Platform.TELEGRAM,
        native_id="100",
        author_id="-100123456789",
        published_at=now_utc,
        collected_at=now_utc,
    )
    assert msg.canonical_id == "telegram:-100123456789:100"

    # Mismatched canonical_id should be rejected
    with pytest.raises(ValidationError) as excinfo:
        CanonicalMessage(
            canonical_id="telegram:wrong_id",
            platform=Platform.TELEGRAM,
            native_id="999888",
            author_id="author_1",
            published_at=now_utc,
            collected_at=now_utc,
        )
    assert "canonical_id mismatch" in str(excinfo.value)


def test_telegram_chat_scoped_canonical_id_differentiation():
    """Prove that two messages with the same message ID but different chat IDs receive different canonical IDs."""
    same_msg_id = "100"
    chat_a = "-100111111111"
    chat_b = "-100222222222"

    canonical_id_a = CanonicalMessage.build_canonical_id(Platform.TELEGRAM, same_msg_id, chat_id=chat_a)
    canonical_id_b = CanonicalMessage.build_canonical_id(Platform.TELEGRAM, same_msg_id, chat_id=chat_b)

    assert canonical_id_a == "telegram:-100111111111:100"
    assert canonical_id_b == "telegram:-100222222222:100"
    assert canonical_id_a != canonical_id_b

    now_utc = datetime.now(timezone.utc)
    msg_a = CanonicalMessage(
        canonical_id=canonical_id_a,
        platform=Platform.TELEGRAM,
        native_id=same_msg_id,
        author_id=chat_a,
        published_at=now_utc,
        collected_at=now_utc,
    )
    msg_b = CanonicalMessage(
        canonical_id=canonical_id_b,
        platform=Platform.TELEGRAM,
        native_id=same_msg_id,
        author_id=chat_b,
        published_at=now_utc,
        collected_at=now_utc,
    )

    assert msg_a.canonical_id != msg_b.canonical_id
    assert msg_a.native_id == msg_b.native_id



def test_extra_fields_forbidden():
    """Test that extraneous fields cannot be silently added to CanonicalMessage."""
    now_utc = datetime.now(timezone.utc)
    with pytest.raises(ValidationError) as excinfo:
        CanonicalMessage(
            canonical_id="telegram:300",
            platform=Platform.TELEGRAM,
            native_id="300",
            author_id="author_1",
            published_at=now_utc,
            collected_at=now_utc,
            unexpected_field="disallowed",  # type: ignore[call-arg]
        )
    assert "Extra inputs are not permitted" in str(excinfo.value)


def test_negative_metric_rejection():
    """Test that negative engagement counts are rejected."""
    now_utc = datetime.now(timezone.utc)
    with pytest.raises(ValidationError):
        CanonicalMessage(
            canonical_id="telegram:301",
            platform=Platform.TELEGRAM,
            native_id="301",
            author_id="author_1",
            published_at=now_utc,
            collected_at=now_utc,
            views_count=-5,
        )
