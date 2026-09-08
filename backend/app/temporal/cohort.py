"""
Milestone 8B: Fresh Temporal Observation Cohort Manager.

Manages cohort creation, bounded re-observation without full-history re-downloads,
and empirical temporal trajectory quality evaluation.
"""
from collections import defaultdict
from datetime import datetime, timedelta, timezone
import json
import logging
from pathlib import Path
from typing import Any, Sequence

from app.core.config import find_repo_root
from app.schemas.canonical_message import CanonicalMessage
from app.schemas.cohort import CohortQualityMetrics, TemporalCohortMetadata
from app.schemas.engagement_observation import EngagementObservation
from app.storage.engagement_observations import append_engagement_observations

logger = logging.getLogger("traject.temporal.cohort")


class CohortManager:
    """Orchestrates temporal observation cohorts, bounded re-observation, and quality metrics."""

    def __init__(self, repo_root: Path | None = None, storage_dir: Path | None = None):
        self.repo_root = repo_root or find_repo_root()
        self.storage_dir = (
            Path(storage_dir).resolve()
            if storage_dir is not None
            else (self.repo_root / "data" / "cohorts").resolve()
        )
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def create_cohort(
        self,
        messages: Sequence[CanonicalMessage],
        window_hours: float = 24.0,
        target_sources: Sequence[str] | None = None,
        cohort_id: str | None = None,
        manifest_reference: str | None = None,
        reference_time: datetime | None = None,
    ) -> TemporalCohortMetadata:
        """Identify a fresh cohort of messages published within the recent window for temporal tracking.
        
        Args:
            messages: Input collection of canonical messages.
            window_hours: Lookback window in hours (default: 24.0).
            target_sources: Optional list of specific channel usernames/IDs to restrict to.
            cohort_id: Optional custom cohort identifier.
            manifest_reference: Optional collection manifest filename or ID.
            reference_time: Optional reference cutoff time (defaults to latest message published_at or now).
            
        Returns:
            TemporalCohortMetadata: Registered and saved cohort metadata.
        """
        if not messages:
            raise ValueError("Cannot create a cohort from empty messages sequence.")

        now_utc = datetime.now(timezone.utc)
        max_pub = max(m.published_at for m in messages)
        ref_time = reference_time or max_pub

        cohort_start = ref_time - timedelta(hours=window_hours)
        cohort_end = ref_time

        # Filter messages strictly in (cohort_start, cohort_end]
        selected_msgs = [
            m for m in messages
            if cohort_start < m.published_at <= cohort_end
        ]

        # Apply source filter if provided
        if target_sources:
            norm_sources = {s.lstrip("@").lower() for s in target_sources}
            selected_msgs = [
                m for m in selected_msgs
                if (m.author_username and m.author_username.lstrip("@").lower() in norm_sources)
                or (m.author_id in norm_sources)
            ]

        if not selected_msgs:
            # Fallback to the latest messages if no message fell in exact window
            sorted_by_pub = sorted(messages, key=lambda m: m.published_at, reverse=True)
            selected_msgs = sorted_by_pub[:min(50, len(sorted_by_pub))]
            cohort_start = min(m.published_at for m in selected_msgs)
            cohort_end = max(m.published_at for m in selected_msgs)
            logger.warning(
                "No messages found strictly within recent %fh window; falling back to top %d latest messages.",
                window_hours,
                len(selected_msgs),
            )

        # Collect distinct channels/sources
        channels_set: set[str] = set()
        for m in selected_msgs:
            if m.author_username:
                channels_set.add(f"@{m.author_username.lstrip('@')}")
            elif m.channel_title:
                channels_set.add(m.channel_title)
            else:
                channels_set.add(m.author_id)

        timestamp_slug = now_utc.strftime("%Y%m%d_%H%M%S")
        cid = cohort_id or f"cohort_{timestamp_slug}"

        canonical_ids = sorted(list({m.canonical_id for m in selected_msgs}))

        cohort_meta = TemporalCohortMetadata(
            cohort_id=cid,
            created_at_utc=now_utc,
            cohort_window_hours=window_hours,
            cohort_start_utc=min(m.published_at for m in selected_msgs),
            cohort_end_utc=max(m.published_at for m in selected_msgs),
            source_count=len(channels_set),
            message_count=len(canonical_ids),
            target_channels=sorted(list(channels_set)),
            canonical_ids=canonical_ids,
            observation_schedule=["T0", "T+1h", "T+2h", "T+4h", "T+6h", "T+12h", "T+24h"],
            observation_policy="bounded_channel_reobservation",
            manifest_reference=manifest_reference,
            completed_observation_rounds=1,
            latest_observation_utc=now_utc,
        )

        self.save_cohort(cohort_meta)
        logger.info(
            "Created cohort '%s': %d messages across %d sources (published: %s to %s).",
            cid,
            cohort_meta.message_count,
            cohort_meta.source_count,
            cohort_meta.cohort_start_utc.isoformat(),
            cohort_meta.cohort_end_utc.isoformat(),
        )
        return cohort_meta

    def save_cohort(self, cohort: TemporalCohortMetadata) -> Path:
        """Persist cohort metadata to JSON."""
        file_path = self.storage_dir / f"{cohort.cohort_id}.json"
        latest_path = self.storage_dir / "latest_cohort.json"

        data = cohort.model_dump(mode="json")
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        with open(latest_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        return file_path

    def load_cohort(self, cohort_id: str = "latest") -> TemporalCohortMetadata:
        """Load cohort metadata from JSON."""
        target_name = "latest_cohort.json" if cohort_id == "latest" else f"{cohort_id}.json"
        target_path = self.storage_dir / target_name

        if not target_path.is_file():
            raise FileNotFoundError(f"Cohort metadata file not found at: {target_path}")

        with open(target_path, "r", encoding="utf-8") as f:
            raw = json.load(f)

        return TemporalCohortMetadata.model_validate(raw)

    async def reobserve_cohort(
        self,
        cohort: TemporalCohortMetadata,
        collector: Any,
        limit_per_channel: int = 50,
        observation_parquet_path: Path | str | None = None,
    ) -> tuple[TemporalCohortMetadata, dict[str, Any]]:
        """Perform a bounded re-observation round across cohort channels without downloading full history.
        
        Fetches only the recent limit_per_channel messages from each cohort channel,
        extracts fresh EngagementObservations, and appends them to observation parquet storage.
        """
        now_utc = datetime.now(timezone.utc)
        obs_path = (
            Path(observation_parquet_path).resolve()
            if observation_parquet_path is not None
            else (self.repo_root / "data" / "processed" / "telegram" / "telegram_engagement_observations.parquet").resolve()
        )

        channels_attempted = len(cohort.target_channels)
        channels_succeeded = 0
        channels_failed = 0
        all_new_observations: list[EngagementObservation] = []
        errors: dict[str, str] = {}

        for ch in cohort.target_channels:
            try:
                res = await collector.reobserve_channel(channel=ch, limit=limit_per_channel)
                obs_list = list(res.engagement_observations)
                all_new_observations.extend(obs_list)
                channels_succeeded += 1
            except Exception as e:
                err_msg = f"{type(e).__name__}: {e}"
                logger.warning("Failed re-observing channel %s: %s", ch, err_msg)
                errors[ch] = err_msg
                channels_failed += 1

        persisted_count = 0
        if all_new_observations:
            persisted_count, _ = append_engagement_observations(
                obs_path,
                all_new_observations,
                metadata={
                    "cohort_id": cohort.cohort_id,
                    "reobservation_round": str(cohort.completed_observation_rounds + 1),
                },
            )

        # Update cohort metadata
        updated_cohort = cohort.model_copy(
            update={
                "completed_observation_rounds": cohort.completed_observation_rounds + 1,
                "latest_observation_utc": now_utc,
            }
        )
        self.save_cohort(updated_cohort)

        metrics = {
            "round": updated_cohort.completed_observation_rounds,
            "timestamp": now_utc.isoformat(),
            "channels_attempted": channels_attempted,
            "channels_succeeded": channels_succeeded,
            "channels_failed": channels_failed,
            "observations_generated": len(all_new_observations),
            "observations_persisted": persisted_count,
            "errors": errors,
        }

        logger.info(
            "Re-observation round %d complete: %d channels succeeded, %d fresh observations persisted.",
            updated_cohort.completed_observation_rounds,
            channels_succeeded,
            persisted_count,
        )
        return updated_cohort, metrics

    def evaluate_cohort_quality(
        self,
        cohort: TemporalCohortMetadata,
        observations: Sequence[EngagementObservation],
        evaluated_at: datetime | None = None,
    ) -> CohortQualityMetrics:
        """Evaluate observation density, interval distributions, and growth trajectories for the cohort."""
        now_utc = evaluated_at or datetime.now(timezone.utc)
        cohort_cids = set(cohort.canonical_ids)

        # Filter observations belonging to this cohort
        cohort_obs = [ob for ob in observations if ob.canonical_id in cohort_cids]

        # Group by canonical_id
        obs_by_msg: dict[str, list[EngagementObservation]] = defaultdict(list)
        for ob in cohort_obs:
            obs_by_msg[ob.canonical_id].append(ob)

        # Sort each message's observations by observed_at
        for cid in obs_by_msg:
            obs_by_msg[cid].sort(key=lambda x: x.observed_at)

        # Count distribution
        counts = [len(obs_list) for obs_list in obs_by_msg.values()]
        # Also account for cohort messages with 0 observations
        msgs_with_0 = len(cohort_cids) - len(obs_by_msg)
        msgs_with_1 = sum(1 for c in counts if c == 1)
        msgs_with_2 = sum(1 for c in counts if c == 2)
        msgs_with_3_plus = sum(1 for c in counts if c >= 3)
        max_obs = max(counts) if counts else 0

        # Calculate observation intervals across multi-observation messages
        intervals_minutes: list[float] = []
        msgs_incr_views = 0
        msgs_incr_forwards = 0
        msgs_incr_rx = 0
        msgs_incr_replies = 0
        msgs_counter_decrease = 0

        for cid, o_list in obs_by_msg.items():
            if len(o_list) < 2:
                continue

            for i in range(1, len(o_list)):
                dt_sec = (o_list[i].observed_at - o_list[i - 1].observed_at).total_seconds()
                intervals_minutes.append(dt_sec / 60.0)

            # Check growth between earliest and latest observation
            first_o = o_list[0]
            last_o = o_list[-1]

            # Views
            if first_o.views_count is not None and last_o.views_count is not None:
                if last_o.views_count > first_o.views_count:
                    msgs_incr_views += 1
                elif last_o.views_count < first_o.views_count:
                    msgs_counter_decrease += 1

            # Forwards
            if first_o.forwards_count is not None and last_o.forwards_count is not None:
                if last_o.forwards_count > first_o.forwards_count:
                    msgs_incr_forwards += 1
                elif last_o.forwards_count < first_o.forwards_count:
                    msgs_counter_decrease += 1

            # Reactions total
            first_rx = sum(first_o.reactions.values()) if first_o.reactions else 0
            last_rx = sum(last_o.reactions.values()) if last_o.reactions else 0
            if last_rx > first_rx:
                msgs_incr_rx += 1
            elif last_rx < first_rx:
                msgs_counter_decrease += 1

            # Replies
            if first_o.replies_count is not None and last_o.replies_count is not None:
                if last_o.replies_count > first_o.replies_count:
                    msgs_incr_replies += 1
                elif last_o.replies_count < first_o.replies_count:
                    msgs_counter_decrease += 1

        # Percentile calculations
        intervals_minutes.sort()
        p25 = None
        med = None
        p75 = None
        p90 = None
        int_min = None
        int_max = None

        if intervals_minutes:
            n = len(intervals_minutes)
            int_min = round(intervals_minutes[0], 2)
            int_max = round(intervals_minutes[-1], 2)
            med = round(intervals_minutes[n // 2], 2)
            p25 = round(intervals_minutes[int(n * 0.25)], 2)
            p75 = round(intervals_minutes[int(n * 0.75)], 2)
            p90 = round(intervals_minutes[min(int(n * 0.90), n - 1)], 2)

        coverage_pct = round(len(obs_by_msg) / len(cohort_cids) * 100.0, 2) if cohort_cids else 0.0

        return CohortQualityMetrics(
            cohort_id=cohort.cohort_id,
            evaluated_at_utc=now_utc,
            total_cohort_messages=len(cohort_cids),
            messages_with_1_obs=msgs_with_1,
            messages_with_2_obs=msgs_with_2,
            messages_with_3_plus_obs=msgs_with_3_plus,
            max_observations_per_message=max_obs,
            interval_min_minutes=int_min,
            interval_p25_minutes=p25,
            interval_median_minutes=med,
            interval_p75_minutes=p75,
            interval_p90_minutes=p90,
            interval_max_minutes=int_max,
            messages_with_increasing_views=msgs_incr_views,
            messages_with_increasing_forwards=msgs_incr_forwards,
            messages_with_increasing_reactions=msgs_incr_rx,
            messages_with_increasing_replies=msgs_incr_replies,
            messages_with_counter_decreases=msgs_counter_decrease,
            target_period_coverage_pct=coverage_pct,
        )
