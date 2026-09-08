"""Unit tests for deterministic Trend identity and evidence-grounded explanation synthesis."""

import pytest
from app.ml.narratives.identity import derive_trend_identity
from app.repositories.artifact_repository import get_artifact_repository


def test_derive_trend_identity_trend_089():
    """Verify trend_089 receives a meaningful name and evidence summary."""
    repo = get_artifact_repository()
    repo.load_artifacts()
    t89 = repo.get_trend_by_id("trend_089")
    assert t89 is not None
    assert t89.trend_name is not None
    assert "Election" in t89.trend_name or "Race" in t89.trend_name or "Democratic" in t89.trend_name
    assert t89.trend_summary is not None
    assert len(t89.trend_summary) > 25
    # Must not contain generic template phrases
    assert "broader discussion across monitored channels" not in t89.trend_summary
    assert "This trend represents discussion surrounding" not in t89.trend_summary


def test_derive_trend_identity_trend_055():
    """Verify trend_055 receives India–Pakistan Treaty name and evidence summary."""
    repo = get_artifact_repository()
    repo.load_artifacts()
    t55 = repo.get_trend_by_id("trend_055")
    assert t55 is not None
    assert t55.trend_name is not None
    assert "Pakistan" in t55.trend_name or "Treaty" in t55.trend_name
    assert t55.trend_summary is not None
    # Real evidence includes Indus Waters Treaty, Ishaq Dar, or Pakistan statements
    assert "Ishaq Dar" in t55.trend_summary or "Indus Waters Treaty" in t55.trend_summary or "Pakistan" in t55.trend_summary


def test_all_trends_have_meaningful_name_and_summary():
    """Verify that every trend receives a meaningful name and evidence-grounded summary."""
    repo = get_artifact_repository()
    repo.load_artifacts()
    trends, _ = repo.get_trends(page=1, page_size=100)
    assert len(trends) > 0

    for t in trends:
        assert t.trend_id.startswith("trend_")
        assert t.trend_name is not None and len(t.trend_name) > 3
        assert t.trend_summary is not None and len(t.trend_summary) > 20
        # Trend name must not be identical to Trend ID
        assert t.trend_name != t.trend_id
        # No generic template phrases
        assert "This trend represents discussion surrounding" not in t.trend_summary
        assert "broader discussion across monitored channels" not in t.trend_summary


def test_trend_summary_diversity_and_uniqueness():
    """Verify semantic diversity: across trends, summaries are not identical formulas."""
    repo = get_artifact_repository()
    repo.load_artifacts()
    trends, _ = repo.get_trends(page=1, page_size=100)

    summaries = [t.trend_summary for t in trends if t.trend_summary]
    # Check that summaries are diverse based on distinct cluster message evidence
    assert len(set(summaries)) > len(summaries) * 0.85
