"""Per-source Telegram collection checkpoint management with atomic writes and failure isolation.

Checkpoints track the latest successfully ingested and persisted message per Telegram channel,
using native monotonic Telegram message IDs.
"""

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
from typing import Any

from app.core.config import find_repo_root

logger = logging.getLogger("traject.collectors.telegram.checkpoint")


@dataclass
class SourceCheckpoint:
    """State cursor tracking historical progress for a single Telegram source."""
    last_message_id: int
    last_message_date: str | None = None
    last_collected_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    total_messages_collected: int = 0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "SourceCheckpoint":
        if "last_message_id" not in data:
            raise ValueError("Checkpoint data missing required 'last_message_id'")
        return cls(
            last_message_id=int(data["last_message_id"]),
            last_message_date=data.get("last_message_date"),
            last_collected_at=data.get(
                "last_collected_at", datetime.now(timezone.utc).isoformat()
            ),
            total_messages_collected=int(data.get("total_messages_collected", 0)),
        )


@dataclass
class TelegramCheckpointState:
    """Top-level checkpoint state storing cursors across all configured Telegram sources."""
    schema_version: int = 1
    updated_at_utc: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    sources: dict[str, SourceCheckpoint] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "updated_at_utc": self.updated_at_utc,
            "sources": {k: v.to_dict() for k, v in self.sources.items()},
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "TelegramCheckpointState":
        schema_version = int(data.get("schema_version", 1))
        updated_at = data.get(
            "updated_at_utc", datetime.now(timezone.utc).isoformat()
        )
        raw_sources = data.get("sources", {})
        sources: dict[str, SourceCheckpoint] = {}
        for src_name, src_data in raw_sources.items():
            sources[src_name] = SourceCheckpoint.from_dict(src_data)

        return cls(
            schema_version=schema_version,
            updated_at_utc=updated_at,
            sources=sources,
        )


class TelegramCheckpointManager:
    """Manages reading, updating, and atomically persisting Telegram checkpoints.
    
    Guarantees:
    - Dedicated checkpoint directory in data/checkpoints/telegram/ (never backend/config/).
    - Atomic write via temporary file replace to prevent half-written corruption.
    - Corrupt checkpoint recovery with automated backup preservation.
    - Strict per-source isolation: updating Source A does not affect Source B.
    - Never silently clears checkpoints when collection fails.
    """

    def __init__(self, checkpoint_path: Path | str | None = None):
        if checkpoint_path is not None:
            self.checkpoint_path = Path(checkpoint_path).resolve()
        else:
            repo_root = find_repo_root()
            self.checkpoint_path = (
                repo_root / "data" / "checkpoints" / "telegram" / "checkpoint.json"
            ).resolve()

        self.checkpoint_dir = self.checkpoint_path.parent
        self._state: TelegramCheckpointState = self._load()

    @property
    def state(self) -> TelegramCheckpointState:
        return self._state

    def _normalize_key(self, source: str) -> str:
        """Standardize source key with leading '@' in lowercase."""
        clean = source.strip().lstrip("@").lower()
        return f"@{clean}"

    def _load(self) -> TelegramCheckpointState:
        """Load checkpoint from disk. If missing, returns fresh state. If corrupt, backs up and resets."""
        if not self.checkpoint_path.is_file():
            logger.info(
                "Checkpoint file does not exist at %s; initializing empty checkpoint state.",
                self.checkpoint_path,
            )
            return TelegramCheckpointState()

        try:
            with open(self.checkpoint_path, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if not content:
                    logger.warning("Checkpoint file %s is empty; initializing fresh state.", self.checkpoint_path)
                    return TelegramCheckpointState()
                raw_data = json.loads(content)

            return TelegramCheckpointState.from_dict(raw_data)
        except Exception as e:
            corrupt_backup = self.checkpoint_path.with_suffix(
                f".corrupt_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.bak"
            )
            logger.error(
                "Checkpoint file %s is corrupt (%s). Backing up to %s and starting with clean state.",
                self.checkpoint_path,
                e,
                corrupt_backup,
            )
            try:
                import shutil
                shutil.copy2(self.checkpoint_path, corrupt_backup)
            except Exception as copy_err:
                logger.warning("Could not backup corrupt checkpoint: %s", copy_err)

            return TelegramCheckpointState()

    def get_source_checkpoint(self, source: str) -> SourceCheckpoint | None:
        """Retrieve the checkpoint for a specific Telegram source if one exists."""
        key = self._normalize_key(source)
        return self._state.sources.get(key)

    def get_last_message_id(self, source: str) -> int | None:
        """Retrieve the last processed message ID for a source, or None if never collected."""
        ckpt = self.get_source_checkpoint(source)
        return ckpt.last_message_id if ckpt else None

    def update_source_checkpoint(
        self,
        source: str,
        last_message_id: int,
        last_message_date: str | None = None,
        messages_added: int = 0,
        commit: bool = True,
    ) -> SourceCheckpoint:
        """Update cursor for a single source.
        
        Guarantees that cursors are monotonic (cannot move backwards unless explicitly reset).
        """
        key = self._normalize_key(source)
        existing = self._state.sources.get(key)

        now_utc = datetime.now(timezone.utc).isoformat()
        if existing:
            new_last_id = max(existing.last_message_id, last_message_id)
            new_total = existing.total_messages_collected + max(0, messages_added)
            new_date = last_message_date or existing.last_message_date
            updated = SourceCheckpoint(
                last_message_id=new_last_id,
                last_message_date=new_date,
                last_collected_at=now_utc,
                total_messages_collected=new_total,
            )
        else:
            updated = SourceCheckpoint(
                last_message_id=last_message_id,
                last_message_date=last_message_date,
                last_collected_at=now_utc,
                total_messages_collected=max(0, messages_added),
            )

        self._state.sources[key] = updated
        self._state.updated_at_utc = now_utc

        if commit:
            self.save()

        return updated

    def save(self) -> Path:
        """Atomically persist checkpoint state to disk using a temporary file rename."""
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)
        temp_path = self.checkpoint_path.with_suffix(".tmp")

        try:
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(self._state.to_dict(), f, indent=2, ensure_ascii=False)
                f.flush()
                os.fsync(f.fileno())

            # Atomic replace
            os.replace(temp_path, self.checkpoint_path)
            logger.info("Successfully persisted checkpoint to %s", self.checkpoint_path)
            return self.checkpoint_path
        except Exception as e:
            logger.error("Failed to write checkpoint atomically: %s", e)
            if temp_path.exists():
                try:
                    temp_path.unlink()
                except OSError:
                    pass
            raise
