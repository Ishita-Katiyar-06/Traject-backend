from datetime import datetime, timezone
import json
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from app.ml.features.models import (
    EnrichedTopicCandidate,
    SocialEntityCategory,
    TopicEngagementFeatures,
    TopicEntity,
    TopicPropagationFeatures,
    TopicTemporalFeatures,
)
from app.ml.narratives.framing import (
    compute_data_coverage,
    extract_representative_excerpts,
    synthesize_headline_claim,
)
from app.ml.narratives.models import (
    EvidenceDensityTier,
    NarrativeAssessmentReport,
    NarrativeCandidate,
    NarrativeDataCoverage,
    NarrativeSentimentProfile,
    NarrativeSubScores,
    PotentialCoordinationSignals,
    PriorityTier,
)
from app.ml.narratives.scoring import (
    DEFAULT_SCORING_WEIGHTS,
    assign_priority_tier,
    compute_coordination_score,
    compute_friction_score,
    compute_priority_signal_score,
    compute_reach_score,
    compute_spread_score,
)
from app.ml.narratives.sentiment_fusion import evaluate_cluster_sentiment
from app.ml.narratives.signals import (
    extract_potential_coordination_signals,
    generate_signal_audit_notes,
)
from app.ml.sentiment.models import SentimentLabel, SentimentPrediction
from app.schemas import AuthorType, CanonicalMessage, Platform


@pytest.fixture
def mock_enriched_topic():
    """Build a rich synthetic EnrichedTopicCandidate for deterministic testing."""
    dt1 = datetime(2026, 9, 2, 10, 0, 0, tzinfo=timezone.utc)
    dt2 = datetime(2026, 9, 2, 10, 30, 0, tzinfo=timezone.utc)

    return EnrichedTopicCandidate(
        topic_id="topic_000",
        message_count=6,
        percentage_of_dataset=60.0,
        representative_keywords=["security", "radar", "outpost", "patrol", "border"],
        entities=[
            TopicEntity(text="Ladakh", category=SocialEntityCategory.GAZETTEER_GEO, frequency=4),
            TopicEntity(text="security", category=SocialEntityCategory.HASHTAG, frequency=5),
            TopicEntity(text="reuters.com", category=SocialEntityCategory.DOMAIN, frequency=2),
        ],
        engagement=TopicEngagementFeatures(
            total_views=10000,
            total_forwards=500,
            total_replies=40,
            total_reactions=300,
            forward_to_view_ratio=0.0500,
            reply_to_view_ratio=0.0040,
            reaction_to_view_ratio=0.0300,
            emoji_polarity_score=-0.2500,  # Negative reaction skew
            peak_views_message_id="telegram:c1:101",
        ),
        propagation=TopicPropagationFeatures(
            observed_forward_count=2,
            direct_forward_ratio=0.3333,
            unique_origin_channels=["c1"],
            unique_amplifying_channels=["c2", "c3"],
            cross_channel_observed_spread=2,
            uncredited_syndication_count=1,
        ),
        temporal=TopicTemporalFeatures(
            first_published_at=dt1,
            last_published_at=dt2,
            timespan_seconds=1800.0,
            messages_per_hour=12.0,
            peak_window_utc="2026-09-02T10:00",
            peak_window_message_count=6,
            burstiness_index=0.2500,
            channel_entry_velocity=6.0,
        ),
    )


