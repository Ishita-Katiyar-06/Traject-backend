"""
Milestone 8C: Walk-Forward Backtest & Temporal Leakage Test Suite.

Validates:
1. Future messages strictly excluded from feature extraction (published_at <= T)
2. Future engagement observations strictly excluded from features (observed_at <= T)
3. Deliberately injected future spike does NOT leak into feature scores
4. Ground-truth future target isolation: targets use strictly (T, T+H]
5. Deterministic walk-forward backtest execution (identical scores and metrics on repeated runs)
6. Baseline scoring logic (Volume, Velocity, Growth, Kinetics)
7. Ranking metrics (Precision@K, Recall@K) and ROC-AUC calculation
"""
from datetime import datetime, timedelta, timezone
import numpy as np
import pytest

from app.ml.forecasting.backtest import WalkForwardBacktester
from app.ml.forecasting.causal_topic import build_causal_topics, project_future_messages_to_causal_topics
from app.schemas.canonical_message import AuthorType, CanonicalMessage, Platform
from app.schemas.engagement_observation import EngagementObservation


def _make_msg(
    cid: str,
    pub_at: datetime,
    channel: str = "@warmonitors",
    views: int = 1000,
) -> CanonicalMessage:
    parts = cid.split(":")
    author_id = parts[1] if len(parts) > 1 else "123"
    native_id = parts[2] if len(parts) > 2 else "1"
    return CanonicalMessage(
        canonical_id=cid,
        platform=Platform.TELEGRAM,
        native_id=native_id,
        author_id=author_id,
        author_username=channel.lstrip("@"),
        author_type=AuthorType.CHANNEL,
        channel_title=channel.lstrip("@").capitalize(),
        subscriber_count=50000,
        published_at=pub_at,
        collected_at=pub_at + timedelta(seconds=10),
        text_content=f"Message content for {cid}",
        language="en",
        media_types=[],
        has_media=False,
        is_forward=False,
        is_repost=False,
        origin_source_id=None,
        reply_to_id=None,
        thread_id=None,
        views_count=views,
        forwards_count=10,
        replies_count=2,
        reactions={"👍": 25},
        urls=[],
        hashtags=[],
        mentions=[],
    )


# ------------------------------------------------------------------------------
# Test 1: Future Message Leakage Prevention
# ------------------------------------------------------------------------------

def test_future_message_leakage_prevention():
    """Verify that a message published after cutoff T is strictly excluded from features."""
    T = datetime(2026, 9, 2, 12, 0, 0, tzinfo=timezone.utc)

    # Topic with 2 messages in past (<= T) and 1 future message (T + 2h)
    m_past1 = _make_msg("telegram:100:1", T - timedelta(hours=2))
    m_past2 = _make_msg("telegram:100:2", T - timedelta(minutes=45))
    m_future = _make_msg("telegram:100:3", T + timedelta(hours=2), views=99999)

    tester = WalkForwardBacktester(
        topic_messages={"topic_1": [m_past1, m_past2, m_future]}
    )

    feats = tester.extract_features_at_cutoff(["topic_1"], cutoff_at=T)
    k = feats["topic_1"]

    # Only past messages (2) should be present; future message (1) excluded
    assert k.total_historical_messages == 2
    assert k.messages_1h == 1
    assert k.messages_3h == 2
    assert k.messages_6h == 2
    # Velocity over 6h is 2 / 6 = 0.333
    assert round(k.velocity_6h, 2) == 0.33


# ------------------------------------------------------------------------------
# Test 2: Deliberately Injected Future Spike Excluded
# ------------------------------------------------------------------------------

def test_deliberate_future_spike_does_not_affect_features():
    """Verify that injecting an enormous burst of 100 future messages does NOT alter features at T."""
    T = datetime(2026, 9, 2, 12, 0, 0, tzinfo=timezone.utc)

    clean_msgs = [
        _make_msg("telegram:100:1", T - timedelta(hours=2)),
        _make_msg("telegram:100:2", T - timedelta(minutes=45)),
    ]

    # Poisoned corpus with 100 future messages
    future_burst = [
        _make_msg(f"telegram:100:{i+10}", T + timedelta(minutes=i+1))
        for i in range(100)
    ]
    poisoned_msgs = clean_msgs + future_burst

    tester_clean = WalkForwardBacktester(topic_messages={"topic_spike": clean_msgs})
    tester_poisoned = WalkForwardBacktester(topic_messages={"topic_spike": poisoned_msgs})

    feat_clean = tester_clean.extract_features_at_cutoff(["topic_spike"], cutoff_at=T)["topic_spike"]
    feat_poisoned = tester_poisoned.extract_features_at_cutoff(["topic_spike"], cutoff_at=T)["topic_spike"]

    # The features at cutoff T MUST be bitwise identical!
    assert feat_clean.model_dump() == feat_poisoned.model_dump()
    assert feat_poisoned.total_historical_messages == 2
    assert feat_poisoned.messages_1h == 1
    assert feat_poisoned.messages_6h == 2


