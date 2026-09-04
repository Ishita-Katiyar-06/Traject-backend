from datetime import datetime, timezone
import json
import math
from pathlib import Path

import numpy as np
import pytest

from app.ml.features.engagement import (
    NEGATIVE_EMOJIS,
    NEUTRAL_EMOJIS,
    POSITIVE_EMOJIS,
    compute_engagement_features,
)
from app.ml.features.enrichment import enrich_topics
from app.ml.features.entities import (
    extract_domain_from_url,
    extract_social_entities,
)
from app.ml.features.models import (
    EnrichedTopicCandidate,
    SocialEntityCategory,
    TopicEngagementFeatures,
    TopicEnrichmentResult,
    TopicEntity,
    TopicPropagationFeatures,
    TopicTemporalFeatures,
)
from app.ml.features.propagation import (
    compute_propagation_features,
    parse_origin_channel,
)
from app.ml.features.temporal import compute_temporal_features
from app.ml.topics.models import (
    ClusteringConfig,
    TopicDiscoveryResult,
    TopicKeyword,
    TopicRecord,
)
from app.schemas import AuthorType, CanonicalMessage, Platform


@pytest.fixture
def sample_messages_cluster():
    """Build a synthetic cluster of 3 canonical messages for deterministic testing."""
    dt1 = datetime(2026, 9, 2, 10, 0, 0, tzinfo=timezone.utc)
    dt2 = datetime(2026, 9, 2, 10, 2, 0, tzinfo=timezone.utc)
    dt3 = datetime(2026, 9, 2, 10, 5, 0, tzinfo=timezone.utc)

    m1 = CanonicalMessage(
        canonical_id="telegram:c1:101",
        platform=Platform.TELEGRAM,
        native_id="101",
        author_id="c1",
        author_type=AuthorType.CHANNEL,
        published_at=dt1,
        collected_at=dt1,
        text_content="Border security alert: new outpost operational in Ladakh India. #Security https://reuters.com/news/1",
        views_count=1000,
        forwards_count=40,
        replies_count=10,
        reactions={"👍": 30, "🔥": 10},
        is_forward=False,
        origin_source_id=None,
        hashtags=["#Security"],
        mentions=[],
        urls=["https://reuters.com/news/1"],
    )

    m2 = CanonicalMessage(
        canonical_id="telegram:c2:201",
        platform=Platform.TELEGRAM,
        native_id="201",
        author_id="c2",
        author_type=AuthorType.CHANNEL,
        published_at=dt2,
        collected_at=dt2,
        text_content="Forwarded: Border security alert: new outpost operational in Ladakh India. #Security",
        views_count=500,
        forwards_count=10,
        replies_count=0,
        reactions={"👍": 5, "👎": 1},
        is_forward=True,
        origin_source_id="telegram:c1:101",
        hashtags=["#Security"],
        mentions=["@c1"],
        urls=[],
    )

    m3 = CanonicalMessage(
        canonical_id="telegram:c3:301",
        platform=Platform.TELEGRAM,
        native_id="301",
        author_id="c3",
        author_type=AuthorType.CHANNEL,
        published_at=dt3,
        collected_at=dt3,
        text_content="Border security alert: new outpost operational in Ladakh India. #Security https://reuters.com/news/1",
        views_count=500,
        forwards_count=20,
        replies_count=5,
        reactions={"❤️": 15, "🤔": 2},
        is_forward=False,
        origin_source_id=None,
        hashtags=["#Security"],
        mentions=[],
        urls=["https://reuters.com/news/1"],
    )

    return [m1, m2, m3]


