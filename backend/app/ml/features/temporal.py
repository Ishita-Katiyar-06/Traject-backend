from collections import Counter
from datetime import datetime, timezone
import math
from typing import Sequence

from app.ml.features.models import TopicTemporalFeatures
from app.schemas import CanonicalMessage


def compute_temporal_features(
    messages: Sequence[CanonicalMessage],
) -> TopicTemporalFeatures:
    """Compute deterministic temporal signals, cadence, peak window, and burstiness index.
    
    Small-sample edge-case policies:
    - 0 messages: timespan=0, cadence=None, burstiness=None, velocity=None.
    - 1 message: timespan=0, cadence=None, burstiness=None, velocity=None.
    - 2 messages: cadence and velocity computed if timespan > 0; burstiness=None (<3 messages).
    - Identical timestamps (timespan == 0): cadence=None, velocity=None, burstiness=None.
    - >=3 messages with timespan > 0: burstiness computed via (sigma - mu) / (sigma + mu).
    """
    if not messages:
        now = datetime.now(timezone.utc)
        return TopicTemporalFeatures(
            first_published_at=now,
            last_published_at=now,
            timespan_seconds=0.0,
            messages_per_hour=None,
            peak_window_utc=now.strftime("%Y-%m-%dT%H:00"),
            peak_window_message_count=0,
            burstiness_index=None,
            channel_entry_velocity=None,
        )

    # Deterministic temporal ordering
    sorted_msgs = sorted(messages, key=lambda m: (m.published_at, m.canonical_id))
    first_dt = sorted_msgs[0].published_at
    last_dt = sorted_msgs[-1].published_at

    timespan_sec = max((last_dt - first_dt).total_seconds(), 0.0)

    # Peak 1-Hour Window Binning (UTC)
    hour_buckets: Counter[str] = Counter()
    for m in sorted_msgs:
        bucket = m.published_at.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:00")
        hour_buckets[bucket] += 1

    peak_window, peak_count = hour_buckets.most_common(1)[0]

    # Small-sample edge case: 1 message
    if len(sorted_msgs) == 1:
        return TopicTemporalFeatures(
            first_published_at=first_dt,
            last_published_at=last_dt,
            timespan_seconds=0.0,
            messages_per_hour=None,
            peak_window_utc=peak_window,
            peak_window_message_count=peak_count,
            burstiness_index=None,
            channel_entry_velocity=None,
        )

    # Identical timestamps edge case (duration == 0)
    if timespan_sec == 0.0:
        return TopicTemporalFeatures(
            first_published_at=first_dt,
            last_published_at=last_dt,
            timespan_seconds=0.0,
            messages_per_hour=None,
            peak_window_utc=peak_window,
            peak_window_message_count=peak_count,
            burstiness_index=None,
            channel_entry_velocity=None,
        )

    # Multi-message with positive timespan
    timespan_hours = timespan_sec / 3600.0
    msg_per_hour = round(len(sorted_msgs) / timespan_hours, 2)

    unique_channels = {m.author_id for m in sorted_msgs}
    channel_velocity = round(len(unique_channels) / timespan_hours, 2)

    # Burstiness requires at least 3 messages (>= 2 inter-arrival intervals)
    burstiness: float | None = None
    if len(sorted_msgs) >= 3:
        intervals = [
            (sorted_msgs[i + 1].published_at - sorted_msgs[i].published_at).total_seconds()
            for i in range(len(sorted_msgs) - 1)
        ]
        mu = sum(intervals) / len(intervals)
        variance = sum((x - mu) ** 2 for x in intervals) / len(intervals)
        sigma = math.sqrt(variance)

        if (sigma + mu) > 0:
            burstiness = round((sigma - mu) / (sigma + mu), 4)

    return TopicTemporalFeatures(
        first_published_at=first_dt,
        last_published_at=last_dt,
        timespan_seconds=round(timespan_sec, 2),
        messages_per_hour=msg_per_hour,
        peak_window_utc=peak_window,
        peak_window_message_count=peak_count,
        burstiness_index=burstiness,
        channel_entry_velocity=channel_velocity,
    )
