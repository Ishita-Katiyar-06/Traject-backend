import argparse
import asyncio
from collections import Counter
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
from typing import Any, Sequence

from app.collectors.telegram.collector import MultiCollectionResult, TelegramCollector
from app.collectors.telegram.registry import TelegramSourceRegistry, load_telegram_source_registry
from app.core.config import find_repo_root
from app.ml.dataset import prepare_language_aware_records
from app.ml.pipeline.orchestrator import MLPipelineResult, run_ml_pipeline
from app.quality.validation import QualityReport, process_quality
from app.replay.telegram_jsonl import TelegramJSONLReplayer
from app.schemas.canonical_message import CanonicalMessage
from app.storage.parquet import write_canonical_messages

logger = logging.getLogger("traject.collectors.telegram.corpus_builder")


@dataclass
class TelegramCorpusConfig:
    """Configuration governing bounded Telegram corpus collection and processing."""
    per_source_limit: int = 500
    max_sources: int = 13
    dataset_name: str = "telegram_messages"

    @classmethod
    def from_file_or_default(
        cls, config_path: Path | str | None = None
    ) -> "TelegramCorpusConfig":
        """Load collection configuration from backend/config/telegram_collection.json with safe defaults."""
        if config_path is not None:
            target = Path(config_path).resolve()
        else:
            repo_root = find_repo_root()
            target = repo_root / "backend" / "config" / "telegram_collection.json"

        if target.is_file():
            try:
                with open(target, "r", encoding="utf-8") as f:
                    data = json.load(f)
                limit = int(data.get("per_source_limit", 500))
                if limit <= 0:
                    raise ValueError(f"per_source_limit must be positive, got {limit}")
                return cls(
                    per_source_limit=limit,
                    max_sources=int(data.get("max_sources", 13)),
                    dataset_name=str(data.get("dataset_name", "telegram_messages")),
                )
            except Exception as e:
                logger.warning("Failed parsing collection config from %s: %s; using defaults", target, e)

        return cls()


@dataclass
class SourceDistributionRow:
    """Per-source accounting of raw, valid, and deduplicated records."""
    username: str
    domain: str
    source_type: str
    raw_records: int
    valid_records: int
    duplicates: int
    final_records: int
    status: str
    error: str | None = None


@dataclass
class CrossSourceNarrativeSummary:
    """Summary of cross-channel narrative representation."""
    narrative_id: str
    message_count: int
    distinct_sources_count: int
    distinct_sources: list[str]
    domains_represented: list[str]
    first_observed_utc: str
    last_observed_utc: str
    priority_signal_score: float
    spread_score: float
    coordination_score: float
    reach_score: float
    friction_score: float


@dataclass
class CorpusManifest:
    """Reproducible snapshot metadata describing a collected and processed Telegram corpus."""
    manifest_id: str
    generated_at_utc: str
    registry_version: str
    collection_config: dict[str, Any]
    sources_requested: int
    sources_attempted: int
    sources_successful: int
    sources_failed: int
    failed_sources: dict[str, str]
    total_raw_records: int
    total_normalized_records: int
    total_duplicates_detected: int
    total_final_records: int
    dataset_output_path: str
    quality_report_path: str
    analytics_artifact_path: str | None
    source_distribution: list[dict[str, Any]]
    domain_distribution: dict[str, int]
    language_distribution: dict[str, int]
    media_text_distribution: dict[str, int]
    narratives_summary: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def save_json(self, output_path: Path | str, indent: int = 2) -> Path:
        p = Path(output_path).resolve()
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=indent, ensure_ascii=False)
        logger.info("Saved corpus manifest to %s", p)
        return p