def test_narrative_models_serialization(tmp_path, mock_enriched_topic):
    """1. Verify Pydantic serialization and overwrite guard of NarrativeAssessmentReport."""
    dt = datetime(2026, 9, 2, 12, 0, tzinfo=timezone.utc)

    sub_scores = NarrativeSubScores(
        spread_score=0.60,
        coordination_score=0.45,
        reach_score=0.70,
        friction_score=0.30,
    )

    signals = PotentialCoordinationSignals(
        potential_syndication_spike=True,
        potential_temporal_burst=True,
        potential_rapid_channel_entry=False,
        potential_cross_channel_cascade=True,
    )

    coverage = NarrativeDataCoverage(
        message_count=6,
        channel_count=3,
        timespan_seconds=1800.0,
        has_views_coverage=True,
        has_reactions_coverage=True,
        evidence_density=EvidenceDensityTier.MODERATE,
        data_quality_notes=[],
    )

    sentiment = NarrativeSentimentProfile(
        is_available=True,
        total_text_messages_evaluated=6,
        text_positive_ratio=0.20,
        text_neutral_ratio=0.50,
        text_negative_ratio=0.30,
        emoji_polarity_score=-0.25,
        sentiment_model_id="test-model",
    )

    candidate = NarrativeCandidate(
        narrative_id="narrative_000",
        promoted_from_topic_id="topic_000",
        headline_claim="[Ladakh, #security] security, radar, outpost",
        priority_signal_score=0.5250,
        priority_tier=PriorityTier.ELEVATED,
        sub_scores=sub_scores,
        coordination_signals=signals,
        data_coverage=coverage,
        sentiment_profile=sentiment,
        key_entities=["geo:Ladakh", "hashtag:security"],
        broadcasting_channels=["c2", "c3"],
        origin_channels=["c1"],
        representative_message_excerpts=["Radar outpost deployed."],
        first_observed_at=dt,
        last_observed_at=dt,
        audit_rationale=["Component attribution: Spread 0.60, Coordination 0.45."],
    )

    report = NarrativeAssessmentReport(
        dataset_source="test_source",
        total_messages_analyzed=6,
        total_narrative_candidates=1,
        candidates_by_tier={"elevated": 1},
        narrative_candidates=[candidate],
        unassigned_noise_count=0,
    )

    out_file = tmp_path / "narratives.json"
    report.save_json(out_file)
    assert out_file.exists()

    with open(out_file, encoding="utf-8") as f:
        data = json.load(f)
    assert data["total_narrative_candidates"] == 1
    assert data["narrative_candidates"][0]["narrative_id"] == "narrative_000"

    with pytest.raises(FileExistsError):
        report.save_json(out_file, overwrite=False)

    report.save_json(out_file, overwrite=True)


def test_scoring_bounds_and_formulas(mock_enriched_topic):
    """2. Verify each sub-score and composite score resides strictly in [0.0, 1.0] and matches approved formulas."""
    s_spread = compute_spread_score(mock_enriched_topic)
    assert 0.0 <= s_spread <= 1.0
    # Exact: 0.50 * (2/3) + 0.30 * 0.3333 + 0.20 * (2/3) = 0.5667
    assert s_spread == 0.5667

    s_coord = compute_coordination_score(mock_enriched_topic)
    assert 0.0 <= s_coord <= 1.0
    # Exact: 0.50 * min((1/4)*2.0, 1.0) + 0.30 * ((0.25+1)/2) + 0.20 * (6/10)
    # = 0.50 * 0.50 + 0.30 * 0.625 + 0.20 * 0.60 = 0.25 + 0.1875 + 0.12 = 0.5575
    assert s_coord == 0.5575

    s_reach = compute_reach_score(mock_enriched_topic)
    assert 0.0 <= s_reach <= 1.0
    # Exact: 0.60 * (log10(10000)/6.0) + 0.40 * (0.0500/0.08)
    # = 0.60 * (4/6) + 0.40 * 0.625 = 0.40 + 0.25 = 0.6500
    assert s_reach == 0.6500

    sentiment_avail = NarrativeSentimentProfile(
        is_available=True,
        total_text_messages_evaluated=6,
        text_positive_ratio=0.10,
        text_neutral_ratio=0.40,
        text_negative_ratio=0.50,
        emoji_polarity_score=-0.25,
        sentiment_model_id="test",
    )
    s_friction = compute_friction_score(mock_enriched_topic, sentiment_avail)
    assert 0.0 <= s_friction <= 1.0
    # Exact: 0.45 * 0.50 + 0.35 * 0.25 + 0.20 * (0.0040 / 0.04)
    # = 0.225 + 0.0875 + 0.02 = 0.3325
    assert s_friction == 0.3325

    sub_scores = NarrativeSubScores(
        spread_score=s_spread,
        coordination_score=s_coord,
        reach_score=s_reach,
        friction_score=s_friction,
    )
    priority_score = compute_priority_signal_score(sub_scores)
    assert 0.0 <= priority_score <= 1.0
    # Exact: 0.30 * 0.5667 + 0.30 * 0.5575 + 0.20 * 0.6500 + 0.20 * 0.3325
    # = 0.17001 + 0.16725 + 0.1300 + 0.0665 = 0.5338
    assert priority_score == 0.5338
    assert assign_priority_tier(priority_score) == PriorityTier.ELEVATED


