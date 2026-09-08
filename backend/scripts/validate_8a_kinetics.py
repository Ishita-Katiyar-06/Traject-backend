"""
Milestone 8A - Real Data Validation Script
Validates topic temporal kinetics on actual Telegram Parquet messages,
engagement observations, and analytics topics.
"""
import json
import logging
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from app.schemas.canonical_message import CanonicalMessage
from app.schemas.engagement_observation import EngagementObservation
from app.storage.engagement_observations import read_engagement_observations
from app.storage.parquet import read_canonical_messages
from app.temporal.kinetics import compute_all_topics_kinetics, compute_topic_temporal_kinetics

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("validate_8a")


def run_validation():
    # 1. Paths
    repo_root = Path(__file__).resolve().parents[2]
    messages_path = repo_root / "data" / "processed" / "telegram" / "telegram_messages.parquet"
    obs_path = repo_root / "data" / "processed" / "telegram" / "telegram_engagement_observations.parquet"
    artifact_path = repo_root / "data" / "processed" / "telegram" / "telegram_messages-analytics-artifact.json"

    logger.info("Loading canonical messages from %s", messages_path)
    messages = read_canonical_messages(messages_path)
    num_messages = len(messages)
    logger.info("Loaded %d canonical messages", num_messages)

    msg_by_id: dict[str, CanonicalMessage] = {m.canonical_id: m for m in messages}

    pub_dates = [m.published_at for m in messages]
    earliest_pub = min(pub_dates)
    latest_pub = max(pub_dates)
    span = latest_pub - earliest_pub

    # 2. Observations
    logger.info("Loading engagement observations from %s", obs_path)
    observations = read_engagement_observations(obs_path) if obs_path.exists() else []
    num_obs = len(observations)
    logger.info("Loaded %d engagement observations", num_obs)

    obs_by_msg: dict[str, list[EngagementObservation]] = defaultdict(list)
    for obs in observations:
        obs_by_msg[obs.canonical_id].append(obs)

    msgs_with_obs = len(obs_by_msg)
    msgs_with_multi_obs = sum(1 for m_id, ob_list in obs_by_msg.items() if len(ob_list) > 1)

    # 3. Topic assignments from frozen 4A artifact
    logger.info("Loading topic assignments from %s", artifact_path)
    with open(artifact_path, "r", encoding="utf-8") as f:
        artifact = json.load(f)

    topic_records = artifact["topics"]["topic_records"]
    num_topics = len(topic_records)
    logger.info("Found %d topic records in frozen artifact", num_topics)

    # Build topic_id -> list[CanonicalMessage]
    topic_messages: dict[str, list[CanonicalMessage]] = {}
    for rec in topic_records:
        t_id = rec["topic_id"]
        sample_ids = rec.get("sample_message_ids", [])
        t_msgs = [msg_by_id[m_id] for m_id in sample_ids if m_id in msg_by_id]
        if t_msgs:
            topic_messages[t_id] = t_msgs

    logger.info("Mapped %d topics with resolvable messages (%d total assigned messages)",
                len(topic_messages), sum(len(ms) for ms in topic_messages.values()))

    # 4. Evaluate Kinetics at Global Cutoff T = latest_pub
    logger.info("Evaluating all topics at Global Cutoff T = %s", latest_pub.isoformat())
    global_kinetics = compute_all_topics_kinetics(
        topics_messages=topic_messages,
        engagement_observations=observations,
        cutoff_at=latest_pub,
    )

    # 5. Evaluate Kinetics at Topic-Specific Cutoff T = max(topic's published_at)
    # This evaluates kinetics during each topic's actual period of activity
    logger.info("Evaluating all topics at Topic-Specific Cutoff T = max(topic.published_at)")
    topic_relative_kinetics = {}
    for t_id, msgs in topic_messages.items():
        t_cutoff = max(m.published_at for m in msgs)
        topic_relative_kinetics[t_id] = compute_topic_temporal_kinetics(
            topic_id=t_id,
            messages=msgs,
            engagement_observations=observations,
            cutoff_at=t_cutoff,
        )

    # 6. Aggregate Coverage & Availability Statistics
    def compute_stats(kinetics_dict: dict):
        total = len(kinetics_dict)
        has_msgs_1h = sum(1 for k in kinetics_dict.values() if k.messages_1h > 0)
        has_msgs_6h = sum(1 for k in kinetics_dict.values() if k.messages_6h > 0)
        has_msgs_24h = sum(1 for k in kinetics_dict.values() if k.messages_24h > 0)
        has_accel_6h = sum(1 for k in kinetics_dict.values() if k.acceleration_6h is not None)
        has_accel_24h = sum(1 for k in kinetics_dict.values() if k.acceleration_24h is not None)
        has_multi_channels = sum(1 for k in kinetics_dict.values() if k.distinct_channels_24h > 1)
        has_domains = sum(1 for k in kinetics_dict.values() if k.distinct_domains_24h > 0)
        has_obs_coverage = sum(1 for k in kinetics_dict.values() if k.messages_with_observations > 0)
        has_multi_obs = sum(1 for k in kinetics_dict.values() if k.messages_with_multiple_observations > 0)
        has_view_velocity = sum(1 for k in kinetics_dict.values() if k.view_velocity_per_hour is not None)
        has_burstiness = sum(1 for k in kinetics_dict.values() if k.burstiness_index is not None)

        return {
            "total": total,
            "has_msgs_1h": (has_msgs_1h, has_msgs_1h / total * 100 if total else 0),
            "has_msgs_6h": (has_msgs_6h, has_msgs_6h / total * 100 if total else 0),
            "has_msgs_24h": (has_msgs_24h, has_msgs_24h / total * 100 if total else 0),
            "has_accel_6h": (has_accel_6h, has_accel_6h / total * 100 if total else 0),
            "has_accel_24h": (has_accel_24h, has_accel_24h / total * 100 if total else 0),
            "has_multi_channels": (has_multi_channels, has_multi_channels / total * 100 if total else 0),
            "has_domains": (has_domains, has_domains / total * 100 if total else 0),
            "has_obs_coverage": (has_obs_coverage, has_obs_coverage / total * 100 if total else 0),
            "has_multi_obs": (has_multi_obs, has_multi_obs / total * 100 if total else 0),
            "has_view_velocity": (has_view_velocity, has_view_velocity / total * 100 if total else 0),
            "has_burstiness": (has_burstiness, has_burstiness / total * 100 if total else 0),
        }

    global_stats = compute_stats(global_kinetics)
    relative_stats = compute_stats(topic_relative_kinetics)

    # 7. Print Formatted Report
    print("=" * 70)
    print("MILESTONE 8A - DYNAMIC REAL DATA VALIDATION REPORT")
    print("=" * 70)
    print(f"Total Canonical Messages in Parquet: {num_messages}")
    print(f"Total Clustered Topics in Artifact:   {num_topics}")
    print(f"Earliest Message Published At:        {earliest_pub.isoformat()}")
    print(f"Latest Message Published At:          {latest_pub.isoformat()}")
    print(f"Overall Publication Span:             {span.days} days, {span.seconds // 3600} hours")
    print(f"Total Engagement Observations:        {num_obs}")
    print(f"Messages with >=1 Observation:        {msgs_with_obs} ({msgs_with_obs/num_messages*100:.2f}%)")
    print(f"Messages with >=2 Observations:       {msgs_with_multi_obs} ({msgs_with_multi_obs/num_messages*100:.2f}%)")
    print("-" * 70)

    print("\n--- A. EVALUATION AT GLOBAL CUTOFF T = max(dataset.published_at) ---")
    print(f"Cutoff Timestamp: {latest_pub.isoformat()}")
    print(f"Topics evaluated: {global_stats['total']}")
    print(f"  Topics with messages in 1h window:   {global_stats['has_msgs_1h'][0]:4d} ({global_stats['has_msgs_1h'][1]:.2f}%)")
    print(f"  Topics with messages in 6h window:   {global_stats['has_msgs_6h'][0]:4d} ({global_stats['has_msgs_6h'][1]:.2f}%)")
    print(f"  Topics with messages in 24h window:  {global_stats['has_msgs_24h'][0]:4d} ({global_stats['has_msgs_24h'][1]:.2f}%)")
    print(f"  Topics with valid acceleration_6h:   {global_stats['has_accel_6h'][0]:4d} ({global_stats['has_accel_6h'][1]:.2f}%)")
    print(f"  Topics with valid acceleration_24h:  {global_stats['has_accel_24h'][0]:4d} ({global_stats['has_accel_24h'][1]:.2f}%)")
    print(f"  Topics with multi-channel diffusion: {global_stats['has_multi_channels'][0]:4d} ({global_stats['has_multi_channels'][1]:.2f}%)")
    print(f"  Topics with observed domain diff:    {global_stats['has_domains'][0]:4d} ({global_stats['has_domains'][1]:.2f}%)")
    print(f"  Topics with observation coverage:    {global_stats['has_obs_coverage'][0]:4d} ({global_stats['has_obs_coverage'][1]:.2f}%)")
    print(f"  Topics with multiple observations:   {global_stats['has_multi_obs'][0]:4d} ({global_stats['has_multi_obs'][1]:.2f}%)")
    print(f"  Topics with valid view_velocity:     {global_stats['has_view_velocity'][0]:4d} ({global_stats['has_view_velocity'][1]:.2f}%)")
    print(f"  Topics with valid burstiness index:  {global_stats['has_burstiness'][0]:4d} ({global_stats['has_burstiness'][1]:.2f}%)")

    print("\n--- B. EVALUATION AT TOPIC-SPECIFIC PEAK/ACTIVITY CUTOFF T = max(topic.published_at) ---")
    print(f"Topics evaluated: {relative_stats['total']}")
    print(f"  Topics with messages in 1h window:   {relative_stats['has_msgs_1h'][0]:4d} ({relative_stats['has_msgs_1h'][1]:.2f}%)")
    print(f"  Topics with messages in 6h window:   {relative_stats['has_msgs_6h'][0]:4d} ({relative_stats['has_msgs_6h'][1]:.2f}%)")
    print(f"  Topics with messages in 24h window:  {relative_stats['has_msgs_24h'][0]:4d} ({relative_stats['has_msgs_24h'][1]:.2f}%)")
    print(f"  Topics with valid acceleration_6h:   {relative_stats['has_accel_6h'][0]:4d} ({relative_stats['has_accel_6h'][1]:.2f}%)")
    print(f"  Topics with valid acceleration_24h:  {relative_stats['has_accel_24h'][0]:4d} ({relative_stats['has_accel_24h'][1]:.2f}%)")
    print(f"  Topics with multi-channel diffusion: {relative_stats['has_multi_channels'][0]:4d} ({relative_stats['has_multi_channels'][1]:.2f}%)")
    print(f"  Topics with observed domain diff:    {relative_stats['has_domains'][0]:4d} ({relative_stats['has_domains'][1]:.2f}%)")
    print(f"  Topics with observation coverage:    {relative_stats['has_obs_coverage'][0]:4d} ({relative_stats['has_obs_coverage'][1]:.2f}%)")
    print(f"  Topics with multiple observations:   {relative_stats['has_multi_obs'][0]:4d} ({relative_stats['has_multi_obs'][1]:.2f}%)")
    print(f"  Topics with valid view_velocity:     {relative_stats['has_view_velocity'][0]:4d} ({relative_stats['has_view_velocity'][1]:.2f}%)")
    print(f"  Topics with valid burstiness index:  {relative_stats['has_burstiness'][0]:4d} ({relative_stats['has_burstiness'][1]:.2f}%)")
    print("=" * 70)


if __name__ == "__main__":
    run_validation()