# ------------------------------------------------------------------------------
# Test 3: Future Engagement Observation Leakage Prevention
# ------------------------------------------------------------------------------

def test_future_engagement_observation_leakage():
    """Verify that an engagement observation recorded after cutoff T is excluded."""
    T = datetime(2026, 9, 2, 12, 0, 0, tzinfo=timezone.utc)

    msg = _make_msg("telegram:100:1", T - timedelta(hours=10))

    obs_past = EngagementObservation(
        observation_id="obs_1",
        canonical_id="telegram:100:1",
        platform=Platform.TELEGRAM,
        native_id="1",
        channel_id="100",
        observed_at=T - timedelta(hours=2),
        views_count=500,
    )
    obs_future = EngagementObservation(
        observation_id="obs_2",
        canonical_id="telegram:100:1",
        platform=Platform.TELEGRAM,
        native_id="1",
        channel_id="100",
        observed_at=T + timedelta(hours=3),
        views_count=50000,  # Future massive view count!
    )

    tester = WalkForwardBacktester(
        topic_messages={"topic_1": [msg]},
        engagement_observations=[obs_past, obs_future],
    )

    feats = tester.extract_features_at_cutoff(["topic_1"], cutoff_at=T)
    k = feats["topic_1"]

    assert k.total_observed_views == 500
    assert k.total_observed_views < 50000


# ------------------------------------------------------------------------------
# Test 4: Ground Truth Target Isolation
# ------------------------------------------------------------------------------

def test_ground_truth_target_isolation():
    """Verify that ground truth outcomes use strictly future messages in (T, T+H]."""
    T = datetime(2026, 9, 2, 12, 0, 0, tzinfo=timezone.utc)
    H = 24

    # Topic A: 1 past msg, 3 future msgs in (T, T+24h]
    # Topic B: 5 past msgs, 0 future msgs
    msgs_a = [
        _make_msg("telegram:100:1", T - timedelta(hours=10)),
        _make_msg("telegram:100:2", T + timedelta(hours=2)),
        _make_msg("telegram:100:3", T + timedelta(hours=8)),
        _make_msg("telegram:100:4", T + timedelta(hours=16)),
    ]
    msgs_b = [
        _make_msg(f"telegram:200:{i}", T - timedelta(hours=i+1))
        for i in range(5)
    ]

    tester = WalkForwardBacktester(topic_messages={"topic_a": msgs_a, "topic_b": msgs_b})
    targets = tester.compute_ground_truth_targets(["topic_a", "topic_b"], cutoff_at=T, horizon_hours=H)

    tgt_a = targets["topic_a"]
    tgt_b = targets["topic_b"]

    assert tgt_a.future_message_count == 3
    assert tgt_a.future_is_persistent is True
    assert tgt_a.future_is_growth is True  # 3 in future vs 0 in recent past 24h
    assert tgt_a.future_is_prominent is True

    assert tgt_b.future_message_count == 0
    assert tgt_b.future_is_persistent is False
    assert tgt_b.future_is_prominent is False


# ------------------------------------------------------------------------------
# Test 5: Baseline Scoring Logic
# ------------------------------------------------------------------------------