def test_scoring_syndication_clamping_and_extreme_bounds(mock_enriched_topic):
    """Verify explicit clamping of syndication_ratio in [0.0, 1.0] and configurable constants."""
    dt = datetime(2026, 9, 2, 10, 0, tzinfo=timezone.utc)
    # Case where uncredited syndication count exceeds non-forward count
    extreme_topic = EnrichedTopicCandidate(
        topic_id="t_extreme",
        message_count=3,
        percentage_of_dataset=100.0,
        representative_keywords=["test"],
        entities=[],
        engagement=TopicEngagementFeatures(
            total_views=10_000_000,  # > 1M views -> capped at 1.0
            total_forwards=1000,
            total_replies=500,
            total_reactions=500,
            forward_to_view_ratio=0.20,  # > 0.08 -> capped at 1.0
            reply_to_view_ratio=0.10,    # > 0.04 -> capped at 1.0
            reaction_to_view_ratio=0.05,
            emoji_polarity_score=-1.0,   # -1.0 -> emoji_neg = 1.0
            peak_views_message_id=None,
        ),
        propagation=TopicPropagationFeatures(
            observed_forward_count=1,
            direct_forward_ratio=1.0,
            unique_origin_channels=["c1"],
            unique_amplifying_channels=["c2", "c3", "c4", "c5"],  # > 3 -> capped at 1.0
            cross_channel_observed_spread=5,                      # > 3 -> capped at 1.0
            uncredited_syndication_count=10,  # 10 > (3 - 1) = 2 non-forwards -> raw ratio = 5.0
        ),
        temporal=TopicTemporalFeatures(
            first_published_at=dt,
            last_published_at=dt,
            timespan_seconds=3600.0,
            messages_per_hour=3.0,
            peak_window_utc="2026-09-02T10:00",
            peak_window_message_count=3,
            burstiness_index=1.0,          # max burst -> (1+1)/2 = 1.0
            channel_entry_velocity=25.0,   # > 10 -> capped at 1.0
        ),
    )

    # Spread should be cleanly 1.0000
    assert compute_spread_score(extreme_topic) == 1.0000

    # Coordination: syndication_ratio clamped to 1.0 -> term_synd = min(1.0 * 2.0, 1.0) = 1.0
    # term_burst = 1.0, term_velocity = 1.0 -> score = 0.50 + 0.30 + 0.20 = 1.0000
    assert compute_coordination_score(extreme_topic) == 1.0000

    # Reach: views > 1M capped at 1.0, fwd_ratio > 0.08 capped at 1.0 -> 0.60 + 0.40 = 1.0000
    assert compute_reach_score(extreme_topic) == 1.0000

    # Friction with 100% negative sentiment: 0.45 * 1.0 + 0.35 * 1.0 + 0.20 * 1.0 = 1.0000
    sentiment_all_neg = NarrativeSentimentProfile(
        is_available=True,
        total_text_messages_evaluated=3,
        text_positive_ratio=0.0,
        text_neutral_ratio=0.0,
        text_negative_ratio=1.0,
        emoji_polarity_score=-1.0,
        sentiment_model_id="test",
    )
    assert compute_friction_score(extreme_topic, sentiment_all_neg) == 1.0000

    # Test custom constants support
    # Custom reach norms: views_log_norm=8.0 (views 10M -> log10=7 -> 7/8 = 0.875)
    custom_reach = compute_reach_score(extreme_topic, views_log_norm=8.0, w_views=1.0, w_fwd=0.0)
    assert custom_reach == round(7.0 / 8.0, 4)


