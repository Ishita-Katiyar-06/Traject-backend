"""Temporal Engagement Observation Schema.

Defines the append-only engagement observation contract for recording repeated
measurements of social media messages over time (Milestone 7B).
"""

from datetime import datetime, timezone
import hashlib
from typing import Annotated, Any
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.canonical_message import CanonicalMessage, Platform


class EngagementObservation(BaseModel):
    """Immutable snapshot of a message's engagement state at a specific observation timestamp.
    
    Distinct from CanonicalMessage:
    - CanonicalMessage represents the static content and identity of a post.
    - EngagementObservation represents a point-in-time measurement of dynamic engagement metrics.
    - A single CanonicalMessage may have arbitrarily many EngagementObservations over time.
    """

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
        populate_by_name=True,
    )

    # 1. Observation Identity
    observation_id: str = Field(
        ...,
        description="Deterministic unique observation identifier (sha256 of canonical_id + observed_at_iso)."
    )
    canonical_id: str = Field(
        ...,
        description="Canonical identifier of the target message (e.g. 'telegram:100123456:789')."
    )
    platform: Platform = Field(
        default=Platform.TELEGRAM,
        description="Source platform enum."
    )
    native_id: str | None = Field(
        default=None,
        description="Platform-native message ID if available."
    )
    channel_id: str | None = Field(
        default=None,
        description="Platform-native channel or author identifier if available."
    )

    # 2. Observation Timing (Strictly UTC)
    observed_at: datetime = Field(
        ...,
        description="Timestamp when TRAJECT observed these engagement values (strictly UTC timezone-aware)."
    )

    # 3. Dynamic Engagement Metrics
    views_count: Annotated[int, Field(ge=0)] | None = Field(
        default=None,
        description="Total view impressions at observed_at (None if platform does not report views)."
    )
    forwards_count: Annotated[int, Field(ge=0)] | None = Field(
        default=None,
        description="Total forward / repost count at observed_at (None if platform does not report forwards)."
    )
    replies_count: Annotated[int, Field(ge=0)] | None = Field(
        default=None,
        description="Total direct replies count at observed_at (None if platform does not report replies)."
    )
    reactions: dict[str, Annotated[int, Field(ge=0)]] = Field(
        default_factory=dict,
        description="Detailed emoji -> count reaction mapping at observed_at (e.g. {'👍': 42, '🔥': 5})."
    )

    # 4. Provenance
    raw_reference: str | None = Field(
        default=None,
        description="Pointer to raw payload file/line where this observation was recorded."
    )

    @classmethod
    def build_observation_id(cls, canonical_id: str, observed_at: datetime) -> str:
        """Deterministically generate an observation ID from canonical_id and observed_at UTC string."""
        if observed_at.tzinfo is None:
            observed_at = observed_at.replace(tzinfo=timezone.utc)
        else:
            observed_at = observed_at.astimezone(timezone.utc)
        iso_ts = observed_at.isoformat()
        digest = hashlib.sha256(f"{canonical_id}|{iso_ts}".encode("utf-8")).hexdigest()[:24]
        return f"obs_{digest}"

    @field_validator("observed_at", mode="after")
    @classmethod
    def validate_utc_datetime(cls, v: datetime) -> datetime:
        """Enforce timezone awareness and normalize to UTC."""
        if v.tzinfo is None:
            raise ValueError("observed_at must be timezone-aware (expected UTC).")
        return v.astimezone(timezone.utc)

    @property
    def total_reactions(self) -> int:
        """Calculate total scalar sum across all reaction emoji counters."""
        return sum(self.reactions.values())

    @classmethod
    def from_canonical_message(
        cls,
        msg: CanonicalMessage,
        observed_at: datetime | None = None,
        raw_reference: str | None = None,
    ) -> "EngagementObservation":
        """Construct an EngagementObservation snapshot from a validated CanonicalMessage."""
        ts = observed_at or msg.collected_at
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        else:
            ts = ts.astimezone(timezone.utc)

        obs_id = cls.build_observation_id(msg.canonical_id, ts)
        return cls(
            observation_id=obs_id,
            canonical_id=msg.canonical_id,
            platform=msg.platform,
            native_id=msg.native_id,
            channel_id=msg.author_id,
            observed_at=ts,
            views_count=msg.views_count,
            forwards_count=msg.forwards_count,
            replies_count=msg.replies_count,
            reactions=dict(msg.reactions),
            raw_reference=raw_reference or msg.raw_reference,
        )

    @classmethod
    def from_raw_payload(
        cls,
        raw_payload: dict[str, Any],
        canonical_id: str,
        observed_at: datetime | None = None,
        platform: Platform = Platform.TELEGRAM,
        native_id: str | None = None,
        channel_id: str | None = None,
        raw_reference: str | None = None,
    ) -> "EngagementObservation":
        """Construct an EngagementObservation directly from a raw serialized Telegram payload."""
        if observed_at is None:
            raw_coll = raw_payload.get("collected_at")
            if raw_coll:
                if isinstance(raw_coll, str):
                    try:
                        observed_at = datetime.fromisoformat(raw_coll)
                    except Exception:
                        pass
                elif isinstance(raw_coll, (int, float)):
                    observed_at = datetime.fromtimestamp(raw_coll, tz=timezone.utc)
                elif isinstance(raw_coll, datetime):
                    observed_at = raw_coll
            if observed_at is None:
                observed_at = datetime.now(timezone.utc)

        if observed_at.tzinfo is None:
            observed_at = observed_at.replace(tzinfo=timezone.utc)
        else:
            observed_at = observed_at.astimezone(timezone.utc)

        # Extract views
        raw_views = raw_payload.get("views") or raw_payload.get("views_count")
        views_count = int(raw_views) if raw_views is not None else None

        # Extract forwards
        raw_forwards = raw_payload.get("forwards") or raw_payload.get("forwards_count")
        forwards_count = int(raw_forwards) if raw_forwards is not None else None

        # Extract replies
        raw_replies = raw_payload.get("replies")
        replies_count = None
        if isinstance(raw_replies, int):
            replies_count = raw_replies
        elif isinstance(raw_replies, dict):
            replies_count = raw_replies.get("replies") or raw_replies.get("count")

        # Extract reactions
        raw_reactions = raw_payload.get("reactions")
        reactions_map: dict[str, int] = {}
        if isinstance(raw_reactions, dict):
            for k, v in raw_reactions.items():
                if isinstance(v, int) and v >= 0:
                    reactions_map[str(k)] = v
        elif isinstance(raw_reactions, list):
            for item in raw_reactions:
                if isinstance(item, dict):
                    emoji = item.get("emoticon") or item.get("emoji")
                    cnt = item.get("count", 1)
                    if emoji and isinstance(cnt, int) and cnt >= 0:
                        reactions_map[str(emoji)] = cnt

        obs_id = cls.build_observation_id(canonical_id, observed_at)

        return cls(
            observation_id=obs_id,
            canonical_id=canonical_id,
            platform=platform,
            native_id=native_id,
            channel_id=channel_id,
            observed_at=observed_at,
            views_count=views_count,
            forwards_count=forwards_count,
            replies_count=replies_count,
            reactions=reactions_map,
            raw_reference=raw_reference or raw_payload.get("raw_reference"),
        )