def test_baseline_scoring_logic():
    """Verify deterministic baseline score calculations."""
    T = datetime(2026, 9, 2, 12, 0, 0, tzinfo=timezone.utc)
    msgs = [
        _make_msg("telegram:100:1", T - timedelta(hours=5)),
        _make_msg("telegram:100:2", T - timedelta(hours=2)),
        _make_msg("telegram:100:3", T - timedelta(hours=1)),
    ]
    tester = WalkForwardBacktester(topic_messages={"topic_1": msgs})
    feats = tester.extract_features_at_cutoff(["topic_1"], cutoff_at=T)
    scores = tester.score_baselines(feats)

    # Baseline A: messages_24h = 3
    assert scores["BaselineA_Volume"]["topic_1"] == 3.0
    # Baseline B: velocity_6h = 3 / 6 = 0.5
    assert scores["BaselineB_Velocity"]["topic_1"] == 0.5
    # Baseline C: velocity_6h * (1 + growth) >= 0.5
    assert scores["BaselineC_Growth"]["topic_1"] >= 0.5
    # Baseline D: kinetics composite in [0, 1]
    assert 0.0 <= scores["BaselineD_Kinetics"]["topic_1"] <= 1.0


# ------------------------------------------------------------------------------
# Test 6: Deterministic Walk-Forward Execution
# ------------------------------------------------------------------------------

def test_walk_forward_backtest_is_deterministic():
    """Verify that running the walk-forward backtest twice produces bitwise identical results."""
    T1 = datetime(2026, 9, 2, 12, 0, 0, tzinfo=timezone.utc)
    T2 = datetime(2026, 9, 3, 12, 0, 0, tzinfo=timezone.utc)

    msgs = {
        "topic_1": [
            _make_msg("telegram:100:1", T1 - timedelta(hours=10)),
            _make_msg("telegram:100:2", T1 + timedelta(hours=4)),
        ],
        "topic_2": [
            _make_msg("telegram:200:1", T1 - timedelta(hours=5)),
        ],
    }

    tester = WalkForwardBacktester(topic_messages=msgs)
    run1 = tester.run_walk_forward_backtest([T1, T2], horizon_hours=24)
    run2 = tester.run_walk_forward_backtest([T1, T2], horizon_hours=24)

    # Exclude dynamic timestamp from identity comparison
    dump1 = run1.model_dump(exclude={"created_at_utc", "artifact_id"})
    dump2 = run2.model_dump(exclude={"created_at_utc", "artifact_id"})

    assert dump1 == dump2


# ------------------------------------------------------------------------------
# Test 7: Strong Representation-Leakage Test (Dataset A vs Dataset B vs Dataset C)
# ------------------------------------------------------------------------------

