import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import pytest

from app.collectors.telegram.client import TelegramCredentials
from app.collectors.telegram.collector import TelegramCollector
from app.collectors.telegram.serializer import TelethonMessageSerializer
from app.schemas.canonical_message import AuthorType, Platform


# ==============================================================================
# Synthetic / Mock Telethon Classes
# ==============================================================================

class MockPeerChannel:
    def __init__(self, channel_id: int):
        self.channel_id = channel_id


class MockChat:
    def __init__(
        self,
        id: int = -100123456789,
        title: str = "Defense & Geopolitics Intel",
        username: str = "defense_intel",
        broadcast: bool = True,
        participants_count: int = 45000,
    ):
        self.id = id
        self.title = title
        self.username = username
        self.broadcast = broadcast
        self.participants_count = participants_count


class MockSender:
    def __init__(
        self,
        id: int = 987654,
        username: str = "field_analyst",
        first_name: str = "Field",
        last_name: str = "Analyst",
        bot: bool = False,
    ):
        self.id = id
        self.username = username
        self.first_name = first_name
        self.last_name = last_name
        self.bot = bot


class MockMediaPhoto:
    pass


class MockFwdHeader:
    def __init__(self, from_id: Any, channel_post: int = 42, from_name: str = "Source Channel"):
        self.from_id = from_id
        self.channel_post = channel_post
        self.from_name = from_name
        self.date = datetime(2026, 9, 3, 0, 0, 0, tzinfo=timezone.utc)


class MockReplyHeader:
    def __init__(self, reply_to_msg_id: int = 1001, reply_to_top_id: int = 900):
        self.reply_to_msg_id = reply_to_msg_id
        self.reply_to_top_id = reply_to_top_id


class MockReactionEmoji:
    def __init__(self, emoticon: str):
        self.emoticon = emoticon


class MockReactionCount:
    def __init__(self, emoticon: str, count: int):
        self.reaction = MockReactionEmoji(emoticon)
        self.count = count


class MockReactions:
    def __init__(self, results: list[MockReactionCount]):
        self.results = results


class MockEntity:
    def __init__(self, cls_name: str, offset: int, length: int, url: str | None = None):
        self.__class__.__name__ = cls_name
        self.offset = offset
        self.length = length
        self.url = url


class MockTelethonMessage:
    def __init__(
        self,
        id: int = 501,
        date: datetime | None = None,
        message: str = "Confirmed border surveillance report: https://intel.org #Alert @field_analyst",
        chat: Any = None,
        chat_id: int = -100123456789,
        sender: Any = None,
        sender_id: int = 987654,
        media: Any = None,
        fwd_from: Any = None,
        reply_to: Any = None,
        views: int = 12000,
        forwards: int = 340,
        replies: int = 25,
        reactions: Any = None,
        entities: list[Any] | None = None,
    ):
        self.id = id
        self.date = date or datetime(2026, 9, 3, 0, 30, 0, tzinfo=timezone.utc)
        self.message = message
        self.chat = chat or MockChat()
        self.chat_id = chat_id
        self.sender = sender or MockSender()
        self.sender_id = sender_id
        self.media = media or MockMediaPhoto()
        self.fwd_from = fwd_from
        self.reply_to = reply_to
        self.views = views
        self.forwards = forwards
        self.replies = replies
        self.reactions = reactions or MockReactions([
            MockReactionCount("🔥", 120),
            MockReactionCount("👍", 450),
        ])
        self.entities = entities or [
            MockEntity("MessageEntityUrl", 41, 17, url="https://intel.org"),
            MockEntity("MessageEntityHashtag", 59, 6),
            MockEntity("MessageEntityMention", 66, 14),
        ]


