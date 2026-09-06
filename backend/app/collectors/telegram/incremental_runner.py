"""Incremental Telegram collection runner with per-source checkpointing, failure isolation,
append-safe persistence, and reproducibility manifests.
"""

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
from typing import Any, Sequence

from app.collectors.telegram.checkpoint import TelegramCheckpointManager
from app.collectors.telegram.collector import CollectionResult, TelegramCollector, parse_telegram_sources
from app.collectors.telegram.registry import TelegramSourceRegistry, load_telegram_source_registry
from app.core.config import find_repo_root
from app.quality.validation import process_quality
from app.schemas.canonical_message import CanonicalMessage
from app.storage.parquet import append_canonical_messages, read_canonical_messages

logger = logging.getLogger("traject.collectors.telegram.incremental_runner")


@dataclass
class IncrementalRunConfig:
    """Runtime configuration for an incremental Telegram collection execution."""
    per_source_limit: int = 100
    sources: list[str] | None = None
    dry_run: bool = False
    dataset_name: str = "telegram_messages"
    run_quality: bool = True

    @classmethod
    def from_file_or_default(
        cls, config_path: Path | str | None = None
    ) -> "IncrementalRunConfig":
        """Load settings from telegram_collection.json with safe defaults."""
        repo_root = find_repo_root()
        target = Path(config_path) if config_path else repo_root / "backend" / "config" / "telegram_collection.json"
        
        limit = 100
        dataset_name = "telegram_messages"
        if target.is_file():
            try:
                with open(target, "r", encoding="utf-8") as f:
                    data = json.load(f)
                limit = int(data.get("incremental_limit", data.get("per_source_limit", 100)))
                dataset_name = str(data.get("dataset_name", "telegram_messages"))
            except Exception as e:
                logger.warning("Failed parsing collection config %s: %s; using defaults", target, e)

        return cls(per_source_limit=limit, dataset_name=dataset_name)


@dataclass
class IncrementalRunManifest:
    """Audit and reproducibility record produced for each incremental collection execution."""
    run_id: str
    started_at_utc: str
    completed_at_utc: str
    mode: str = "incremental"
    configuration: dict[str, Any] = field(default_factory=dict)
    sources_attempted: int = 0
    sources_succeeded: int = 0
    sources_failed: int = 0
    failed_sources: dict[str, str] = field(default_factory=dict)
    per_source_metrics: dict[str, dict[str, Any]] = field(default_factory=dict)
    total_raw_fetched: int = 0
    total_canonical_normalized: int = 0
    total_new_canonical_persisted: int = 0
    total_duplicates_discarded: int = 0
    cumulative_corpus_count: int = 0
    first_message_timestamp: str | None = None
    latest_message_timestamp: str | None = None
    corpus_snapshot_id: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def save_json(self, output_path: Path | str) -> Path:
        p = Path(output_path).resolve()
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2, ensure_ascii=False)
        logger.info("Saved incremental run manifest to %s", p)
        return p