def test_feature_models_serialization(tmp_path):
    """1. Verify serialization of EnrichedTopicCandidate and TopicEnrichmentResult."""
    dt = datetime(2026, 9, 2, 12, 0, tzinfo=timezone.utc)
    candidate = EnrichedTopicCandidate(
        topic_id="topic_000",
        message_count=3,
        percentage_of_dataset=100.0,
        representative_keywords=["border", "security"],
        entities=[
            TopicEntity(text="security", category=SocialEntityCategory.HASHTAG, frequency=3, sample_message_ids=["m1"])
        ],
        engagement=TopicEngagementFeatures(
            total_views=2000,
            total_forwards=70,
            total_replies=15,
            total_reactions=63,
            forward_to_view_ratio=0.035,
            reply_to_view_ratio=0.0075,
            reaction_to_view_ratio=0.0315,
            emoji_polarity_score=0.9,
            peak_views_message_id="m1",
        ),
        propagation=TopicPropagationFeatures(
            observed_forward_count=1,
            direct_forward_ratio=0.3333,
            unique_origin_channels=["c1"],
            unique_amplifying_channels=["c2"],
            cross_channel_observed_spread=1,
            uncredited_syndication_count=1,
        ),
        temporal=TopicTemporalFeatures(
            first_published_at=dt,
            last_published_at=dt,
            timespan_seconds=300.0,
            messages_per_hour=36.0,
            peak_window_utc="2026-09-02T12:00",
            peak_window_message_count=3,
            burstiness_index=0.2,
            channel_entry_velocity=36.0,
        ),
    )

    report = TopicEnrichmentResult(
        dataset_source="test.parquet",
        total_messages_analyzed=3,
        total_topics_enriched=1,
        enriched_topics=[candidate],
        unassigned_noise_count=0,
    )

    out_file = tmp_path / "report.json"
    report.save_json(out_file)
    assert out_file.exists()

    content = json.loads(out_file.read_text(encoding="utf-8"))
    assert content["total_messages_analyzed"] == 3
    assert content["enriched_topics"][0]["topic_id"] == "topic_000"

    # Overwrite protection
    with pytest.raises(FileExistsError):
        report.save_json(out_file, overwrite=False)

    report.save_json(out_file, overwrite=True)


def test_extract_domain_from_url():
    """2. Verify root domain extraction from diverse URL formats."""
    assert extract_domain_from_url("https://www.reuters.com/world/news-123") == "reuters.com"
    assert extract_domain_from_url("http://sub.domain.t.me/post") == "sub.domain.t.me"
    assert extract_domain_from_url("https://t.me/c/123456789") == "t.me"
    assert extract_domain_from_url("not_a_url") is None


def test_extract_social_and_gazetteer_entities(sample_messages_cluster):
    """3. Verify extraction of hashtags, handles, domains, and multilingual gazetteer entities."""
    entities = extract_social_entities(sample_messages_cluster)
    texts = {e.text: e.category for e in entities}

    assert "security" in texts
    assert texts["security"] == SocialEntityCategory.HASHTAG
    assert "reuters.com" in texts
    assert texts["reuters.com"] == SocialEntityCategory.DOMAIN
    assert "c1" in texts
    assert texts["c1"] == SocialEntityCategory.HANDLE
    assert "India" in texts
    assert texts["India"] == SocialEntityCategory.GAZETTEER_GEO
    assert "Ladakh" in texts
    assert texts["Ladakh"] == SocialEntityCategory.GAZETTEER_GEO


def test_compute_engagement_features(sample_messages_cluster):
    """4. Verify deterministic sums, ratios, and peak view selection."""
    eng = compute_engagement_features(sample_messages_cluster)

    assert eng.total_views == 2000
    assert eng.total_forwards == 70
    assert eng.total_replies == 15
    assert eng.total_reactions == 63

    assert eng.forward_to_view_ratio == round(70 / 2000, 4)
    assert eng.reply_to_view_ratio == round(15 / 2000, 4)
    assert eng.reaction_to_view_ratio == round(63 / 2000, 4)
    assert eng.peak_views_message_id == "telegram:c1:101"


def test_emoji_polarity_heuristic():
    """5. Verify deterministic emoji polarity score calculation."""
    # Positive: 👍 (3), ❤️ (2) = 5
    # Negative: 👎 (1) = 1
    # Neutral / Unknown: 🤔 (2), 🦄 (2) = 4
    # Total: 10
    # Polarity: (5 - 1) / 10 = +0.4000
    dt = datetime(2026, 9, 2, 10, 0, tzinfo=timezone.utc)
    msg = CanonicalMessage(
        canonical_id="telegram:a1:1",
        platform=Platform.TELEGRAM,
        native_id="1",
        author_id="a1",
        published_at=dt,
        collected_at=dt,
        views_count=100,
        reactions={"👍": 3, "❤️": 2, "👎": 1, "🤔": 2, "🦄": 2},
    )

    eng = compute_engagement_features([msg])
    assert eng.total_reactions == 10
    assert eng.emoji_polarity_score == 0.4000


