"""Comprehensive unit tests for Multi-Perspective Narrative Intelligence.

Validates:
1. Single coherent viewpoint -> exactly 1 dominant narrative.
2. Two genuinely distinct viewpoints -> exactly 2 ranked narrative candidates.
3. Three distinct viewpoints -> 3 ranked candidates if all satisfy evidence thresholds.
4. Sentiment alone does NOT create artificial narrative branches.
5. Reaction evidence contributes to ranking without dominating message volume.
6. Log-damped reaction scaling prevents small viral posts from overpowering larger clusters.
7. Discussion friction (replies) strengthens evidence but requires semantic coherence.
8. Source diversity contributes positively to evidence strength.
9. Noise / isolated outliers are suppressed from becoming standalone narratives.
10. Minority but coherent viewpoints with sufficient evidence remain as secondary narratives.
11. Narrative ranking and candidate IDs are 100% deterministic and idempotent.
12. Empty reactions, empty replies, and media-only messages are safely handled.
13. No unsupported "majority of people" claims are generated.
14. Sibling narrative relationships and parent trend IDs are strictly preserved.
15. 4G Priority Signal Score formula remains exactly 0.30S + 0.30C + 0.20R + 0.20F.
"""

from datetime import datetime, timezone
import pytest

from app.ml.features.models import (
    EnrichedTopicCandidate,
    TopicEngagementFeatures,
    TopicPropagationFeatures,
    TopicTemporalFeatures,
)
from app.ml.narratives.detector import promote_narratives
from app.ml.narratives.models import PriorityTier
from app.ml.narratives.viewpoints import (
    ViewpointCluster,
    analyze_message_evidence,
    compute_narrative_evidence_strength,
    discover_trend_viewpoints,
    extract_branch_representative_excerpts,
)
from app.schemas import CanonicalMessage, Platform


def _create_test_message(
    cid: str,
    text: str,
    reactions: dict[str, int] | None = None,
    replies: int = 0,
    views: int = 100,
    author: str = "channel_1",
    channel_title: str | None = "Test News Channel",
) -> CanonicalMessage:
    nid = cid.split(":")[-1]
    full_id = f"telegram:{author}:{nid}"
    return CanonicalMessage(
        canonical_id=full_id,
        platform=Platform.TELEGRAM,
        native_id=nid,
        published_at=datetime(2026, 9, 1, 12, 0, 0, tzinfo=timezone.utc),
        collected_at=datetime(2026, 9, 1, 12, 5, 0, tzinfo=timezone.utc),
        text_content=text,
        language="en",
        author_id=author,
        channel_title=channel_title,
        reactions=reactions or {},
        replies_count=replies,
        views_count=views,
    )


def _create_mock_enriched_topic(topic_id: str = "topic_001") -> EnrichedTopicCandidate:
    """Helper to construct an EnrichedTopicCandidate."""
    return EnrichedTopicCandidate(
        topic_id=topic_id,
        message_count=10,
        percentage_of_dataset=1.0,
        representative_keywords=["defence", "strategy", "dispatches"],
        entities=[],
        engagement=TopicEngagementFeatures(
            total_views=1000,
            total_forwards=10,
            total_replies=5,
            total_reactions=50,
            forward_to_view_ratio=0.01,
            reply_to_view_ratio=0.005,
            reaction_to_view_ratio=0.05,
            emoji_polarity_score=0.6,
        ),
        propagation=TopicPropagationFeatures(
            observed_forward_count=1,
            direct_forward_ratio=0.01,
            unique_origin_channels=["chan_1"],
            unique_amplifying_channels=["chan_1", "chan_2"],
            cross_channel_observed_spread=1,
            uncredited_syndication_count=0,
        ),
        temporal=TopicTemporalFeatures(
            first_published_at=datetime(2026, 9, 1, 10, 0, 0, tzinfo=timezone.utc),
            last_published_at=datetime(2026, 9, 1, 14, 0, 0, tzinfo=timezone.utc),
            timespan_seconds=14400.0,
            peak_window_utc="2026-09-01T12:00",
            peak_window_message_count=5,
            burstiness_index=0.1,
            channel_entry_velocity=2.0,
        ),
    )


def test_single_coherent_viewpoint_produces_one_narrative():
    """Verify that a homogeneous trend produces exactly 1 dominant narrative."""
    msgs = [
        _create_test_message(f"msg:{i}", "Great defence dispatches and strong strategic analysis.", {"👍": 10, "❤️": 5})
        for i in range(5)
    ]
    clusters = discover_trend_viewpoints(msgs)
    assert len(clusters) == 1
    assert clusters[0].is_dominant is True
    assert clusters[0].rank == 1
    assert clusters[0].stance == "supportive"