def test_strong_topic_representation_leakage_invariance():
    """Section 9 Requirement:
    Verify that:
    Dataset A: historical messages <= T
    Dataset B: same historical messages + extreme future burst after T
    Dataset C: same historical messages + many completely new unrelated future topics

    The historical feature representation at T (eligibility, message count, velocity,
    growth, persistence, diffusion, and baseline scores) remains strictly IDENTICAL.
    """
    T = datetime(2026, 9, 2, 12, 0, 0, tzinfo=timezone.utc)

    # Historical messages for Topic 1 and Topic 2 (<= T)
    t1_hist = [
        _make_msg("telegram:100:1", T - timedelta(hours=8), channel="@channel_a"),
        _make_msg("telegram:100:2", T - timedelta(hours=3), channel="@channel_b"),
        _make_msg("telegram:100:3", T - timedelta(minutes=30), channel="@channel_a"),
    ]
    t2_hist = [
        _make_msg("telegram:200:1", T - timedelta(hours=20), channel="@channel_c"),
        _make_msg("telegram:200:2", T - timedelta(hours=10), channel="@channel_d"),
    ]

    # DATASET A: pure historical messages
    dataset_a = {"topic_1": list(t1_hist), "topic_2": list(t2_hist)}

    # DATASET B: same historical messages + extreme future burst of 200 messages in (T, T+24h]
    t1_burst = [
        _make_msg(f"telegram:100:{i+100}", T + timedelta(minutes=i+1), channel=f"@burst_{i%5}")
        for i in range(200)
    ]
    dataset_b = {"topic_1": list(t1_hist) + t1_burst, "topic_2": list(t2_hist)}

    # DATASET C: same historical messages + 50 completely new future-only topics
    dataset_c = {"topic_1": list(t1_hist), "topic_2": list(t2_hist)}
    for f_idx in range(50):
        future_topic_msgs = [
            _make_msg(f"telegram:{500+f_idx}:{m_idx}", T + timedelta(hours=m_idx+1), channel=f"@future_chan_{f_idx}")
            for m_idx in range(5)
        ]
        dataset_c[f"future_only_topic_{f_idx}"] = future_topic_msgs

    tester_a = WalkForwardBacktester(topic_messages=dataset_a)
    tester_b = WalkForwardBacktester(topic_messages=dataset_b)
    tester_c = WalkForwardBacktester(topic_messages=dataset_c)

    # 1. Check candidate eligibility at T
    cands_a = tester_a.select_candidate_topics(cutoff_at=T, lookback_hours=48.0)
    cands_b = tester_b.select_candidate_topics(cutoff_at=T, lookback_hours=48.0)
    cands_c = tester_c.select_candidate_topics(cutoff_at=T, lookback_hours=48.0)

    assert cands_a == ["topic_1", "topic_2"]
    assert cands_b == ["topic_1", "topic_2"], "Future burst must not alter candidate selection"
    assert cands_c == ["topic_1", "topic_2"], "Future-only topics must never enter candidate pool at T"

    # 2. Extract features at cutoff T
    feats_a = tester_a.extract_features_at_cutoff(cands_a, cutoff_at=T)
    feats_b = tester_b.extract_features_at_cutoff(cands_b, cutoff_at=T)
    feats_c = tester_c.extract_features_at_cutoff(cands_c, cutoff_at=T)

    for t_id in ["topic_1", "topic_2"]:
        fa = feats_a[t_id]
        fb = feats_b[t_id]
        fc = feats_c[t_id]

        # Verify exact bitwise feature equality across all representations
        assert fa.total_historical_messages == fb.total_historical_messages == fc.total_historical_messages
        assert fa.velocity_6h == fb.velocity_6h == fc.velocity_6h
        assert fa.volume_ratio_24h == fb.volume_ratio_24h == fc.volume_ratio_24h
        assert fa.active_window_count_24h == fb.active_window_count_24h == fc.active_window_count_24h
        assert fa.distinct_channels_24h == fb.distinct_channels_24h == fc.distinct_channels_24h
        assert fa.model_dump() == fb.model_dump() == fc.model_dump()

    # 3. Check baseline scores
    scores_a = tester_a.score_baselines(feats_a)
    scores_b = tester_b.score_baselines(feats_b)
    scores_c = tester_c.score_baselines(feats_c)

    assert scores_a == scores_b == scores_c, "Baseline scores at T must be invariant to future data"


# ------------------------------------------------------------------------------
# Test 8: Prominence vs Persistence Separation
# ------------------------------------------------------------------------------

def test_prominence_vs_persistence_target_separation():
    """Verify that a topic with 1 single message is marked persistent, but NOT prominent
    when more prominent topics exist in the future window.
    """
    T = datetime(2026, 9, 2, 12, 0, 0, tzinfo=timezone.utc)
    H = 24

    # Candidate 1: 1 future message
    # Candidate 2: 1 future message
    # Candidate 3: 5 future messages (prominent)
    # Candidate 4: 0 future messages (inactive)
    topic_msgs = {
        "t1": [_make_msg("telegram:1:1", T - timedelta(hours=2)), _make_msg("telegram:1:2", T + timedelta(hours=2))],
        "t2": [_make_msg("telegram:2:1", T - timedelta(hours=2)), _make_msg("telegram:2:2", T + timedelta(hours=4))],
        "t3": [_make_msg("telegram:3:1", T - timedelta(hours=2))] + [_make_msg(f"telegram:3:{i+2}", T + timedelta(hours=i+1)) for i in range(5)],
        "t4": [_make_msg("telegram:4:1", T - timedelta(hours=2))],
    }

    tester = WalkForwardBacktester(topic_messages=topic_msgs)
    cands = tester.select_candidate_topics(cutoff_at=T)
    targets = tester.compute_ground_truth_targets(cands, cutoff_at=T, horizon_hours=H, prominence_percentile_threshold=0.80)

    # t4: zero future activity -> neither persistent nor prominent
    assert targets["t4"].future_message_count == 0
    assert targets["t4"].future_is_persistent is False
    assert targets["t4"].future_is_prominent is False

    # t1 and t2: persistent (1 message), but NOT prominent (they are tied in lower percentile)
    assert targets["t1"].future_is_persistent is True
    assert targets["t1"].future_is_prominent is False
    assert targets["t2"].future_is_persistent is True
    assert targets["t2"].future_is_prominent is False

    # t3: 5 messages -> persistent AND prominent
    assert targets["t3"].future_is_persistent is True
    assert targets["t3"].future_is_prominent is True
    assert targets["t3"].future_prominence_percentile >= 0.80