def test_missing_engagement_safe_division():
    """6. Verify missing engagement fields (views=None, reactions={}) do not cause ZeroDivisionError."""
    dt = datetime(2026, 9, 2, 10, 0, tzinfo=timezone.utc)
    msg = CanonicalMessage(
        canonical_id="telegram:a1:1",
        platform=Platform.TELEGRAM,
        native_id="1",
        author_id="a1",
        published_at=dt,
        collected_at=dt,
        views_count=None,
        forwards_count=None,
        replies_count=None,
        reactions={},
    )

    eng = compute_engagement_features([msg])
    assert eng.total_views == 0
    assert eng.total_forwards == 0
    assert eng.forward_to_view_ratio == 0.0
    assert eng.reply_to_view_ratio == 0.0
    assert eng.reaction_to_view_ratio == 0.0
    assert eng.emoji_polarity_score == 0.0
    assert eng.peak_views_message_id is None


def test_propagation_observed_features(sample_messages_cluster):
    """7. Verify observed forward count, origin channels, and cross-channel spread."""
    prop = compute_propagation_features(sample_messages_cluster)

    assert prop.observed_forward_count == 1
    assert prop.direct_forward_ratio == round(1 / 3, 4)
    assert prop.unique_origin_channels == ["c1"]
    assert prop.unique_amplifying_channels == ["c2"]
    assert prop.cross_channel_observed_spread == 1


def test_propagation_broadcasting_channel_guard():
    """7b. Verify cross-channel spread is ONLY counted when broadcasting channel is verified."""
    dt = datetime(2026, 9, 2, 10, 0, tzinfo=timezone.utc)

    # Case A: Forward from channel c1 into verified channel c2 -> cross-channel spread = 1
    m_chan = CanonicalMessage(
        canonical_id="telegram:c2:201",
        platform=Platform.TELEGRAM,
        native_id="201",
        author_id="c2",
        author_type=AuthorType.CHANNEL,
        published_at=dt,
        collected_at=dt,
        text_content="Forwarded alert",
        is_forward=True,
        origin_source_id="telegram:c1:101",
    )
    prop_chan = compute_propagation_features([m_chan])
    assert prop_chan.observed_forward_count == 1
    assert prop_chan.unique_amplifying_channels == ["c2"]
    assert prop_chan.cross_channel_observed_spread == 1

    # Case B: Forward by a USER account -> broadcasting channel identity cannot be reliably known
    m_user = CanonicalMessage(
        canonical_id="telegram:u9:901",
        platform=Platform.TELEGRAM,
        native_id="901",
        author_id="u9",
        author_type=AuthorType.USER,
        published_at=dt,
        collected_at=dt,
        text_content="Forwarded alert to friend",
        is_forward=True,
        origin_source_id="telegram:c1:101",
    )
    prop_user = compute_propagation_features([m_user])
    assert prop_user.observed_forward_count == 1
    assert prop_user.unique_amplifying_channels == []  # Not a channel
    assert prop_user.cross_channel_observed_spread == 0  # NOT classified as cross-channel

    # Case C: Forward from same channel c1 to c1 (re-posting own content) -> cross-channel spread = 0
    m_self = CanonicalMessage(
        canonical_id="telegram:c1:102",
        platform=Platform.TELEGRAM,
        native_id="102",
        author_id="c1",
        author_type=AuthorType.CHANNEL,
        published_at=dt,
        collected_at=dt,
        text_content="Self-forwarded alert",
        is_forward=True,
        origin_source_id="telegram:c1:101",
    )
    prop_self = compute_propagation_features([m_self])
    assert prop_self.observed_forward_count == 1
    assert prop_self.cross_channel_observed_spread == 0


