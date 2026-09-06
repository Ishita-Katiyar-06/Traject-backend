"""Persistent storage for temporal narrative lineages and lifecycle events.

Maintains:
- data/temporal/lineage/lineage_state.json (atomic state file)
- data/temporal/lineage/lineage_events.jsonl (append-only idempotent event stream)
"""

from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
from typing import Sequence

from app.core.config import find_repo_root
from app.temporal.models import LineageEvent, NarrativeLineage

logger = logging.getLogger("traject.temporal.store")


class TemporalLineageStore:
    """Manages transactional loading and atomic persistence of narrative lineages and events."""

    def __init__(self, storage_dir: Path | str | None = None):
        if storage_dir is not None:
            self.storage_dir = Path(storage_dir).resolve()
        else:
            repo_root = find_repo_root()
            self.storage_dir = (repo_root / "data" / "temporal" / "lineage").resolve()

        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.state_file = self.storage_dir / "lineage_state.json"
        self.events_file = self.storage_dir / "lineage_events.jsonl"

        self._lineages: dict[str, NarrativeLineage] = {}
        self._event_ids: set[str] = set()
        self._next_lineage_index: int = 1

        self._load()

    @property
    def lineages(self) -> dict[str, NarrativeLineage]:
        return self._lineages

    def _load(self) -> None:
        """Load state and event indices from disk."""
        # 1. Load Lineage State
        if self.state_file.is_file():
            try:
                with open(self.state_file, "r", encoding="utf-8") as f:
                    content = f.read().strip()
                    if content:
                        raw_data = json.loads(content)
                        for lid, l_dict in raw_data.get("lineages", {}).items():
                            lineage = NarrativeLineage.model_validate(l_dict)
                            self._lineages[lid] = lineage
                            # Track highest index for ID generator
                            if lid.startswith("lineage_"):
                                try:
                                    idx = int(lid.split("_")[1])
                                    if idx >= self._next_lineage_index:
                                        self._next_lineage_index = idx + 1
                                except ValueError:
                                    pass
                logger.info("Loaded %d lineages from %s", len(self._lineages), self.state_file)
            except Exception as e:
                logger.error("Failed loading lineage state from %s: %s", self.state_file, e)

        # 2. Load Event IDs to guarantee idempotency
        if self.events_file.is_file():
            try:
                with open(self.events_file, "r", encoding="utf-8") as f:
                    for line in f:
                        line_str = line.strip()
                        if line_str:
                            try:
                                ev = json.loads(line_str)
                                if "event_id" in ev:
                                    self._event_ids.add(ev["event_id"])
                            except json.JSONDecodeError:
                                pass
                logger.info("Loaded %d event IDs for idempotency check", len(self._event_ids))
            except Exception as e:
                logger.warning("Could not read events file %s: %s", self.events_file, e)

    def allocate_lineage_id(self) -> str:
        """Allocate a deterministic, monotonically increasing lineage ID."""
        lid = f"lineage_{self._next_lineage_index:06d}"
        self._next_lineage_index += 1
        return lid

    def get_lineage(self, lineage_id: str) -> NarrativeLineage | None:
        """Retrieve lineage by canonical lineage ID."""
        return self._lineages.get(lineage_id)

    def get_lineage_for_snapshot_narrative(
        self, snapshot_id: str, narrative_id: str
    ) -> NarrativeLineage | None:
        """Find lineage associated with a specific narrative ID in a given snapshot."""
        for l in self._lineages.values():
            if l.snapshot_history.get(snapshot_id) == narrative_id:
                return l
            if l.last_snapshot_id == snapshot_id and l.current_narrative_id == narrative_id:
                return l
            if l.first_snapshot_id == snapshot_id and l.historical_narrative_ids and l.historical_narrative_ids[0] == narrative_id:
                return l
        return None

    def get_lineage_by_narrative_id(
        self, narrative_id: str, snapshot_id: str | None = None
    ) -> NarrativeLineage | None:
        """Find lineage associated with a snapshot-local narrative ID."""
        if snapshot_id is not None:
            return self.get_lineage_for_snapshot_narrative(snapshot_id, narrative_id)
        for l in self._lineages.values():
            if l.current_narrative_id == narrative_id:
                return l
            if narrative_id in l.historical_narrative_ids:
                return l
        return None

    def upsert_lineage(self, lineage: NarrativeLineage) -> None:
        """Update or insert a lineage in memory."""
        self._lineages[lineage.lineage_id] = lineage

    def record_events(self, events: Sequence[LineageEvent]) -> int:
        """Append new lifecycle events idempotently to lineage_events.jsonl.
        
        Returns count of genuinely new events written.
        """
        if not events:
            return 0

        new_events: list[LineageEvent] = []
        for ev in events:
            if ev.event_id not in self._event_ids:
                new_events.append(ev)
                self._event_ids.add(ev.event_id)

        if not new_events:
            return 0

        with open(self.events_file, "a", encoding="utf-8") as f:
            for ev in new_events:
                f.write(json.dumps(ev.model_dump(mode="json"), ensure_ascii=False) + "\n")

        return len(new_events)

    def get_events_for_lineage(self, lineage_id: str) -> list[LineageEvent]:
        """Read all historical events for a specific lineage."""
        events: list[LineageEvent] = []
        if not self.events_file.is_file():
            return events

        with open(self.events_file, "r", encoding="utf-8") as f:
            for line in f:
                line_str = line.strip()
                if line_str:
                    try:
                        data = json.loads(line_str)
                        if data.get("lineage_id") == lineage_id:
                            events.append(LineageEvent.model_validate(data))
                    except Exception as e:
                        logger.warning("Failed parsing lineage event: %s", e)

        return sorted(events, key=lambda e: e.timestamp)

    def save_state(self) -> Path:
        """Atomically persist lineage state to disk."""
        temp_file = self.state_file.with_suffix(".tmp")
        payload = {
            "schema_version": 1,
            "updated_at_utc": datetime.now(timezone.utc).isoformat(),
            "total_lineages_tracked": len(self._lineages),
            "lineages": {lid: l.model_dump(mode="json") for lid, l in self._lineages.items()},
        }

        try:
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2, ensure_ascii=False)
                f.flush()
                os.fsync(f.fileno())

            os.replace(temp_file, self.state_file)
            logger.info("Successfully persisted lineage state (%d lineages) to %s", len(self._lineages), self.state_file)
            return self.state_file
        except Exception as e:
            logger.error("Failed writing lineage state atomically: %s", e)
            if temp_file.exists():
                try:
                    temp_file.unlink()
                except OSError:
                    pass
            raise