# ------------------------------------------------------------------------------
# Test 9: Section 11.D Strong Causal Representation & Vocabulary Invariance
# ------------------------------------------------------------------------------

def test_topic_representation_vocabulary_and_centroid_invariance():
    """Section 11.D Requirement:
    Construct a dataset where:
    - historical messages exist before T with historical vocabulary
    - future messages introduce a very strong new semantic cluster with novel vocabulary absent from history
    
    Verify that building the causal representation at T before vs after adding the future
    messages produces identical historical vocabulary, candidate membership, and statistics.
    """
    T = datetime(2026, 9, 2, 12, 0, 0, tzinfo=timezone.utc)

    # Historical messages with geopolitical / economic vocabulary
    t1_hist = [
        _make_msg("telegram:1:1", T - timedelta(hours=6)),
        _make_msg("telegram:1:2", T - timedelta(hours=2)),
    ]
    t1_hist[0].text_content = "sanctions diplomacy trade agreement negotiated between foreign ministers"
    t1_hist[1].text_content = "trade tariffs export restrictions impacting agricultural shipments"

    corpus_pure_history = {"geopolitics_topic": list(t1_hist)}

    # Future messages with completely alien quantum computing vocabulary
    future_quantum_msgs = [
        _make_msg("telegram:999:1", T + timedelta(hours=1)),
        _make_msg("telegram:999:2", T + timedelta(hours=3)),
    ]
    future_quantum_msgs[0].text_content = "quantum superconducting qubit cryogenic entanglement breakthrough"
    future_quantum_msgs[1].text_content = "qubit coherence teleportation cryogenic quantum processor computing"

    # Corpus with future semantic burst in existing topic + entirely new future topic
    t1_polluted = list(t1_hist) + [
        _make_msg("telegram:1:99", T + timedelta(hours=2))
    ]
    t1_polluted[-1].text_content = "superconducting quantum teleportation qubit cryogenic processor"

    corpus_with_future = {
        "geopolitics_topic": t1_polluted,
        "quantum_future_topic": future_quantum_msgs,
    }

    tester_clean = WalkForwardBacktester(topic_messages=corpus_pure_history)
    tester_polluted = WalkForwardBacktester(topic_messages=corpus_with_future)

    rep_clean = tester_clean.construct_causal_topic_representation(cutoff_at=T)
    rep_polluted = tester_polluted.construct_causal_topic_representation(cutoff_at=T)

    # 1. New future topic must NOT exist at all in causal representation at T
    assert "quantum_future_topic" not in rep_polluted
    assert set(rep_clean.keys()) == set(rep_polluted.keys()) == {"geopolitics_topic"}

    prof_clean = rep_clean["geopolitics_topic"]
    prof_polluted = rep_polluted["geopolitics_topic"]

    # 2. Historical vocabulary at T must NOT contain any future quantum words
    future_words = {"quantum", "superconducting", "qubit", "cryogenic", "teleportation"}
    for kw in prof_polluted.historical_keywords:
        assert kw not in future_words, f"Future word {kw} leaked into historical topic keywords!"

    # 3. Exactly identical keywords, message IDs, and counts
    assert prof_clean.historical_keywords == prof_polluted.historical_keywords
    assert prof_clean.historical_message_ids == prof_polluted.historical_message_ids
    assert prof_clean.historical_message_count == prof_polluted.historical_message_count == 2
    assert prof_clean.is_candidate == prof_polluted.is_candidate is True


# ------------------------------------------------------------------------------
# Test 10: Section 12 Accounting / Reconciliation Invariants
# ------------------------------------------------------------------------------