def test_configurable_syndication_detection_thresholds():
    """8. Verify configurable syndication thresholds (0.90, 0.92, 0.95, 0.98) change classification."""
    dt = datetime(2026, 9, 2, 10, 0, tzinfo=timezone.utc)

    # Construct realistic synthetic cases:
    # m0: Original post by chanA
    # m1: Exact duplicate text by chanB (non-forward) -> sim = 1.00
    # m2: Minor rephrasing by chanC (non-forward) -> sim = 0.96
    # m3: Semantically similar but distinct text by chanD (non-forward) -> sim = 0.91
    # m4: Clearly unrelated text by chanE (non-forward) -> sim = 0.20
    # m5: Forwarded message by chanF with explicit attribution -> should NEVER be flagged as uncredited syndication
    # m6: Duplicate text by chanA (same author) -> should NOT be flagged as cross-channel syndication
    msgs = [
        CanonicalMessage(
            canonical_id="telegram:chanA:101",
            platform=Platform.TELEGRAM,
            native_id="101",
            author_id="chanA",
            author_type=AuthorType.CHANNEL,
            published_at=dt,
            collected_at=dt,
            text_content="Security alert: Border Patrol deployed new radar at northern outpost.",
            is_forward=False,
            origin_source_id=None,
        ),
        CanonicalMessage(
            canonical_id="telegram:chanB:201",
            platform=Platform.TELEGRAM,
            native_id="201",
            author_id="chanB",
            author_type=AuthorType.CHANNEL,
            published_at=dt,
            collected_at=dt,
            text_content="Security alert: Border Patrol deployed new radar at northern outpost.",  # Exact duplicate
            is_forward=False,
            origin_source_id=None,
        ),
        CanonicalMessage(
            canonical_id="telegram:chanC:301",
            platform=Platform.TELEGRAM,
            native_id="301",
            author_id="chanC",
            author_type=AuthorType.CHANNEL,
            published_at=dt,
            collected_at=dt,
            text_content="Security alert: Border Patrol has deployed new radar at northern outpost.",  # Minor rephrase
            is_forward=False,
            origin_source_id=None,
        ),
        CanonicalMessage(
            canonical_id="telegram:chanD:401",
            platform=Platform.TELEGRAM,
            native_id="401",
            author_id="chanD",
            author_type=AuthorType.CHANNEL,
            published_at=dt,
            collected_at=dt,
            text_content="Surveillance forces stepped up border radar monitoring along frontier line.",  # Semantically similar
            is_forward=False,
            origin_source_id=None,
        ),
        CanonicalMessage(
            canonical_id="telegram:chanE:501",
            platform=Platform.TELEGRAM,
            native_id="501",
            author_id="chanE",
            author_type=AuthorType.CHANNEL,
            published_at=dt,
            collected_at=dt,
            text_content="Manchester United takes dramatic derby victory! ⚽ #PremierLeague",  # Unrelated
            is_forward=False,
            origin_source_id=None,
        ),
        CanonicalMessage(
            canonical_id="telegram:chanF:601",
            platform=Platform.TELEGRAM,
            native_id="601",
            author_id="chanF",
            author_type=AuthorType.CHANNEL,
            published_at=dt,
            collected_at=dt,
            text_content="Forwarded alert",
            is_forward=True,
            origin_source_id="telegram:chanA:101",  # Explicit attribution forward
        ),
        CanonicalMessage(
            canonical_id="telegram:chanA:102",
            platform=Platform.TELEGRAM,
            native_id="102",
            author_id="chanA",
            author_type=AuthorType.CHANNEL,
            published_at=dt,
            collected_at=dt,
            text_content="Security alert: Border Patrol deployed new radar at northern outpost.",  # Same author
            is_forward=False,
            origin_source_id=None,
        ),
    ]

    # Synthesize orthogonal unit embeddings representing exact similarities:
    # m0: e0
    # m1 (exact): e0 -> sim = 1.00
    # m2 (rephrase): 0.96*e0 + sqrt(1-0.96^2)*e2 -> sim(m0, m2) = 0.96
    # m3 (similar): 0.91*e0 + sqrt(1-0.91^2)*e3 -> sim(m0, m3) = 0.91, sim(m2, m3) = 0.87
    # m4 (unrelated): 0.20*e0 + sqrt(1-0.20^2)*e4 -> sim(m0, m4) = 0.20
    # m5 (forward): e0 (excluded by is_forward=True)
    # m6 (same author): e0 (excluded by author_id == chanA)
    import numpy as np

    def make_vec(sim: float, dim_idx: int) -> list[float]:
        vec = [0.0] * 6
        vec[0] = sim
        rem = math.sqrt(max(1.0 - sim**2, 0.0))
        if dim_idx > 0 and rem > 0:
            vec[dim_idx] = rem
        return vec

    embeds = np.array([
        make_vec(1.00, 0),  # m0
        make_vec(1.00, 0),  # m1 exact duplicate
        make_vec(0.96, 2),  # m2 minor rephrase
        make_vec(0.91, 3),  # m3 semantically similar
        make_vec(0.20, 4),  # m4 unrelated
        make_vec(1.00, 0),  # m5 forward
        make_vec(1.00, 0),  # m6 same author
    ], dtype=np.float32)

    # 1. Strict threshold = 0.98: ONLY exact duplicate (m1) should be flagged
    prop_98 = compute_propagation_features(msgs, embeddings=embeds, syndication_similarity_threshold=0.98)
    assert prop_98.uncredited_syndication_count == 1

    # 2. Threshold = 0.95: Both exact duplicate (m1) and minor rephrase (m2) should be flagged
    prop_95 = compute_propagation_features(msgs, embeddings=embeds, syndication_similarity_threshold=0.95)
    assert prop_95.uncredited_syndication_count == 2

    # 3. Default threshold = 0.92: Still flags exact duplicate (m1) and minor rephrase (m2) (0.96 >= 0.92)
    prop_92 = compute_propagation_features(msgs, embeddings=embeds, syndication_similarity_threshold=0.92)
    assert prop_92.uncredited_syndication_count == 2

    # 4. Lenient threshold = 0.90: Exact duplicate (m1), rephrase (m2), AND semantically similar (m3) flagged
    prop_90 = compute_propagation_features(msgs, embeddings=embeds, syndication_similarity_threshold=0.90)
    assert prop_90.uncredited_syndication_count == 3


