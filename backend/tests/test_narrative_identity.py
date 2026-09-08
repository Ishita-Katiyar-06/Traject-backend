"""Unit tests for deterministic narrative identity and evidence-grounded explanation synthesis."""

import pytest
from collections import Counter
from app.ml.narratives.identity import derive_narrative_identity
from app.ml.narratives.models import NarrativeCandidate, PriorityTier
from app.repositories.artifact_repository import get_artifact_repository


def test_derive_narrative_identity_biden():
    """Verify narrative_000 matches the exact canonical user example."""
    repo = get_artifact_repository()
    repo.load_artifacts()
    n0 = repo.get_narrative_by_id("narrative_000")
    assert n0 is not None
    assert n0.narrative_id == "narrative_000"
    assert n0.narrative_name == "Biden–Democratic Race Discourse"
    assert n0.narrative_summary is not None
    assert "Biden" in n0.narrative_summary
    assert "broader ongoing events" not in n0.narrative_summary
    assert "monitored channels" not in n0.narrative_summary


def test_derive_narrative_identity_narrative_012():
    """Verify narrative_012 correctly synthesizes Indus Waters Treaty & Ishaq Dar evidence."""
    repo = get_artifact_repository()
    repo.load_artifacts()
    n12 = repo.get_narrative_by_id("narrative_012")
    assert n12 is not None
    assert n12.narrative_id == "narrative_012"
    assert n12.narrative_name is not None
    assert n12.narrative_summary is not None
    # Must be grounded in the real Indus Waters Treaty / Ishaq Dar / Pakistan messages
    assert "Ishaq Dar" in n12.narrative_summary or "Indus Waters Treaty" in n12.narrative_summary or "Pakistan" in n12.narrative_summary
    # Must NOT contain the generic filler template
    assert "broader ongoing events" not in n12.narrative_summary
    assert "monitored channels" not in n12.narrative_summary


def test_all_narratives_have_meaningful_name_and_summary():
    """Verify that all narratives receive non-empty names and evidence-grounded summaries."""
    repo = get_artifact_repository()
    repo.load_artifacts()
    all_narratives = list(repo._narratives_by_id.values())
    assert len(all_narratives) == 345

    for n in all_narratives:
        assert n.narrative_id.startswith("narrative_")
        assert n.narrative_name is not None and len(n.narrative_name) > 3
        assert n.narrative_summary is not None and len(n.narrative_summary) > 20
        # Narrative name must not just be the ID
        assert n.narrative_name != n.narrative_id
        assert not n.narrative_name.startswith("Narrative ")
        # Generic filler template must NOT appear in any summary
        assert "broader ongoing events across monitored channels" not in n.narrative_summary


def test_summary_diversity_and_uniqueness():
    """Verify semantic diversity: across all 345 narratives, summaries are not identical templates."""
    repo = get_artifact_repository()
    repo.load_artifacts()
    all_narratives = list(repo._narratives_by_id.values())

    summaries = [n.narrative_summary for n in all_narratives if n.narrative_summary]
    assert len(summaries) == 345

    # Check distinct summary count - overwhelmingly unique based on distinct message evidence
    distinct_count = len(set(summaries))
    assert distinct_count > 330, f"Expected >330 distinct summaries, got {distinct_count}"