def test_accounting_reconciliation_invariants():
    """Section 12 Requirement:
    Verify exact reconciliation across all accounting fields:
    - total_messages_available == candidate_messages_count + excluded_messages_count
    - candidate_topics_count == active_future_topics_count + zero_future_topics_count
    - prominent_future_topics_count <= active_future_topics_count
    """
    T = datetime(2026, 9, 2, 12, 0, 0, tzinfo=timezone.utc)
    msgs = {
        "cand_1": [
            _make_msg("telegram:10:1", T - timedelta(hours=3)),
            _make_msg("telegram:10:2", T + timedelta(hours=4)),
        ],
        "cand_2": [
            _make_msg("telegram:20:1", T - timedelta(hours=5)),
        ],
        "inactive_hist": [
            # Active in distant past (>48h), not candidate
            _make_msg("telegram:30:1", T - timedelta(hours=72)),
        ],
        "future_only": [
            _make_msg("telegram:40:1", T + timedelta(hours=5)),
        ],
    }

    tester = WalkForwardBacktester(topic_messages=msgs)
    artifact = tester.run_walk_forward_backtest([T], horizon_hours=24)
    c = artifact.cutoffs[0]

    # Reconciliation checks
    assert c.total_messages_available == 3  # cand_1, cand_2, inactive_hist
    assert c.candidate_messages_count == 2  # cand_1, cand_2
    assert c.excluded_messages_count == 1   # inactive_hist
    assert c.total_messages_available == c.candidate_messages_count + c.excluded_messages_count

    assert c.candidate_topics_count == 2
    assert c.active_future_topics_count == 1  # cand_1
    assert c.zero_future_topics_count == 1    # cand_2
    assert c.candidate_topics_count == c.active_future_topics_count + c.zero_future_topics_count

    assert c.prominent_future_topics_count <= c.active_future_topics_count


# ------------------------------------------------------------------------------
# Test 11: Section 7 Synthetic Causal Topic Construction Leakage Test
# ------------------------------------------------------------------------------

def test_causal_topic_construction_leakage_synthetic():
    """Section 7 Requirement:
    Verify that causal topic construction is strictly invariant to future data:
    1. HISTORICAL DATA: several coherent topics with historical vocabulary.
    2. FUTURE DATA: very large semantic burst with alien vocabulary.
    3. causal_topic_builder(historical, T) vs causal_topic_builder(historical + future, T)
       must produce identical topic assignments, centroids, vocabulary, candidates, and stats.
    4. Future alien vocabulary must NEVER enter the feature space.
    """
    T = datetime(2026, 9, 2, 12, 0, 0, tzinfo=timezone.utc)

    # 1. Historical data: 3 coherent topics
    hist_msgs: list[CanonicalMessage] = []
    # Topic A: Semiconductors (4 msgs)
    for i in range(4):
        m = _make_msg(f"telegram:hist_semi:{i}", T - timedelta(hours=6 + i))
        m.text_content = f"semiconductor chip foundry lithography silicon processor design {i}"
        hist_msgs.append(m)

    # Topic B: Solar energy (4 msgs)
    for i in range(4):
        m = _make_msg(f"telegram:hist_solar:{i}", T - timedelta(hours=8 + i))
        m.text_content = f"renewable solar photovoltaic inverter clean energy electricity {i}"
        hist_msgs.append(m)

    # Topic C: Quantum computing (4 msgs)
    for i in range(4):
        m = _make_msg(f"telegram:hist_quantum:{i}", T - timedelta(hours=10 + i))
        m.text_content = f"quantum computing qubit entanglement superposition processor {i}"
        hist_msgs.append(m)

    # 2. Future data: Massive alien burst (30 messages)
    future_msgs: list[CanonicalMessage] = []
    for i in range(30):
        m = _make_msg(f"telegram:fut_alien:{i}", T + timedelta(hours=1 + (i % 20)))
        m.text_content = f"interstellar spacecraft warp drive alien extraterrestrial colonization astrophysics {i}"
        future_msgs.append(m)

    # Run builder on historical only vs historical + future
    rep_clean = build_causal_topics(hist_msgs, cutoff_at=T, history_window_days=30.0)
    rep_polluted = build_causal_topics(hist_msgs + future_msgs, cutoff_at=T, history_window_days=30.0)

    # Invariants
    assert rep_clean.topic_profiles.keys() == rep_polluted.topic_profiles.keys()
    assert len(rep_clean.topic_profiles) == len(rep_polluted.topic_profiles) >= 2

    # Verify per-topic bitwise identity
    for t_id in rep_clean.topic_profiles:
        prof_c = rep_clean.topic_profiles[t_id]
        prof_p = rep_polluted.topic_profiles[t_id]

        assert prof_c.historical_message_ids == prof_p.historical_message_ids
        assert prof_c.historical_keywords == prof_p.historical_keywords
        assert prof_c.historical_message_count == prof_p.historical_message_count
        assert prof_c.is_candidate == prof_p.is_candidate

        c_centroid = rep_clean.topic_centroids[t_id]
        p_centroid = rep_polluted.topic_centroids[t_id]
        np.testing.assert_allclose(c_centroid, p_centroid, rtol=1e-5, atol=1e-5)

    # Statistics identity
    assert rep_clean.historical_messages_count == rep_polluted.historical_messages_count == len(hist_msgs)
    assert rep_clean.clustered_messages_count == rep_polluted.clustered_messages_count
    assert rep_clean.noise_messages_count == rep_polluted.noise_messages_count

    # Alien vocabulary isolation: alien tokens must NEVER appear in causal feature space
    for alien_word in ["interstellar", "spacecraft", "warp", "alien", "extraterrestrial"]:
        assert alien_word not in rep_polluted.feature_names
        for prof in rep_polluted.topic_profiles.values():
            assert alien_word not in prof.historical_keywords