def test_temporal_features_standard_cluster(sample_messages_cluster):
    """9. Verify timespan, cadence, peak hour, and burstiness index for standard 3-message cluster."""
    temp = compute_temporal_features(sample_messages_cluster)

    assert temp.timespan_seconds == 300.0  # 10:00 to 10:05
    # 3 messages in 300 seconds (0.0833h) -> 3 / (300/3600) = 36.0 msg/h
    assert temp.messages_per_hour == 36.0
    assert temp.peak_window_utc == "2026-09-02T10:00"
    assert temp.peak_window_message_count == 3
    assert temp.burstiness_index is not None
    assert -1.0 <= temp.burstiness_index <= 1.0


def test_temporal_single_message_edge_case():
    """9b. Verify single-message cluster yields None for cadence, burstiness, and velocity."""
    dt = datetime(2026, 9, 2, 10, 0, tzinfo=timezone.utc)
    m = CanonicalMessage(
        canonical_id="telegram:c1:1",
        platform=Platform.TELEGRAM,
        native_id="1",
        author_id="c1",
        author_type=AuthorType.CHANNEL,
        published_at=dt,
        collected_at=dt,
    )

    temp = compute_temporal_features([m])
    assert temp.timespan_seconds == 0.0
    assert temp.messages_per_hour is None
    assert temp.burstiness_index is None
    assert temp.channel_entry_velocity is None
    assert temp.peak_window_utc == "2026-09-02T10:00"
    assert temp.peak_window_message_count == 1