def test_zero_division_and_missing_engagement():
    """3. Verify extreme zero-division cases (0 views, 0 reactions, 0 timespan)."""
    dt = datetime(2026, 9, 2, 10, 0, 0, tzinfo=timezone.utc)
    empty_topic = EnrichedTopicCandidate(
        topic_id="topic_empty",
        message_count=1,
        percentage_of_dataset=100.0,
        representative_keywords=["test"],
        entities=[],
        engagement=TopicEngagementFeatures(
            total_views=0,
            total_forwards=0,
            total_replies=0,
            total_reactions=0,
            forward_to_view_ratio=0.0,
            reply_to_view_ratio=0.0,
            reaction_to_view_ratio=0.0,
            emoji_polarity_score=0.0,
            peak_views_message_id=None,
        ),
        propagation=TopicPropagationFeatures(
            observed_forward_count=0,
            direct_forward_ratio=0.0,
            unique_origin_channels=[],
            unique_amplifying_channels=[],
            cross_channel_observed_spread=0,
            uncredited_syndication_count=0,
        ),
        temporal=TopicTemporalFeatures(
            first_published_at=dt,
            last_published_at=dt,
            timespan_seconds=0.0,
            messages_per_hour=None,
            peak_window_utc="2026-09-02T10:00",
            peak_window_message_count=1,
            burstiness_index=None,
            channel_entry_velocity=None,
        ),
    )

    s_spread = compute_spread_score(empty_topic)
    s_coord = compute_coordination_score(empty_topic)
    s_reach = compute_reach_score(empty_topic)

    sentiment_unavail = NarrativeSentimentProfile(
        is_available=False,
        total_text_messages_evaluated=0,
        text_positive_ratio=None,
        text_neutral_ratio=None,
        text_negative_ratio=None,
        emoji_polarity_score=0.0,
        sentiment_model_id=None,
    )
    s_friction = compute_friction_score(empty_topic, sentiment_unavail)

    assert s_spread == 0.0
    assert 0.0 <= s_coord <= 1.0  # Uses neutral 0.50 burstiness fallback
    assert s_reach == 0.0
    assert s_friction == 0.0

    sub_scores = NarrativeSubScores(
        spread_score=s_spread,
        coordination_score=s_coord,
        reach_score=s_reach,
        friction_score=s_friction,
    )
    priority_score = compute_priority_signal_score(sub_scores)
    assert 0.0 <= priority_score <= 1.0
    assert assign_priority_tier(priority_score) == PriorityTier.ROUTINE


def test_unavailable_sentiment_renormalization_policy(mock_enriched_topic):
    """4. Verify missing sentiment inference NEVER fabricates neutrality and renormalizes Friction."""
    # In mock_enriched_topic:
    # emoji_polarity_score = -0.2500 -> emoji_neg = 0.25
    # reply_to_view_ratio = 0.0040 -> term_reply = min(0.0040 / 0.04, 1.0) = 0.10
    #
    # Case A: Sentiment available with 0.0 negativity
    profile_avail = NarrativeSentimentProfile(
        is_available=True,
        total_text_messages_evaluated=6,
        text_positive_ratio=0.50,
        text_neutral_ratio=0.50,
        text_negative_ratio=0.00,
        emoji_polarity_score=-0.25,
        sentiment_model_id="test-model",
    )
    # Friction = 0.45 * 0.0 + 0.35 * 0.25 + 0.20 * 0.10
    # = 0.0 + 0.0875 + 0.02 = 0.1075
    score_avail = compute_friction_score(mock_enriched_topic, profile_avail)
    assert score_avail == 0.1075

    # Case B: Sentiment completely unavailable
    profile_unavail = NarrativeSentimentProfile(
        is_available=False,
        total_text_messages_evaluated=0,
        text_positive_ratio=None,
        text_neutral_ratio=None,
        text_negative_ratio=None,
        emoji_polarity_score=-0.25,
        sentiment_model_id=None,
    )
    # Renormalized over emoji (0.35) and reply (0.20): total weight = 0.55
    # = (0.35 * 0.25 + 0.20 * 0.10) / 0.55 = (0.0875 + 0.02) / 0.55 = 0.1075 / 0.55 = 0.1955
    score_unavail = compute_friction_score(mock_enriched_topic, profile_unavail)
    assert score_unavail == round(0.1075 / 0.55, 4)
    assert score_unavail == 0.1955