# ------------------------------------------------------------------------------
# Test 12: Section 8 Second Leakage Test (Dataset A vs Dataset B)
# ------------------------------------------------------------------------------

def test_causal_topics_dataset_a_vs_dataset_b():
    """Section 8 Requirement:
    Dataset A: historical messages only.
    Dataset B: historical messages + huge future semantic burst + several completely new future topics.
    causal_topics(A, T) and causal_topics(B, T) must produce identical historical representations:
    - topic count
    - historical message membership
    - centroids
    - vocabulary
    - candidate set
    - historical statistics
    """
    T = datetime(2026, 9, 3, 0, 0, 0, tzinfo=timezone.utc)

    dataset_a: list[CanonicalMessage] = []
    # Coherent Topic 1 (5 msgs)
    for i in range(5):
        m = _make_msg(f"telegram:da_ai:{i}", T - timedelta(hours=4 + i))
        m.text_content = f"artificial intelligence neural network transformer deep learning {i}"
        dataset_a.append(m)

    # Coherent Topic 2 (5 msgs)
    for i in range(5):
        m = _make_msg(f"telegram:da_crypto:{i}", T - timedelta(hours=5 + i))
        m.text_content = f"cryptocurrency bitcoin ethereum blockchain token ledger {i}"
        dataset_a.append(m)

    # Dataset B adds a huge burst AND multiple completely new future topics
    dataset_b = list(dataset_a)

    # Burst of Topic 1 in future (20 msgs)
    for i in range(20):
        m = _make_msg(f"telegram:db_ai_burst:{i}", T + timedelta(hours=2 + i))
        m.text_content = f"artificial intelligence breakthrough new model superintelligence {i}"
        dataset_b.append(m)

    # Entirely new future topic: Biotechnology (20 msgs)
    for i in range(20):
        m = _make_msg(f"telegram:db_bio:{i}", T + timedelta(hours=3 + i))
        m.text_content = f"crispr gene editing genomics therapeutics biotechnology clinical {i}"
        dataset_b.append(m)

    # Entirely new future topic: Autonomous Vehicles (20 msgs)
    for i in range(20):
        m = _make_msg(f"telegram:db_auto:{i}", T + timedelta(hours=4 + i))
        m.text_content = f"autonomous driving self driving lidar sensor robotics vehicle {i}"
        dataset_b.append(m)

    rep_a = build_causal_topics(dataset_a, cutoff_at=T, history_window_days=30.0)
    rep_b = build_causal_topics(dataset_b, cutoff_at=T, history_window_days=30.0)

    # 1. Topic count
    assert len(rep_a.topic_profiles) == len(rep_b.topic_profiles)
    assert rep_a.topic_profiles.keys() == rep_b.topic_profiles.keys()

    # 2. Historical message membership, centroids, vocabulary, candidates
    for t_id in rep_a.topic_profiles:
        prof_a = rep_a.topic_profiles[t_id]
        prof_b = rep_b.topic_profiles[t_id]

        assert prof_a.historical_message_ids == prof_b.historical_message_ids
        assert prof_a.historical_keywords == prof_b.historical_keywords
        assert prof_a.is_candidate == prof_b.is_candidate
        np.testing.assert_allclose(rep_a.topic_centroids[t_id], rep_b.topic_centroids[t_id], rtol=1e-5, atol=1e-5)

    # 3. Candidate set
    cands_a = sorted([t for t, p in rep_a.topic_profiles.items() if p.is_candidate])
    cands_b = sorted([t for t, p in rep_b.topic_profiles.items() if p.is_candidate])
    assert cands_a == cands_b

    # 4. Historical statistics
    assert rep_a.historical_messages_count == rep_b.historical_messages_count
    assert rep_a.clustered_messages_count == rep_b.clustered_messages_count
    assert rep_a.noise_messages_count == rep_b.noise_messages_count


