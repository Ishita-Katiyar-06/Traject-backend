from datetime import datetime, timezone
from enum import StrEnum
from typing import Annotated
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Platform(StrEnum):
    """Supported social media and messaging platforms."""
    TELEGRAM = "telegram"
    X = "x"


class AuthorType(StrEnum):
    """Classification of the author or publisher account.
    
    Controlled values:
    - CHANNEL: Broadcast channel or page (one-to-many publisher).
    - GROUP: Group, supergroup, or community discussion.
    - USER: Individual account, profile, or bot.
    - UNKNOWN: Fallback for anonymized, deleted, or privacy-restricted sources
      where the origin entity type cannot be reliably resolved.
    """
    CHANNEL = "channel"
    GROUP = "group"
    USER = "user"
    UNKNOWN = "unknown"


class CanonicalMessage(BaseModel):
    """Canonical normalized social media message entity.
    
    Acts as the single unified data contract for all downstream TRAJECT
    processing (ML inference, narrative genesis, cascade analysis, storage, API).
    """

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
        populate_by_name=True,
    )

    # 1. Identity
    canonical_id: str = Field(
        ...,
        description="Globally unique canonical identifier, structured as '{platform}:{native_id}'."
    )
    platform: Platform = Field(
        ...,
        description="Originating platform (validated enum)."
    )
    native_id: str = Field(
        ...,
        description="Platform-native message, post, or status identifier."
    )

    # 2. Author / Source
    author_id: str = Field(
        ...,
        description="Platform-native identifier of the author or publisher channel/account."
    )
    author_username: str | None = Field(
        default=None,
        description="Username or handle of the author (e.g. '@channel' or 'handle')."
    )
    author_type: AuthorType = Field(
        default=AuthorType.USER,
        description="Author entity classification (channel, group, user, unknown)."
    )
    channel_title: str | None = Field(
        default=None,
        description="Human-readable title of the channel or group if applicable."
    )
    subscriber_count: Annotated[int, Field(ge=0)] | None = Field(
        default=None,
        description="Follower or subscriber count of the source entity at collection time."
    )

    # 3. Temporal (strictly timezone-aware UTC)
    published_at: datetime = Field(
        ...,
        description="Original publication timestamp (must be timezone-aware UTC)."
    )
    collected_at: datetime = Field(
        ...,
        description="Timestamp when the message was ingested by TRAJECT (must be timezone-aware UTC)."
    )

    # 4. Content
    text_content: str = Field(
        default="",
        description="Primary textual content or media caption (cleaned UTF-8)."
    )
    language: str | None = Field(
        default=None,
        description="Detected or platform-reported ISO language code (e.g. 'en', 'hi')."
    )
    media_types: list[str] = Field(
        default_factory=list,
        description="List of attached media types (e.g. ['photo'], ['video'], ['document'])."
    )
    has_media: bool = Field(
        default=False,
        description="Flag indicating presence of any media attachment."
    )

    # 5. Repost / Forward / Thread Information
    is_forward: bool = Field(
        default=False,
        description="True if message was forwarded from another channel or user."
    )
    is_repost: bool = Field(
        default=False,
        description="True if message is a native platform repost or retweet."
    )
    origin_source_id: str | None = Field(
        default=None,
        description="Identifier of the original source message if forwarded or reposted."
    )
    reply_to_id: str | None = Field(
        default=None,
        description="Platform native identifier of the parent message if this is a reply."
    )
    thread_id: str | None = Field(
        default=None,
        description="Thread, conversation, or topic identifier."
    )

    # 6. Engagement
    views_count: Annotated[int, Field(ge=0)] | None = Field(
        default=None,
        description="Total view impressions reported by the platform."
    )
    forwards_count: Annotated[int, Field(ge=0)] | None = Field(
        default=None,
        description="Total forward, repost, or share count."
    )
    replies_count: Annotated[int, Field(ge=0)] | None = Field(
        default=None,
        description="Total direct replies or comments count."
    )
    reactions: dict[str, Annotated[int, Field(ge=0)]] = Field(
        default_factory=dict,
        description="Mapping of reaction emoji/key to count (e.g. {'👍': 42, '🔥': 12})."
    )

    # 7. Extracted Entities
    urls: list[str] = Field(
        default_factory=list,
        description="List of extracted URLs from the message body."
    )
    hashtags: list[str] = Field(
        default_factory=list,
        description="List of extracted hashtags (e.g. ['#OSINT', '#Alert'])."
    )
    mentions: list[str] = Field(
        default_factory=list,
        description="List of extracted user/channel mentions (e.g. ['@user'])."
    )

    # 8. Traceability
    raw_reference: str | None = Field(
        default=None,
        description="Pointer, URI, or hash of the raw immutable payload (e.g. 'raw/telegram/2026-09-03/batch_01.jsonl:line_42')."
    )

    @classmethod
    def build_canonical_id(
        cls,
        platform: Platform | str,
        native_id: str,
        chat_id: str | None = None,
    ) -> str:
        """Deterministically generate a stable canonical ID.
        
        For Telegram: 'telegram:{chat_id}:{native_id}'
        For X: 'x:{native_id}'
        """
        platform_str = platform.value if isinstance(platform, Platform) else str(platform).lower()
        if platform_str == Platform.TELEGRAM.value:
            if chat_id:
                chat_id_str = str(chat_id).strip()
                if native_id.startswith(f"{chat_id_str}:"):
                    return f"{platform_str}:{native_id}"
                return f"{platform_str}:{chat_id_str}:{native_id}"
            if ":" in native_id:
                return f"{platform_str}:{native_id}"
            return f"{platform_str}:{native_id}"
        return f"{platform_str}:{native_id}"

    @field_validator("published_at", "collected_at", mode="after")
    @classmethod
    def validate_and_normalize_utc(cls, v: datetime) -> datetime:
        """Enforce timezone-awareness and normalize to UTC."""
        if v.tzinfo is None:
            raise ValueError("Datetime must be timezone-aware (expected UTC).")
        return v.astimezone(timezone.utc)

    @model_validator(mode="after")
    def validate_canonical_id_and_media(self) -> "CanonicalMessage":
        """Ensure canonical_id follows standard convention and has_media matches media_types."""
        expected_platform_prefix = f"{self.platform.value}:"
        if not self.canonical_id.startswith(expected_platform_prefix):
            raise ValueError(
                f"canonical_id mismatch: expected prefix '{expected_platform_prefix}', got '{self.canonical_id}'."
            )

        if self.platform == Platform.TELEGRAM:
            expected_scoped_id = self.build_canonical_id(self.platform, self.native_id, self.author_id)
            expected_unscoped_id = self.build_canonical_id(self.platform, self.native_id)
            if self.canonical_id not in (expected_scoped_id, expected_unscoped_id):
                raise ValueError(
                    f"canonical_id mismatch for Telegram: expected '{expected_scoped_id}' (or '{expected_unscoped_id}'), got '{self.canonical_id}'."
                )
        else:
            expected_id = self.build_canonical_id(self.platform, self.native_id)
            if self.canonical_id != expected_id:
                raise ValueError(
                    f"canonical_id mismatch: expected '{expected_id}', got '{self.canonical_id}'."
                )

        # Consistent media flag check
        if self.media_types and not self.has_media:
            self.has_media = True
        return self