def test_temporal_two_messages_edge_case():
    """9c. Verify two-message cluster computes cadence but yields None for burstiness (<3 messages)."""
    dt1 = datetime(2026, 9, 2, 10, 0, tzinfo=timezone.utc)
    dt2 = datetime(2026, 9, 2, 11, 0, tzinfo=timezone.utc)  # 1 hour later
    m1 = CanonicalMessage(
        canonical_id="telegram:c1:1",
        platform=Platform.TELEGRAM,
        native_id="1",
        author_id="c1",
        author_type=AuthorType.CHANNEL,
        published_at=dt1,
        collected_at=dt1,
    )
    m2 = CanonicalMessage(
        canonical_id="telegram:c2:2",
        platform=Platform.TELEGRAM,
        native_id="2",
        author_id="c2",
        author_type=AuthorType.CHANNEL,
        published_at=dt2,
        collected_at=dt2,
    )

    temp = compute_temporal_features([m1, m2])
    assert temp.timespan_seconds == 3600.0
    assert temp.messages_per_hour == 2.0  # 2 msgs / 1 hour
    assert temp.burstiness_index is None  # Insufficient inter-arrival intervals
    assert temp.channel_entry_velocity == 2.0  # 2 channels / 1 hour


def test_temporal_identical_timestamps_edge_case():
    """9d. Verify cluster with identical timestamps yields None for rates and burstiness (0s duration)."""
    dt = datetime(2026, 9, 2, 10, 0, tzinfo=timezone.utc)
    msgs = [
        CanonicalMessage(
            canonical_id=f"telegram:c1:{i}",
            platform=Platform.TELEGRAM,
            native_id=str(i),
            author_id="c1",
            author_type=AuthorType.CHANNEL,
            published_at=dt,
            collected_at=dt,
        )
        for i in range(1, 4)
    ]

    temp = compute_temporal_features(msgs)
    assert temp.timespan_seconds == 0.0
    assert temp.messages_per_hour is None
    assert temp.burstiness_index is None
    assert temp.channel_entry_velocity is None
    assert temp.peak_window_message_count == 3


def test_temporal_multiple_messages_over_time_regular():
    """9e. Verify perfectly regular posting intervals yield burstiness index of -1.0."""
    # 4 messages arriving at exactly 60-second intervals
    dt0 = datetime(2026, 9, 2, 10, 0, 0, tzinfo=timezone.utc)
    msgs = [
        CanonicalMessage(
            canonical_id=f"telegram:c1:{i}",
            platform=Platform.TELEGRAM,
            native_id=str(i),
            author_id="c1",
            author_type=AuthorType.CHANNEL,
            published_at=datetime.fromtimestamp(dt0.timestamp() + (i * 60), tz=timezone.utc),
            collected_at=dt0,
        )
        for i in range(4)
    ]

    temp = compute_temporal_features(msgs)
    assert temp.timespan_seconds == 180.0
    assert temp.burstiness_index == -1.0000  # sigma = 0, mu = 60 -> (0 - 60)/(0 + 60) = -1.0


def test_enrich_topics_orchestration(sample_messages_cluster):
    """10. Verify complete enrich_topics orchestration."""
    topic_rec = TopicRecord(
        topic_id="topic_000",
        cluster_label=0,
        message_count=3,
        percentage_of_dataset=100.0,
        representative_keywords=[TopicKeyword(keyword="border", score=1.0)],
        representative_message_ids=["telegram:c1:101"],
        sample_message_ids=["telegram:c1:101", "telegram:c2:201", "telegram:c3:301"],
    )

    topic_res = TopicDiscoveryResult(
        model_id="test-model",
        embedding_dimension=384,
        total_input_messages=3,
        clustered_messages=3,
        noise_messages=0,
        number_of_topics=1,
        topic_records=[topic_rec],
        noise_message_ids=[],
        clustering_config=ClusteringConfig(min_cluster_size=2, min_samples=1),
        embedding_time_seconds=0.125,
        clustering_time_seconds=0.015,
        total_time_seconds=0.140,
    )

    result = enrich_topics(
        messages=sample_messages_cluster,
        topic_result=topic_res,
        dataset_source="sample_test",
    )

    assert result.total_messages_analyzed == 3
    assert result.total_topics_enriched == 1
    assert len(result.enriched_topics) == 1
    assert result.topic_discovery_latency_seconds == 0.125
    assert result.clustering_latency_seconds == 0.015
    assert result.enrichment_latency_seconds >= 0.0
    assert result.total_pipeline_latency_seconds is not None

    candidate = result.enriched_topics[0]
    assert candidate.topic_id == "topic_000"
    assert candidate.engagement.total_views == 2000
    assert candidate.propagation.observed_forward_count == 1
    assert candidate.temporal.timespan_seconds == 300.0