class TelegramCorpusBuilder:
    """Orchestrator for bounded multi-source Telegram collection, quality auditing, and 4A-4H execution."""

    def __init__(
        self,
        config: TelegramCorpusConfig | None = None,
        registry: TelegramSourceRegistry | None = None,
        collector: TelegramCollector | None = None,
        repo_root: Path | None = None,
    ):
        self.repo_root = repo_root or find_repo_root()
        self.config = config or TelegramCorpusConfig.from_file_or_default()
        self.registry = registry or load_telegram_source_registry()
        self.collector = collector or TelegramCollector(
            raw_storage_dir=self.repo_root / "data" / "raw" / "telegram"
        )

    def compute_distributions(
        self,
        messages: Sequence[CanonicalMessage],
        quality_report: QualityReport,
        multi_collection_res: MultiCollectionResult | None = None,
    ) -> tuple[list[SourceDistributionRow], dict[str, int], dict[str, int], dict[str, int]]:
        """Compute source, domain, 4B language, and media/text distributions."""
        # 1. Source distribution
        source_rows: list[SourceDistributionRow] = []
        enabled_sources = self.registry.get_enabled_sources()

        # Build lookup of final messages per username
        msg_counts_per_source: Counter[str] = Counter()
        for msg in messages:
            author_key = (msg.author_username or "").strip().lstrip("@").lower()
            if author_key:
                msg_counts_per_source[author_key] += 1

        for src in enabled_sources:
            clean_user = src.username.strip().lstrip("@").lower()
            final_count = msg_counts_per_source.get(clean_user, 0)
            
            # Lookup collection result if available
            raw_count = 0
            err: str | None = None
            status = "SUCCESS"

            if multi_collection_res:
                # Find matching result in channel_results
                for ch_name, ch_res in multi_collection_res.channel_results.items():
                    if ch_name.strip().lstrip("@").lower() == clean_user:
                        raw_count = ch_res.raw_messages_count
                        if ch_res.errors:
                            err = "; ".join(ch_res.errors)
                        break
                if src.username in multi_collection_res.failed_channel_errors:
                    err = multi_collection_res.failed_channel_errors[src.username]
                    status = "FAILED"
                elif raw_count == 0 and not err:
                    status = "EMPTY"
            else:
                raw_count = final_count

            # Duplicates are estimated at source level as raw - final (bounded by 0)
            dups = max(0, raw_count - final_count)

            source_rows.append(
                SourceDistributionRow(
                    username=src.username,
                    domain=src.domain,
                    source_type=src.source_type.value,
                    raw_records=raw_count,
                    valid_records=final_count + dups,
                    duplicates=dups,
                    final_records=final_count,
                    status=status,
                    error=err,
                )
            )

        # 2. Domain distribution
        domain_counts: Counter[str] = Counter()
        for row in source_rows:
            domain_counts[row.domain] += row.final_records
        domain_distribution = dict(domain_counts)

        # 3. Language distribution (evaluated via 4B language detection on text records)
        lang_counts: Counter[str] = Counter()
        try:
            lang_records = prepare_language_aware_records(messages)
            for lr in lang_records:
                lang_counts[lr.detected_language] += 1
        except Exception as e:
            logger.warning("Language detection failed during distribution calculation: %s", e)
            for msg in messages:
                lang = msg.language or "unknown"
                lang_counts[lang] += 1
        language_distribution = dict(lang_counts)

        # 4. Text vs Media distribution
        text_bearing = sum(1 for m in messages if m.text_content and m.text_content.strip())
        media_only = sum(
            1 for m in messages if (not m.text_content or not m.text_content.strip()) and m.has_media
        )
        empty_records = len(messages) - text_bearing - media_only
        media_text_distribution = {
            "text_bearing": text_bearing,
            "media_only": media_only,
            "empty_records": empty_records,
            "total_final": len(messages),
        }

        return source_rows, domain_distribution, language_distribution, media_text_distribution

    def evaluate_narratives(
        self,
        ml_result: MLPipelineResult,
        messages: Sequence[CanonicalMessage],
    ) -> list[CrossSourceNarrativeSummary]:
        """Assess cross-channel presence and source representation across discovered narratives."""
        summaries: list[CrossSourceNarrativeSummary] = []
        messages_by_id = {m.canonical_id: m for m in messages}

        # Build topic -> candidate messages mapping
        topic_to_mids: dict[str, list[str]] = {}
        for topic in ml_result.topics.topic_records:
            topic_to_mids[topic.topic_id] = list(topic.sample_message_ids)

        for candidate in ml_result.narrative_report.narrative_candidates:
            # Collect message objects in this narrative
            c_msgs: list[CanonicalMessage] = []
            for mid in topic_to_mids.get(candidate.promoted_from_topic_id, []):
                if mid in messages_by_id:
                    c_msgs.append(messages_by_id[mid])

            distinct_sources = sorted({
                (m.author_username or m.author_id).strip().lstrip("@")
                for m in c_msgs if m.author_username or m.author_id
            })

            # Cross-reference sources with registry domains
            domains_set: set[str] = set()
            for src_name in distinct_sources:
                entry = self.registry.get_by_username(f"@{src_name}") or self.registry.get_by_username(src_name)
                if entry:
                    domains_set.add(entry.domain)

            timestamps = [m.published_at for m in c_msgs if m.published_at]
            first_ts = min(timestamps).isoformat() if timestamps else ""
            last_ts = max(timestamps).isoformat() if timestamps else ""

            summaries.append(
                CrossSourceNarrativeSummary(
                    narrative_id=candidate.narrative_id,
                    message_count=candidate.data_coverage.message_count,
                    distinct_sources_count=len(distinct_sources) or candidate.data_coverage.channel_count,
                    distinct_sources=distinct_sources,
                    domains_represented=sorted(domains_set),
                    first_observed_utc=first_ts,
                    last_observed_utc=last_ts,
                    priority_signal_score=round(candidate.priority_signal_score, 4),
                    spread_score=round(candidate.sub_scores.spread_score, 4),
                    coordination_score=round(candidate.sub_scores.coordination_score, 4),
                    reach_score=round(candidate.sub_scores.reach_score, 4),
                    friction_score=round(candidate.sub_scores.friction_score, 4),
                )
            )

        return summaries

    async def build_and_validate_corpus(
        self,
        per_source_limit: int | None = None,
        max_sources: int | None = None,
        run_collection: bool = True,
        run_ml: bool = True,
    ) -> tuple[CorpusManifest, list[CanonicalMessage], MLPipelineResult | None]:
        """Execute full Milestone 6B pipeline: collection, replay, dedup, parquet, manifest, 4A-4H."""
        limit = per_source_limit or self.config.per_source_limit
        enabled_sources = self.registry.get_enabled_sources()
        if max_sources:
            enabled_sources = enabled_sources[:max_sources]

        source_usernames = [s.username for s in enabled_sources]

        multi_res: MultiCollectionResult | None = None
        if run_collection:
            logger.info(
                "Executing real multi-source collection across %d sources (limit: %d)...",
                len(source_usernames),
                limit,
            )
            multi_res = await self.collector.collect_sources(
                sources=source_usernames,
                limit=limit,
                use_registry=False,
            )

        # 1. Replay raw directory
        raw_dir = self.repo_root / "data" / "raw" / "telegram"
        logger.info("Replaying raw JSONL records from %s...", raw_dir)
        replay_summary = TelegramJSONLReplayer.run(raw_dir)

        # 2. Milestone 3C Quality & Deduplication
        metadata = {
            "dataset_platform": "telegram",
            "schema_version": "1.0.0",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "source_type": "telegram_source_registry_corpus",
            "normalization_version": "1.0.0",
        }
        clean_messages, quality_report = process_quality(
            replay_summary.results,
            dataset_platform="telegram",
            metadata=metadata,
        )

        # 3. Write Parquet dataset
        parquet_path = self.repo_root / "data" / "processed" / "telegram" / f"{self.config.dataset_name}.parquet"
        quality_json_path = parquet_path.with_suffix(".quality.json")
        parquet_path.parent.mkdir(parents=True, exist_ok=True)

        records_written = 0
        if clean_messages:
            records_written = write_canonical_messages(
                clean_messages,
                parquet_path,
                metadata=metadata,
                overwrite=True,
            )
        quality_report.records_written = records_written
        quality_report.save_json(quality_json_path)

        # 4. Compute distributions
        source_rows, domain_dist, lang_dist, media_text_dist = self.compute_distributions(
            clean_messages,
            quality_report,
            multi_collection_res=multi_res,
        )

        # 5. Run 4A–4H ML Pipeline if requested
        ml_result: MLPipelineResult | None = None
        narratives_summary: list[CrossSourceNarrativeSummary] = []
        analytics_artifact_path: Path | None = None

        if run_ml and clean_messages:
            logger.info("Executing frozen 4A-4H ML pipeline on %d canonical messages...", len(clean_messages))
            ml_result = run_ml_pipeline(clean_messages)
            analytics_artifact_path = self.repo_root / "data" / "processed" / "telegram" / f"{self.config.dataset_name}-analytics-artifact.json"
            ml_result.save_analytics_artifact(analytics_artifact_path, overwrite=True)
            # Also save legacy alias if needed by 5A
            legacy_analytics_path = self.repo_root / "data" / "processed" / "telegram" / "telegram-analytics-artifact.json"
            ml_result.save_analytics_artifact(legacy_analytics_path, overwrite=True)

            narratives_summary = self.evaluate_narratives(ml_result, clean_messages)

        # 6. Generate Dataset Manifest
        timestamp_slug = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        manifest_id = f"manifest_telegram_{timestamp_slug}"
        manifest_path = self.repo_root / "data" / "manifests" / "telegram" / f"{manifest_id}.json"

        failed_sources = multi_res.failed_channel_errors if multi_res else {}

        manifest = CorpusManifest(
            manifest_id=manifest_id,
            generated_at_utc=datetime.now(timezone.utc).isoformat(),
            registry_version=self.registry.version,
            collection_config=asdict(self.config),
            sources_requested=len(source_usernames),
            sources_attempted=len(source_usernames),
            sources_successful=sum(1 for r in source_rows if r.status == "SUCCESS"),
            sources_failed=sum(1 for r in source_rows if r.status == "FAILED"),
            failed_sources=failed_sources,
            total_raw_records=replay_summary.records_read,
            total_normalized_records=replay_summary.records_normalized,
            total_duplicates_detected=quality_report.duplicates_detected,
            total_final_records=len(clean_messages),
            dataset_output_path=str(parquet_path),
            quality_report_path=str(quality_json_path),
            analytics_artifact_path=str(analytics_artifact_path) if analytics_artifact_path else None,
            source_distribution=[asdict(r) for r in source_rows],
            domain_distribution=domain_dist,
            language_distribution=lang_dist,
            media_text_distribution=media_text_dist,
            narratives_summary=[asdict(ns) for ns in narratives_summary],
        )
        manifest.save_json(manifest_path)

        return manifest, clean_messages, ml_result