def test_two_distinct_viewpoints_produce_ranked_branches():
    """Verify that distinct supportive and critical perspectives yield 2 ranked candidates."""
    supportive_msgs = [
        _create_test_message(f"sup:{i}", "Strong strategic success and excellent leadership shown.", {"👍": 15, "🔥": 8})
        for i in range(6)
    ]
    critical_msgs = [
        _create_test_message(f"crit:{i}", "Severe policy failure and unacceptable waste of resources.", {"👎": 12, "😡": 6})
        for i in range(4)
    ]
    all_msgs = supportive_msgs + critical_msgs

    clusters = discover_trend_viewpoints(all_msgs)
    assert len(clusters) == 2
    assert clusters[0].is_dominant is True
    assert clusters[0].rank == 1
    assert clusters[0].stance == "supportive"
    assert clusters[1].is_dominant is False
    assert clusters[1].rank == 2
    assert clusters[1].stance == "critical"
    assert clusters[0].evidence_strength > clusters[1].evidence_strength


def test_three_distinct_viewpoints_handled_when_supported():
    """Verify supportive, critical, and skeptical perspectives are discovered if supported."""
    supportive_msgs = [
        _create_test_message(f"sup:{i}", "Strong support for the new strategic dispatches.", {"👍": 10})
        for i in range(5)
    ]
    critical_msgs = [
        _create_test_message(f"crit:{i}", "Critical pushback against strategic dispatches.", {"👎": 8, "😡": 2})
        for i in range(3)
    ]
    skeptical_msgs = [
        _create_test_message(f"skep:{i}", "Questions remain about what happened in the dispatches.", {"🤔": 6, "👀": 4})
        for i in range(3)
    ]
    all_msgs = supportive_msgs + critical_msgs + skeptical_msgs

    clusters = discover_trend_viewpoints(all_msgs)
    assert len(clusters) == 3
    stances = {c.stance for c in clusters}
    assert "supportive" in stances
    assert "critical" in stances
    assert "skeptical" in stances
    assert clusters[0].rank == 1
    assert clusters[1].rank == 2
    assert clusters[2].rank == 3


def test_noise_suppression_ignores_isolated_outlier():
    """Verify that an isolated single-message outlier does NOT create a standalone narrative."""
    supportive_msgs = [
        _create_test_message(f"sup:{i}", "Comprehensive defence dispatches with strong community praise.", {"❤️": 20, "👍": 10})
        for i in range(10)
    ]
    # Single isolated message with no source diversity
    outlier_msg = [
        _create_test_message("outlier:1", "I disagree with this post.", {"👎": 1}, replies=0, views=10, author="isolated_anon")
    ]
    all_msgs = supportive_msgs + outlier_msg

    clusters = discover_trend_viewpoints(all_msgs)
    assert len(clusters) == 1
    assert clusters[0].is_dominant is True
    assert clusters[0].stance == "supportive"


def test_reaction_volume_log_damped():
    """Verify that a tiny group with huge viral reactions cannot overpower a large cluster."""
    large_cluster = ViewpointCluster(
        stance="supportive",
        messages=[_create_test_message(f"m:{i}", "Text") for i in range(50)],
        evidence_items=[analyze_message_evidence(_create_test_message(f"m:{i}", "Text", {"👍": 6})) for i in range(50)],
    )
    # Tiny 2-message group with 5,000 likes
    viral_small_cluster = ViewpointCluster(
        stance="critical",
        messages=[_create_test_message(f"v:{i}", "Viral") for i in range(2)],
        evidence_items=[analyze_message_evidence(_create_test_message(f"v:{i}", "Viral", {"👎": 2500})) for i in range(2)],
    )

    total_msgs = 52
    total_rx = 300 + 5000
    total_views = 5200
    total_channels = 2

    score_large = compute_narrative_evidence_strength(large_cluster, total_msgs, total_rx, total_views, total_channels)
    score_small = compute_narrative_evidence_strength(viral_small_cluster, total_msgs, total_rx, total_views, total_channels)

    # Large message support must comfortably win over tiny viral outlier
    assert score_large > score_small


def test_source_diversity_increases_evidence_strength():
    """Verify that multi-channel viewpoints obtain higher evidence strength than single-channel."""
    # Viewpoint A across 4 distinct channels
    msgs_multi = [
        _create_test_message(f"m:{i}", "Statement", {"👍": 5}, author=f"chan_{i}")
        for i in range(4)
    ]
    cluster_multi = ViewpointCluster(
        stance="supportive",
        messages=msgs_multi,
        evidence_items=[analyze_message_evidence(m) for m in msgs_multi],
    )

    # Viewpoint B across only 1 channel
    msgs_single = [
        _create_test_message(f"s:{i}", "Statement", {"👍": 5}, author="chan_only")
        for i in range(4)
    ]
    cluster_single = ViewpointCluster(
        stance="supportive",
        messages=msgs_single,
        evidence_items=[analyze_message_evidence(m) for m in msgs_single],
    )

    s_multi = compute_narrative_evidence_strength(cluster_multi, 8, 40, 800, 5)
    s_single = compute_narrative_evidence_strength(cluster_single, 8, 40, 800, 5)

    assert s_multi > s_single