class MockAsyncTelegramClient:
    """Mock Telethon client returning synthetic messages without network I/O."""

    def __init__(self, messages: list[MockTelethonMessage], is_authorized: bool = True):
        self.messages = messages
        self._connected = True
        self._authorized = is_authorized
        self.start_called = False
        self.start_calls_details: dict[str, Any] = {}

    def is_connected(self) -> bool:
        return self._connected

    async def connect(self) -> None:
        self._connected = True

    async def is_user_authorized(self) -> bool:
        return self._authorized

    async def start(
        self,
        phone=None,
        password=None,
        code_callback=None,
        max_attempts: int = 3,
    ) -> "MockAsyncTelegramClient":
        self.start_called = True
        # Execute callbacks to simulate interactive terminal inputs
        resolved_phone = phone() if callable(phone) else phone
        resolved_code = code_callback() if callable(code_callback) else code_callback
        resolved_pwd = password() if callable(password) else password
        self.start_calls_details = {
            "phone": resolved_phone,
            "code": resolved_code,
            "password": resolved_pwd,
        }
        self._authorized = True
        return self

    async def get_entity(self, channel: str) -> MockChat:
        if channel == "@private_channel":
            from telethon.errors import ChannelPrivateError
            raise ChannelPrivateError(request=None)
        if channel == "@non_existent":
            from telethon.errors import UsernameNotOccupiedError
            raise UsernameNotOccupiedError(request=None)
        return MockChat(username=channel.lstrip("@"))

    async def iter_messages(self, entity: Any, limit: int = 100):
        for msg in self.messages[:limit]:
            yield msg



# ==============================================================================
# Unit Tests
# ==============================================================================

def test_raw_serialization_basic():
    """1. Test that Telethon Message is converted to a JSON-serializable primitive dictionary."""
    msg = MockTelethonMessage(id=101)
    serialized = TelethonMessageSerializer.serialize(msg)

    assert isinstance(serialized, dict)
    assert serialized["id"] == 101
    assert serialized["views"] == 12000
    assert serialized["forwards"] == 340
    assert serialized["replies"] == 25
    # Must be 100% JSON-serializable
    json_str = json.dumps(serialized)
    assert "101" in json_str


def test_chat_id_and_peer_id_extraction():
    """2. Test extraction of chat ID from chat entity and peer_id."""
    chat = MockChat(id=-100999888, username="custom_channel")
    msg = MockTelethonMessage(id=102, chat=chat, chat_id=-100999888)
    serialized = TelethonMessageSerializer.serialize(msg)

    assert serialized["peer_id"] == -100999888
    assert serialized["chat"]["id"] == -100999888
    assert serialized["chat"]["username"] == "custom_channel"
    assert serialized["chat"]["type"] == "channel"


def test_message_id_extraction():
    """3. Test message ID extraction and missing ID error handling."""
    msg = MockTelethonMessage(id=4040)
    serialized = TelethonMessageSerializer.serialize(msg)
    assert serialized["id"] == 4040

    class MissingIdMessage:
        pass

    with pytest.raises(ValueError) as excinfo:
        TelethonMessageSerializer.serialize(MissingIdMessage())
    assert "missing 'id'" in str(excinfo.value)


def test_canonical_id_generation():
    """4. Test that serialized output produces chat-scoped canonical ID."""
    msg = MockTelethonMessage(id=777, chat=MockChat(id=-100555555))
    serialized = TelethonMessageSerializer.serialize(msg)
    
    from app.normalizers.telegram import TelegramNormalizer
    canonical = TelegramNormalizer.normalize(serialized)

    assert canonical.canonical_id == "telegram:-100555555:777"
    assert canonical.native_id == "777"


def test_media_handling():
    """5. Test media classification for photo, video, document."""
    photo_msg = MockTelethonMessage(id=801, media=MockMediaPhoto())
    photo_ser = TelethonMessageSerializer.serialize(photo_msg)
    assert photo_ser["media"] == {"type": "photo"}

    class MockMediaDoc:
        class document:
            mime_type = "application/pdf"

    doc_msg = MockTelethonMessage(id=802, media=MockMediaDoc())
    doc_ser = TelethonMessageSerializer.serialize(doc_msg)
    assert doc_ser["media"]["type"] == "document"
    assert doc_ser["media"]["mime_type"] == "application/pdf"


def test_forwarding_information():
    """6. Test forward header extraction."""
    fwd = MockFwdHeader(from_id=MockPeerChannel(channel_id=777888), channel_post=15)
    msg = MockTelethonMessage(id=901, fwd_from=fwd)
    serialized = TelethonMessageSerializer.serialize(msg)

    assert serialized["fwd_from"] is not None
    assert serialized["fwd_from"]["channel_id"] == 777888
    assert serialized["fwd_from"]["channel_post"] == 15
    assert serialized["fwd_from"]["from_name"] == "Source Channel"