class TelegramIncrementalRunner:
    """Executes safe incremental collection across Telegram sources using checkpoints."""

    def __init__(
        self,
        config: IncrementalRunConfig | None = None,
        checkpoint_manager: TelegramCheckpointManager | None = None,
        registry: TelegramSourceRegistry | None = None,
        collector: TelegramCollector | None = None,
        repo_root: Path | None = None,
    ):
        self.repo_root = repo_root or find_repo_root()
        self.config = config or IncrementalRunConfig.from_file_or_default()
        self.checkpoint_manager = checkpoint_manager or TelegramCheckpointManager(
            self.repo_root / "data" / "checkpoints" / "telegram" / "checkpoint.json"
        )
        self.registry = registry or load_telegram_source_registry()
        self.collector = collector or TelegramCollector(
            raw_storage_dir=self.repo_root / "data" / "raw" / "telegram" / "incremental"
        )

    def _resolve_sources(self) -> list[str]:
        """Resolve ordered list of channel usernames to collect."""
        if self.config.sources:
            return parse_telegram_sources(self.config.sources)

        env_sources = os.getenv("TELEGRAM_SOURCES")
        if env_sources and env_sources.strip():
            return parse_telegram_sources(env_sources)

        return parse_telegram_sources(self.registry.get_enabled_usernames())

    async def run(self) -> IncrementalRunManifest:
        """Execute incremental collection run across resolved sources with strict failure isolation."""
        started_at = datetime.now(timezone.utc)
        timestamp_slug = started_at.strftime("%Y%m%d_%H%M%S")
        run_id = f"incremental_{timestamp_slug}"

        target_sources = self._resolve_sources()
        if not target_sources:
            raise ValueError("No Telegram sources configured for incremental collection.")

        logger.info(
            "Starting Telegram incremental run '%s' across %d source(s) (limit per source: %d).",
            run_id,
            len(target_sources),
            self.config.per_source_limit,
        )

        sources_succeeded = 0
        sources_failed = 0
        failed_sources: dict[str, str] = {}
        per_source_metrics: dict[str, dict[str, Any]] = {}
        
        all_new_raw = 0
        all_new_normalized = 0
        all_new_persisted = 0
        all_duplicates = 0

        parquet_path = (
            self.repo_root
            / "data"
            / "processed"
            / "telegram"
            / f"{self.config.dataset_name}.parquet"
        )

        # Process each source in sequential isolation
        for source in target_sources:
            source_key = f"@{source.lstrip('@').lower()}"
            prev_ckpt = self.checkpoint_manager.get_source_checkpoint(source)
            prev_last_id = prev_ckpt.last_message_id if prev_ckpt else None

            logger.info(
                "Source '%s': previous cursor is message_id=%s",
                source,
                prev_last_id,
            )

            try:
                # 1. Fetch only messages newer than checkpoint
                res: CollectionResult = await self.collector.collect_channel(
                    channel=source,
                    limit=self.config.per_source_limit,
                    min_id=prev_last_id,
                )

                raw_count = res.raw_messages_count
                norm_count = res.canonical_messages_count
                all_new_raw += raw_count
                all_new_normalized += norm_count

                # 2. Quality validation and deduplication
                new_clean: list[CanonicalMessage] = []
                dups_detected = 0
                if res.canonical_messages:
                    if self.config.run_quality:
                        clean_msgs, quality_rep = process_quality(
                            res.canonical_messages,
                            dataset_platform="telegram",
                            metadata={"incremental_run_id": run_id},
                        )
                        new_clean = clean_msgs
                        dups_detected = quality_rep.duplicates_detected
                    else:
                        new_clean = res.canonical_messages

                all_duplicates += dups_detected

                # 3. Append-safe Parquet persistence
                persisted_count = 0
                cumulative_count = 0
                if not self.config.dry_run and new_clean:
                    persisted_count, cumulative_count = append_canonical_messages(
                        parquet_path,
                        new_clean,
                        metadata={"incremental_run_id": run_id},
                    )
                all_new_persisted += persisted_count

                # 4. Advance checkpoint ONLY upon success
                if not self.config.dry_run:
                    if res.max_message_id is not None and res.max_message_id > (prev_last_id or 0):
                        new_ckpt = self.checkpoint_manager.update_source_checkpoint(
                            source=source,
                            last_message_id=res.max_message_id,
                            last_message_date=res.latest_message_date,
                            messages_added=persisted_count,
                            commit=True,
                        )
                        curr_last_id = new_ckpt.last_message_id
                    elif prev_last_id is not None:
                        # Success with 0 new messages: update last_collected_at without altering cursor
                        new_ckpt = self.checkpoint_manager.update_source_checkpoint(
                            source=source,
                            last_message_id=prev_last_id,
                            messages_added=0,
                            commit=True,
                        )
                        curr_last_id = new_ckpt.last_message_id
                    else:
                        curr_last_id = None
                else:
                    curr_last_id = res.max_message_id or prev_last_id

                sources_succeeded += 1
                per_source_metrics[source_key] = {
                    "status": "SUCCESS",
                    "previous_checkpoint_id": prev_last_id,
                    "resulting_checkpoint_id": curr_last_id,
                    "raw_fetched": raw_count,
                    "canonical_normalized": norm_count,
                    "duplicates_detected": dups_detected,
                    "new_persisted": persisted_count,
                    "error": None,
                }

            except Exception as e:
                err_msg = f"{type(e).__name__}: {str(e)}"
                logger.error(
                    "Source '%s' failed during incremental run (%s). Checkpoint remains intact at %s.",
                    source,
                    err_msg,
                    prev_last_id,
                )
                sources_failed += 1
                failed_sources[source_key] = err_msg
                per_source_metrics[source_key] = {
                    "status": "FAILED",
                    "previous_checkpoint_id": prev_last_id,
                    "resulting_checkpoint_id": prev_last_id,  # Unchanged!
                    "raw_fetched": 0,
                    "canonical_normalized": 0,
                    "duplicates_detected": 0,
                    "new_persisted": 0,
                    "error": err_msg,
                }
                # Continue loop to guarantee per-source failure isolation

        # Read overall corpus statistics if Parquet file exists
        first_ts: str | None = None
        latest_ts: str | None = None
        final_corpus_count = 0
        if parquet_path.is_file():
            try:
                corpus_messages = read_canonical_messages(parquet_path)
                final_corpus_count = len(corpus_messages)
                dates = [m.published_at for m in corpus_messages if m.published_at]
                if dates:
                    first_ts = min(dates).isoformat()
                    latest_ts = max(dates).isoformat()
            except Exception as e:
                logger.warning("Could not calculate temporal metrics from %s: %s", parquet_path, e)

        completed_at = datetime.now(timezone.utc)
        corpus_snapshot_id = f"corpus_snapshot_{timestamp_slug}"

        manifest = IncrementalRunManifest(
            run_id=run_id,
            started_at_utc=started_at.isoformat(),
            completed_at_utc=completed_at.isoformat(),
            mode="incremental",
            configuration=asdict(self.config),
            sources_attempted=len(target_sources),
            sources_succeeded=sources_succeeded,
            sources_failed=sources_failed,
            failed_sources=failed_sources,
            per_source_metrics=per_source_metrics,
            total_raw_fetched=all_new_raw,
            total_canonical_normalized=all_new_normalized,
            total_new_canonical_persisted=all_new_persisted,
            total_duplicates_discarded=all_duplicates,
            cumulative_corpus_count=final_corpus_count,
            first_message_timestamp=first_ts,
            latest_message_timestamp=latest_ts,
            corpus_snapshot_id=corpus_snapshot_id,
        )

        manifest_dir = self.repo_root / "data" / "manifests" / "telegram" / "incremental"
        manifest_file = manifest_dir / f"manifest_{run_id}.json"
        manifest.save_json(manifest_file)

        # Also save latest pointer for API and UI
        latest_pointer = manifest_dir / "latest_manifest.json"
        manifest.save_json(latest_pointer)

        return manifest