def test_sentiment_batching_and_label_aggregation():
    """5. Verify batched sentiment inference over all text messages."""
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
            text_content=f"Message {i} content text",
        )
        for i in range(5)
    ]

    mock_adapter = MagicMock()
    # Mock 2 positive, 2 neutral, 1 negative
    mock_adapter.model_id = "mock-roberta"
    mock_adapter.predict_batch.return_value = [
        SentimentPrediction(label=SentimentLabel.POSITIVE, confidence=0.9, scores={}, model_id="mock-roberta"),
        SentimentPrediction(label=SentimentLabel.POSITIVE, confidence=0.8, scores={}, model_id="mock-roberta"),
        SentimentPrediction(label=SentimentLabel.NEUTRAL, confidence=0.7, scores={}, model_id="mock-roberta"),
        SentimentPrediction(label=SentimentLabel.NEUTRAL, confidence=0.6, scores={}, model_id="mock-roberta"),
        SentimentPrediction(label=SentimentLabel.NEGATIVE, confidence=0.95, scores={}, model_id="mock-roberta"),
    ]

    profile = evaluate_cluster_sentiment(msgs, adapter=mock_adapter, emoji_polarity_score=0.10)
    assert profile.is_available is True
    assert profile.total_text_messages_evaluated == 5
    assert profile.text_positive_ratio == 0.4000
    assert profile.text_neutral_ratio == 0.4000
    assert profile.text_negative_ratio == 0.2000
    assert profile.sentiment_model_id == "mock-roberta"


def test_evidence_density_tiers():
    """6. Verify evidence-density heuristic grading without claiming statistical confidence."""
    dt1 = datetime(2026, 9, 2, 10, 0, tzinfo=timezone.utc)
    dt2 = datetime(2026, 9, 2, 11, 0, tzinfo=timezone.utc)

    # 1. High density: 10 messages across 2 channels with timespan > 0
    msgs_high = [
        CanonicalMessage(
            canonical_id=f"telegram:c{i % 2}:10{i}",
            platform=Platform.TELEGRAM,
            native_id=f"10{i}",
            author_id=f"c{i % 2}",
            author_type=AuthorType.CHANNEL,
            published_at=dt1 if i < 5 else dt2,
            collected_at=dt2,
            views_count=100,
            reactions={"👍": 1},
        )
        for i in range(10)
    ]
    cand_high = EnrichedTopicCandidate(
        topic_id="t_high",
        message_count=10,
        percentage_of_dataset=100.0,
        representative_keywords=["test"],
        entities=[],
        engagement=TopicEngagementFeatures(
            total_views=1000, total_forwards=0, total_replies=0, total_reactions=10,
            forward_to_view_ratio=0.0, reply_to_view_ratio=0.0, reaction_to_view_ratio=0.01,
            emoji_polarity_score=1.0, peak_views_message_id="m1",
        ),
        propagation=TopicPropagationFeatures(),
        temporal=TopicTemporalFeatures(
            first_published_at=dt1, last_published_at=dt2, timespan_seconds=3600.0,
            messages_per_hour=10.0, peak_window_utc="2026-09-02T10:00", peak_window_message_count=5,
            burstiness_index=0.0, channel_entry_velocity=2.0,
        ),
    )
    cov_high = compute_data_coverage(cand_high, msgs_high)
    assert cov_high.evidence_density == EvidenceDensityTier.HIGH
    assert cov_high.has_views_coverage is True
    assert cov_high.has_reactions_coverage is True

    # 2. Moderate density: 4 messages
    msgs_mod = msgs_high[:4]
    cand_mod = EnrichedTopicCandidate(
        topic_id="t_mod",
        message_count=4,
        percentage_of_dataset=40.0,
        representative_keywords=["test"],
        entities=[],
        engagement=TopicEngagementFeatures(
            total_views=400, total_forwards=0, total_replies=0, total_reactions=4,
            forward_to_view_ratio=0.0, reply_to_view_ratio=0.0, reaction_to_view_ratio=0.01,
            emoji_polarity_score=1.0, peak_views_message_id="m1",
        ),
        propagation=TopicPropagationFeatures(),
        temporal=TopicTemporalFeatures(
            first_published_at=dt1, last_published_at=dt2, timespan_seconds=3600.0,
            messages_per_hour=4.0, peak_window_utc="2026-09-02T10:00", peak_window_message_count=4,
            burstiness_index=None, channel_entry_velocity=2.0,
        ),
    )
    cov_mod = compute_data_coverage(cand_mod, msgs_mod)
    assert cov_mod.evidence_density == EvidenceDensityTier.MODERATE

    # 3. Sparse density: 2 messages
    msgs_sparse = msgs_high[:2]
    cand_sparse = EnrichedTopicCandidate(
        topic_id="t_sparse",
        message_count=2,
        percentage_of_dataset=20.0,
        representative_keywords=["test"],
        entities=[],
        engagement=TopicEngagementFeatures(
            total_views=200, total_forwards=0, total_replies=0, total_reactions=2,
            forward_to_view_ratio=0.0, reply_to_view_ratio=0.0, reaction_to_view_ratio=0.01,
            emoji_polarity_score=1.0, peak_views_message_id="m1",
        ),
        propagation=TopicPropagationFeatures(),
        temporal=TopicTemporalFeatures(
            first_published_at=dt1, last_published_at=dt2, timespan_seconds=3600.0,
            messages_per_hour=2.0, peak_window_utc="2026-09-02T10:00", peak_window_message_count=2,
            burstiness_index=None, channel_entry_velocity=2.0,
        ),
    )
    cov_sparse = compute_data_coverage(cand_sparse, msgs_sparse)
    assert cov_sparse.evidence_density == EvidenceDensityTier.SPARSE