def test_reply_information():
    """7. Test reply header extraction."""
    reply = MockReplyHeader(reply_to_msg_id=450, reply_to_top_id=400)
    msg = MockTelethonMessage(id=902, reply_to=reply)
    serialized = TelethonMessageSerializer.serialize(msg)

    assert serialized["reply_to"] is not None
    assert serialized["reply_to"]["reply_to_msg_id"] == 450
    assert serialized["reply_to"]["reply_to_top_id"] == 400


def test_engagement_fields():
    """8. Test reactions, views, forwards, and replies counts."""
    msg = MockTelethonMessage(
        id=903,
        views=8888,
        forwards=111,
        replies=22,
        reactions=MockReactions([MockReactionCount("❤️", 75)]),
    )
    serialized = TelethonMessageSerializer.serialize(msg)

    assert serialized["views"] == 8888
    assert serialized["forwards"] == 111
    assert serialized["replies"] == 22
    assert serialized["reactions"] == [{"emoji": "❤️", "count": 75}]


def test_malformed_payload_handling():
    """9. Test handling of malformed datetime or invalid structures."""
    class BadDateMessage:
        id = 123
        date = "not-a-date"
        message = "Text"

    with pytest.raises(ValueError):
        TelethonMessageSerializer.serialize(BadDateMessage())


def test_credentials_secret_masking(caplog):
    """10. Test that secret credentials are never exposed in string representations or logs."""
    creds = TelegramCredentials(
        api_id=1234567,
        api_hash="secret_hash_abcdef1234567890",
        session="my_session",
    )
    # 1. str() and repr() must mask api_hash and api_id
    rep = repr(creds)
    assert "1234567" not in rep
    assert "secret_hash_abcdef1234567890" not in rep
    assert "sec...890" in rep
    assert "api_id=***" in rep

    # 2. Logging credentials object must not leak secret
    with caplog.at_level(logging.INFO):
        logger = logging.getLogger("test_logger")
        logger.info("Initializing collector with: %s", creds)

    assert "secret_hash_abcdef1234567890" not in caplog.text
    assert "api_id=***" in caplog.text


@pytest.mark.asyncio
async def test_complete_mocked_collector_flow(tmp_path):
    """11. Prove complete flow: mock Telegram message -> serialize -> raw JSONL -> normalizer -> CanonicalMessage."""
    messages = [
        MockTelethonMessage(id=1, message="First intelligence alert #Intel1"),
        MockTelethonMessage(id=2, message="Second intelligence alert #Intel2"),
    ]
    mock_client = MockAsyncTelegramClient(messages)
    raw_dir = tmp_path / "data" / "raw" / "telegram"

    collector = TelegramCollector(
        client=mock_client,  # type: ignore[arg-type]
        raw_storage_dir=raw_dir,
    )

    result = await collector.collect_channel("@defense_intel", limit=2)

    assert result.channel == "@defense_intel"
    assert result.requested_limit == 2
    assert result.raw_messages_count == 2
    assert result.canonical_messages_count == 2
    assert len(result.canonical_messages) == 2

    # Check raw file written
    raw_file = Path(result.raw_file_path)
    assert raw_file.exists()
    lines = raw_file.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 2

    # Check first record in raw JSONL
    first_raw = json.loads(lines[0])
    assert first_raw["id"] == 1
    assert "First intelligence alert" in first_raw["message"]

    # Check CanonicalMessages
    c1 = result.canonical_messages[0]
    c2 = result.canonical_messages[1]
    assert c1.canonical_id == "telegram:-100123456789:1"
    assert c2.canonical_id == "telegram:-100123456789:2"
    assert c1.platform == Platform.TELEGRAM
    assert c1.author_username == "defense_intel"
    assert c1.author_type == AuthorType.CHANNEL
    assert "#Intel1" in c1.hashtags
    assert "#Intel2" in c2.hashtags


@pytest.mark.asyncio
async def test_collector_inaccessible_channel_errors(tmp_path):
    """Test collector error handling for private or non-existent channels."""
    mock_client = MockAsyncTelegramClient([])
    collector = TelegramCollector(
        client=mock_client,  # type: ignore[arg-type]
        raw_storage_dir=tmp_path,
    )

    with pytest.raises(PermissionError):
        await collector.collect_channel("@private_channel")

    with pytest.raises(ValueError):
        await collector.collect_channel("@non_existent")