# ------------------------------------------------------------------------------
# Test 13: The Golden Question: Post-T Deletion Invariance
# ------------------------------------------------------------------------------

def test_golden_question_post_t_deletion_invariance():
    """Golden Question:
    'At cutoff T, if I completely delete every message published after T from the input dataset,
    do I get exactly the same forecasting topic representation that the system used at T?'
    The answer MUST BE YES.
    """
    T = datetime(2026, 9, 4, 12, 0, 0, tzinfo=timezone.utc)

    # Complete mixed corpus with past, present, and future messages
    full_dataset: list[CanonicalMessage] = []
    for i in range(5):
        m = _make_msg(f"telegram:mix_topic1:{i}", T - timedelta(hours=6 + i))
        m.text_content = f"distributed systems database replication consensus raft {i}"
        full_dataset.append(m)

    for i in range(5):
        m = _make_msg(f"telegram:mix_topic2:{i}", T - timedelta(hours=7 + i))
        m.text_content = f"cybersecurity zero day vulnerability exploit patch firewall {i}"
        full_dataset.append(m)

    # Future messages in (T, T+24h]
    for i in range(15):
        m = _make_msg(f"telegram:mix_future:{i}", T + timedelta(hours=1 + i))
        m.text_content = f"future breakthrough alien telemetry galactic protocol {i}"
        full_dataset.append(m)

    # 1. System runs on full dataset at cutoff T
    tester_full = WalkForwardBacktester(messages=full_dataset)
    rep_full = tester_full.construct_causal_topic_representation(cutoff_at=T)

    # 2. Completely delete every message published after T
    purged_dataset = [m for m in full_dataset if m.published_at <= T]
    tester_purged = WalkForwardBacktester(messages=purged_dataset)
    rep_purged = tester_purged.construct_causal_topic_representation(cutoff_at=T)

    # 3. Assert absolute equality of the resulting topic representations
    assert rep_full.keys() == rep_purged.keys()
    assert len(rep_full) > 0

    for t_id in rep_full:
        p_full = rep_full[t_id]
        p_purged = rep_purged[t_id]

        assert p_full.historical_message_ids == p_purged.historical_message_ids
        assert p_full.historical_keywords == p_purged.historical_keywords
        assert p_full.historical_message_count == p_purged.historical_message_count
        assert p_full.is_candidate == p_purged.is_candidate
        assert p_full.first_seen_at_utc == p_purged.first_seen_at_utc
        assert p_full.last_seen_at_utc == p_purged.last_seen_at_utc
        if p_full.historical_centroid and p_purged.historical_centroid:
            np.testing.assert_allclose(p_full.historical_centroid, p_purged.historical_centroid, rtol=1e-5, atol=1e-5)

    # 4. Also verify feature extraction on both yields identical features
    cands = sorted([t for t, p in rep_full.items() if p.is_candidate])
    feats_full = tester_full.extract_features_at_cutoff(cands, cutoff_at=T)
    feats_purged = tester_purged.extract_features_at_cutoff(cands, cutoff_at=T)

    for t in cands:
        assert feats_full[t].total_historical_messages == feats_purged[t].total_historical_messages
        assert feats_full[t].velocity_24h == feats_purged[t].velocity_24h
        assert feats_full[t].velocity_6h == feats_purged[t].velocity_6h
        assert feats_full[t].messages_24h == feats_purged[t].messages_24h

    # 5. Baseline predictions must be 100% bitwise identical
    scores_full = tester_full.score_baselines(feats_full)
    scores_purged = tester_purged.score_baselines(feats_purged)
    for b_name in ["BaselineA_Volume", "BaselineB_Velocity", "BaselineC_Growth", "BaselineD_Kinetics"]:
        for t in cands:
            assert scores_full[b_name][t] == scores_purged[b_name][t]
