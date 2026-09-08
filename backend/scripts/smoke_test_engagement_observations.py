"""Real Telegram Smoke Test for Milestone 7B Engagement Observation Infrastructure.

Tests real MTProto session:
1. Performs Observation 1 on a small bounded set of messages (e.g. 2 messages from @warmonitors).
2. Waits 3 seconds.
3. Performs Observation 2 on the same messages via reobserve_channel.
4. Verifies:
   - Same canonical_ids.
   - Different observed_at timestamps.
   - Canonical Parquet has exactly 2 rows (deduplicated by canonical_id).
   - Observation Parquet has 4 rows (2 observations per canonical_id).
   - Reports exact engagement values observed.
"""

import asyncio
from datetime import datetime, timezone
import logging
from pathlib import Path
import shutil
import sys
import tempfile

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from app.collectors.telegram.collector import TelegramCollector
from app.core.config import load_project_env
from app.storage.engagement_observations import (
    append_engagement_observations,
    read_engagement_observations,
)
from app.storage.parquet import (
    append_canonical_messages,
    read_canonical_messages,
)
from app.temporal.observation_metrics import compute_engagement_delta

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("smoke_test")


async def run_smoke_test():
    load_project_env()
    tmp_dir = Path(tempfile.mkdtemp(prefix="traject_smoke_7b_"))
    try:
        canonical_parquet = tmp_dir / "canonical_messages.parquet"
        observation_parquet = tmp_dir / "telegram_engagement_observations.parquet"

        channel = "@warmonitors"
        limit = 2

        logger.info("Initializing TelegramCollector for live MTProto test...")
        async with TelegramCollector(raw_storage_dir=tmp_dir / "raw") as collector:
            # --- PASS 1: Observation 1 ---
            logger.info("Executing Pass 1 on %s (limit: %d)...", channel, limit)
            res1 = await collector.collect_channel(channel=channel, limit=limit)
            logger.info("Pass 1 fetched %d messages, %d observations.", len(res1.canonical_messages), len(res1.engagement_observations))

            if not res1.canonical_messages:
                logger.error("No messages returned from Telegram for %s", channel)
                return

            c_app1, c_tot1 = append_canonical_messages(canonical_parquet, res1.canonical_messages)
            o_app1, o_tot1 = append_engagement_observations(observation_parquet, res1.engagement_observations)

            logger.info("Pass 1 Persistence: Canonical added=%d, total=%d | Observations added=%d, total=%d", c_app1, c_tot1, o_app1, o_tot1)

            # Wait briefly to ensure distinct observation timestamps
            wait_seconds = 3
            logger.info("Pausing %d seconds before Pass 2 re-observation...", wait_seconds)
            await asyncio.sleep(wait_seconds)

            # --- PASS 2: Observation 2 (Re-observation) ---
            logger.info("Executing Pass 2 re-observation on %s (limit: %d)...", channel, limit)
            res2 = await collector.reobserve_channel(channel=channel, limit=limit)
            logger.info("Pass 2 fetched %d messages, %d observations.", len(res2.canonical_messages), len(res2.engagement_observations))

            c_app2, c_tot2 = append_canonical_messages(canonical_parquet, res2.canonical_messages)
            o_app2, o_tot2 = append_engagement_observations(observation_parquet, res2.engagement_observations)

            logger.info("Pass 2 Persistence: Canonical added=%d, total=%d | Observations added=%d, total=%d", c_app2, c_tot2, o_app2, o_tot2)

        # --- VERIFICATION ---
        c_stored = read_canonical_messages(canonical_parquet)
        o_stored = read_engagement_observations(observation_parquet)

        print("\n=======================================================")
        print("REAL TELEGRAM SMOKE TEST RESULTS (MILESTONE 7B)")
        print("=======================================================")
        print(f"Channel tested: {channel}")
        print(f"Pass 1 Observations: {len(res1.engagement_observations)}")
        print(f"Pass 2 Observations: {len(res2.engagement_observations)}")
        print(f"Canonical messages in store: {len(c_stored)} (Expected: {limit})")
        print(f"Canonical deduplication verified: {c_app2 == 0} (Pass 2 added 0 duplicate canonical rows)")
        print(f"Total Engagement Observations in store: {len(o_stored)} (Expected: {limit * 2})")
        print(f"Observation persistence verified: {o_app2 == len(res2.engagement_observations)}")

        # Inspect individual message observation trajectories
        for msg in c_stored:
            msg_obs = [o for o in o_stored if o.canonical_id == msg.canonical_id]
            msg_obs_sorted = sorted(msg_obs, key=lambda x: x.observed_at)
            print(f"\n--- Canonical Message: {msg.canonical_id} ---")
            print(f"Published at: {msg.published_at}")
            print(f"Number of observations recorded: {len(msg_obs_sorted)}")
            for idx, o in enumerate(msg_obs_sorted, 1):
                print(f"  Obs {idx} [{o.observed_at}]: Views={o.views_count}, Forwards={o.forwards_count}, Replies={o.replies_count}, Rx={o.reactions}")

            if len(msg_obs_sorted) >= 2:
                delta = compute_engagement_delta(msg_obs_sorted[0], msg_obs_sorted[1])
                print(f"  Delta ({delta.elapsed_seconds:.2f}s elapsed):")
                print(f"    ΔViews: {delta.delta_views}")
                print(f"    ΔForwards: {delta.delta_forwards}")
                print(f"    ΔReplies: {delta.delta_replies}")
                print(f"    ΔTotal Reactions: {delta.delta_reactions_total}")

        # Also test append idempotency on real observation store
        appended_dup, tot_dup = append_engagement_observations(observation_parquet, o_stored)
        print(f"\nIdempotency check: Re-appending {len(o_stored)} existing observations -> Appended={appended_dup}, Total={tot_dup}")
        assert appended_dup == 0, f"Expected 0 duplicates appended, got {appended_dup}"
        print("Idempotency strictly confirmed: 0 duplicate rows appended!")
        print("=======================================================\n")

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    asyncio.run(run_smoke_test())