def test_potential_coordination_signals_and_non_conclusory_audit(mock_enriched_topic):
    """7. Verify coordination signals trigger properly and audit rationale uses non-conclusory language."""
    signals = extract_potential_coordination_signals(mock_enriched_topic)
    assert signals.potential_temporal_burst is True  # B = 0.25 > 0.20
    assert signals.potential_cross_channel_cascade is True  # spread = 2 >= 2

    notes = generate_signal_audit_notes(mock_enriched_topic, signals)
    assert len(notes) >= 2
    for note in notes:
        assert "Potential coordination/anomaly signal" in note
        assert "CIB" not in note
        assert "malicious" not in note


def test_deterministic_framing_and_excerpts(mock_enriched_topic):
    """8. Verify deterministic headline claim formation and representative excerpts."""
    headline = synthesize_headline_claim(mock_enriched_topic)
    assert "[Ladakh, #security]" in headline
    assert "security, radar, outpost" in headline

    dt = datetime(2026, 9, 2, 10, 0, tzinfo=timezone.utc)
    msgs = [
        CanonicalMessage(
            canonical_id="telegram:c1:1",
            platform=Platform.TELEGRAM,
            native_id="1",
            author_id="c1",
            author_type=AuthorType.CHANNEL,
            published_at=dt,
            collected_at=dt,
            text_content="Radar outpost deployed at frontier line in Ladakh.",
        )
    ]
    excerpts = extract_representative_excerpts(msgs)
    assert len(excerpts) == 1
    assert "Radar outpost deployed" in excerpts[0]


def test_priority_tier_assignment_and_custom_weights():
    """9. Verify priority tier boundary cutoffs and custom weight scaling."""
    assert assign_priority_tier(0.80) == PriorityTier.CRITICAL
    assert assign_priority_tier(0.75) == PriorityTier.CRITICAL
    assert assign_priority_tier(0.60) == PriorityTier.HIGH
    assert assign_priority_tier(0.55) == PriorityTier.HIGH
    assert assign_priority_tier(0.40) == PriorityTier.ELEVATED
    assert assign_priority_tier(0.35) == PriorityTier.ELEVATED
    assert assign_priority_tier(0.20) == PriorityTier.ROUTINE

    # Custom weights: e.g. focusing entirely on friction
    sub_scores = NarrativeSubScores(
        spread_score=0.10,
        coordination_score=0.10,
        reach_score=0.10,
        friction_score=0.90,
    )
    score_friction_focused = compute_priority_signal_score(
        sub_scores,
        weights={"spread": 0.0, "coordination": 0.0, "reach": 0.0, "friction": 1.0},
    )
    assert score_friction_focused == 0.9000