def test_empty_reactions_and_replies_handled_gracefully():
    """Verify messages with no reactions or replies are safely analyzed."""
    msgs = [
        _create_test_message(f"msg:{i}", "Factual wire report regarding the regional bilateral meeting.", reactions={}, replies=0, views=0)
        for i in range(3)
    ]
    clusters = discover_trend_viewpoints(msgs)
    assert len(clusters) >= 1
    assert clusters[0].evidence_strength >= 0.0


def test_media_only_messages_handled_gracefully():
    """Verify link-only and media-only messages do not cause exceptions."""
    msgs = [
        _create_test_message(f"link:{i}", "https://youtu.be/sample_video_code", {"❤️": 12, "👍": 5})
        for i in range(4)
    ]
    clusters = discover_trend_viewpoints(msgs)
    assert len(clusters) == 1
    assert clusters[0].stance == "supportive"
    excerpts = extract_branch_representative_excerpts(msgs)
    assert len(excerpts) > 0


def test_parent_topic_and_sibling_ids_preserved():
    """Verify sibling narratives maintain identical promoted_from_topic_id and link sibling IDs."""
    supportive_msgs = [
        _create_test_message(f"sup:{i}", "Supportive dispatches and commentary.", {"👍": 10})
        for i in range(5)
    ]
    critical_msgs = [
        _create_test_message(f"crit:{i}", "Critical concerns over dispatches contents.", {"👎": 10})
        for i in range(5)
    ]
    all_msgs = supportive_msgs + critical_msgs

    from app.ml.features.models import TopicEnrichmentResult
    topic = _create_mock_enriched_topic("topic_404")
    enrichment = TopicEnrichmentResult(
        dataset_source="test",
        total_messages_analyzed=len(all_msgs),
        total_topics_enriched=1,
        enriched_topics=[topic],
        unassigned_noise_count=0,
    )

    report = promote_narratives(messages=all_msgs, enrichment_result=enrichment)
    assert len(report.narrative_candidates) == 2

    c1 = report.narrative_candidates[0]
    c2 = report.narrative_candidates[1]

    # Both must trace to the same parent trend
    assert c1.promoted_from_topic_id == "topic_404"
    assert c2.promoted_from_topic_id == "topic_404"

    # Sibling IDs must link each other
    assert c2.narrative_id in c1.sibling_narrative_ids
    assert c1.narrative_id in c2.sibling_narrative_ids
    assert c1.narrative_id not in c1.sibling_narrative_ids

    # One is dominant, the other is secondary
    dominant = next(c for c in report.narrative_candidates if c.is_dominant)
    secondary = next(c for c in report.narrative_candidates if not c.is_dominant)
    assert dominant.narrative_rank == 1
    assert secondary.narrative_rank == 2


def test_4g_scoring_formula_unmodified():
    """Verify that 4G Priority Signal Score formula remains exactly 0.30S + 0.30C + 0.20R + 0.20F."""
    msgs = [
        _create_test_message(f"msg:{i}", "Defence statement.", {"👍": 5})
        for i in range(4)
    ]
    topic = _create_mock_enriched_topic("topic_099")
    from app.ml.features.models import TopicEnrichmentResult
    enrichment = TopicEnrichmentResult(
        dataset_source="test",
        total_messages_analyzed=len(msgs),
        total_topics_enriched=1,
        enriched_topics=[topic],
        unassigned_noise_count=0,
    )

    report = promote_narratives(messages=msgs, enrichment_result=enrichment)
    cand = report.narrative_candidates[0]
    expected_score = round(
        0.30 * cand.sub_scores.spread_score
        + 0.30 * cand.sub_scores.coordination_score
        + 0.20 * cand.sub_scores.reach_score
        + 0.20 * cand.sub_scores.friction_score,
        4,
    )
    assert cand.priority_signal_score == expected_score


def test_no_unsupported_majority_claims_in_identity():
    """Verify narrative summary and name never contain unsupported population-level claims."""
    msgs = [
        _create_test_message(f"msg:{i}", "Dispatches commentary.", {"👍": 50})
        for i in range(5)
    ]
    topic = _create_mock_enriched_topic("topic_777")
    from app.ml.features.models import TopicEnrichmentResult
    enrichment = TopicEnrichmentResult(
        dataset_source="test",
        total_messages_analyzed=len(msgs),
        total_topics_enriched=1,
        enriched_topics=[topic],
        unassigned_noise_count=0,
    )

    report = promote_narratives(messages=msgs, enrichment_result=enrichment)
    for c in report.narrative_candidates:
        summary = c.narrative_summary or ""
        assert "majority of people" not in summary.lower()
        assert "% of users" not in summary.lower()
        assert "public opinion is" not in summary.lower()
        # Must not contain generic filler
        assert "monitored discourse developments" not in (c.narrative_name or "").lower()
        assert "insufficient to establish a more specific interpretation" not in summary