@pytest.mark.asyncio
async def test_ensure_authorized_already_authorized():
    """1. Test that already-authorized sessions bypass interactive sign-in."""
    mock_client = MockAsyncTelegramClient([], is_authorized=True)
    creds = TelegramCredentials(api_id=123, api_hash="abcdef123456", session="test_sess")
    collector = TelegramCollector(credentials=creds, client=mock_client)  # type: ignore[arg-type]

    is_ok = await collector.ensure_authorized(mock_client)  # type: ignore[arg-type]

    assert is_ok is True
    assert mock_client.start_called is False


@pytest.mark.asyncio
async def test_ensure_authorized_unauthorized_interactive_flow(monkeypatch):
    """2. Test first-time unauthorized session triggers interactive sign-in with phone, code, and 2FA password."""
    mock_client = MockAsyncTelegramClient([], is_authorized=False)
    creds = TelegramCredentials(
        api_id=123,
        api_hash="abcdef123456",
        session="test_sess",
        phone="+919876543210",
    )
    collector = TelegramCollector(credentials=creds, client=mock_client)  # type: ignore[arg-type]

    # Monkeypatch input and getpass for code and 2FA password
    inputs = iter(["12345"])
    monkeypatch.setattr("builtins.input", lambda prompt="": next(inputs))
    monkeypatch.setattr("getpass.getpass", lambda prompt="": "my_secret_cloud_2fa_pwd")

    is_ok = await collector.ensure_authorized(mock_client)  # type: ignore[arg-type]

    assert is_ok is True
    assert mock_client.start_called is True
    assert mock_client.start_calls_details["phone"] == "+919876543210"
    assert mock_client.start_calls_details["code"] == "12345"
    assert mock_client.start_calls_details["password"] == "my_secret_cloud_2fa_pwd"


@pytest.mark.asyncio
async def test_ensure_authorized_auth_key_unregistered_clean_recovery():
    """3. Test AuthKeyUnregisteredError produces clear, actionable recovery instructions rather than opaque tracebacks."""
    from telethon.errors import AuthKeyUnregisteredError

    class UnregisteredClient(MockAsyncTelegramClient):
        async def is_user_authorized(self) -> bool:
            raise AuthKeyUnregisteredError(request=None)

    mock_client = UnregisteredClient([], is_authorized=False)
    creds = TelegramCredentials(api_id=123, api_hash="abcdef123456", session="traject_test")
    collector = TelegramCollector(credentials=creds, client=mock_client)  # type: ignore[arg-type]

    with pytest.raises(RuntimeError) as excinfo:
        await collector.ensure_authorized(mock_client)  # type: ignore[arg-type]

    err_text = str(excinfo.value)
    assert "traject_test" in err_text
    assert "unregistered auth key" in err_text
    assert "delete or rename 'traject_test.session'" in err_text


@pytest.mark.asyncio
async def test_ensure_authorized_authentication_failure():
    """4. Test that unexpected authentication errors are logged and propagated."""
    class FailingStartClient(MockAsyncTelegramClient):
        async def start(self, **kwargs):
            raise ValueError("Invalid phone code entered")

    mock_client = FailingStartClient([], is_authorized=False)
    creds = TelegramCredentials(api_id=123, api_hash="abcdef123456", session="test_sess")
    collector = TelegramCollector(credentials=creds, client=mock_client)  # type: ignore[arg-type]

    with pytest.raises(ValueError) as excinfo:
        await collector.ensure_authorized(mock_client)  # type: ignore[arg-type]
    assert "Invalid phone code entered" in str(excinfo.value)


@pytest.mark.asyncio
async def test_collect_channel_auth_key_unregistered_during_query():
    """5. Test AuthKeyUnregisteredError during channel resolution provides clean recovery."""
    from telethon.errors import AuthKeyUnregisteredError

    class UnregisteredQueryClient(MockAsyncTelegramClient):
        async def get_entity(self, channel: str) -> MockChat:
            raise AuthKeyUnregisteredError(request=None)

    mock_client = UnregisteredQueryClient([], is_authorized=True)
    creds = TelegramCredentials(api_id=123, api_hash="abcdef123456", session="traject_query_sess")
    collector = TelegramCollector(credentials=creds, client=mock_client)  # type: ignore[arg-type]

    with pytest.raises(RuntimeError) as excinfo:
        await collector.collect_channel("@any_channel", limit=5)

    assert "traject_query_sess" in str(excinfo.value)
    assert "delete or rename 'traject_query_sess.session'" in str(excinfo.value)