async def _main():
    """CLI runner for Milestone 6B real corpus expansion."""
    from app.core.config import load_project_env
    load_project_env()

    parser = argparse.ArgumentParser(description="TRAJECT Milestone 6B Real Telegram Corpus Builder")
    parser.add_argument("--limit", type=int, default=500, help="Per-source collection limit (default: 500)")
    parser.add_argument("--max-sources", type=int, default=13, help="Max registry sources to attempt (default: 13)")
    parser.add_argument("--no-collect", action="store_true", help="Skip live collection; replay existing raw files")
    parser.add_argument("--no-ml", action="store_true", help="Skip 4A-4H ML pipeline execution")

    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

    builder = TelegramCorpusBuilder()
    try:
        manifest, messages, ml_res = await builder.build_and_validate_corpus(
            per_source_limit=args.limit,
            max_sources=args.max_sources,
            run_collection=not args.no_collect,
            run_ml=not args.no_ml,
        )

        print("\n============================================================")
        print("MILESTONE 6B — CORPUS EXPANSION & VALIDATION COMPLETE")
        print("============================================================")
        print(f"Manifest ID:         {manifest.manifest_id}")
        print(f"Sources Requested:   {manifest.sources_requested}")
        print(f"Sources Succeeded:   {manifest.sources_successful}")
        print(f"Sources Failed:      {manifest.sources_failed}")
        print(f"Total Raw Records:   {manifest.total_raw_records}")
        print(f"Duplicates Detected: {manifest.total_duplicates_detected}")
        print(f"Final Clean Records: {manifest.total_final_records}")
        print(f"Parquet Dataset:     {manifest.dataset_output_path}")
        print("\n--- Source Distribution ---")
        print(f"{'Source':<32} {'Domain':<16} {'Raw':<6} {'Valid':<6} {'Dups':<6} {'Final':<6} {'Status'}")
        print("-" * 86)
        for s in manifest.source_distribution:
            print(f"{s['username']:<32} {s['domain']:<16} {s['raw_records']:<6} {s['valid_records']:<6} {s['duplicates']:<6} {s['final_records']:<6} {s['status']}")

        print("\n--- Domain Distribution ---")
        for dom, count in manifest.domain_distribution.items():
            print(f"  {dom:<20}: {count} records")

        print("\n--- Language Distribution (4B Model Detected) ---")
        for lang, count in manifest.language_distribution.items():
            print(f"  {lang:<10}: {count} records")

        print("\n--- Media / Text Distribution ---")
        for k, v in manifest.media_text_distribution.items():
            print(f"  {k:<20}: {v}")

        if ml_res:
            print("\n--- ML Analytics (4A-4H) Execution ---")
            print(f"Topics Discovered:     {len(ml_res.topics.topic_records)}")
            print(f"Noise Messages:        {ml_res.topics.noise_messages}")
            print(f"Enriched Topics:       {len(ml_res.enriched_topics.enriched_topics)}")
            print(f"Narrative Candidates:  {len(ml_res.narrative_report.narrative_candidates)}")
            if manifest.narratives_summary:
                print("\n--- Cross-Source Narratives ---")
                for n in manifest.narratives_summary:
                    print(f"  Narrative {n['narrative_id']}: {n['message_count']} msgs across {n['distinct_sources_count']} sources ({', '.join(n['distinct_sources'])}), Priority Signal Score: {n['priority_signal_score']}")
    finally:
        await builder.collector.close()


if __name__ == "__main__":
    asyncio.run(_main())
