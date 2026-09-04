"""TRAJECT Machine Learning — Milestone 4G: Narrative Candidate Formation & Priority Scoring.

Elevates enriched topic clusters into explainable, prioritized Narrative Candidates
with multi-factor priority scoring, potential coordination signal detection,
evidence-density grading, and batched sentiment synthesis.
"""

from typing import Any

__all__ = [
    "PriorityTier",
    "EvidenceDensityTier",
    "NarrativeDataCoverage",
    "NarrativeSubScores",
    "PotentialCoordinationSignals",
    "NarrativeSentimentProfile",
    "NarrativeCandidate",
    "NarrativeAssessmentReport",
    "DEFAULT_SCORING_WEIGHTS",
    "compute_spread_score",
    "compute_coordination_score",
    "compute_reach_score",
    "compute_friction_score",
    "compute_priority_signal_score",
    "assign_priority_tier",
    "load_shared_sentiment_adapter",
    "evaluate_cluster_sentiment",
    "extract_potential_coordination_signals",
    "generate_signal_audit_notes",
    "compute_data_coverage",
    "synthesize_headline_claim",
    "extract_representative_excerpts",
    "promote_narratives",
]


def __getattr__(name: str) -> Any:
    if name in (
        "PriorityTier",
        "EvidenceDensityTier",
        "NarrativeDataCoverage",
        "NarrativeSubScores",
        "PotentialCoordinationSignals",
        "NarrativeSentimentProfile",
        "NarrativeCandidate",
        "NarrativeAssessmentReport",
    ):
        from app.ml.narratives import models
        return getattr(models, name)

    elif name in (
        "DEFAULT_SCORING_WEIGHTS",
        "compute_spread_score",
        "compute_coordination_score",
        "compute_reach_score",
        "compute_friction_score",
        "compute_priority_signal_score",
        "assign_priority_tier",
    ):
        from app.ml.narratives import scoring
        return getattr(scoring, name)

    elif name in ("load_shared_sentiment_adapter", "evaluate_cluster_sentiment"):
        from app.ml.narratives import sentiment_fusion
        return getattr(sentiment_fusion, name)

    elif name in ("extract_potential_coordination_signals", "generate_signal_audit_notes"):
        from app.ml.narratives import signals
        return getattr(signals, name)

    elif name in (
        "compute_data_coverage",
        "synthesize_headline_claim",
        "extract_representative_excerpts",
    ):
        from app.ml.narratives import framing
        return getattr(framing, name)

    elif name == "promote_narratives":
        from app.ml.narratives import detector
        return getattr(detector, name)

    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")
