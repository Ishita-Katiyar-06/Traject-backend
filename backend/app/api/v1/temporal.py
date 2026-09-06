"""FastAPI router for Temporal Narrative Lineage and Operational Monitoring (Milestone 6E)."""

from collections import Counter
import json
import logging
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import ArtifactRepository, get_artifact_repository
from app.core.config import find_repo_root
from app.schemas.api.common import PaginationMeta
from app.schemas.api.temporal import (
    LineageListResponse,
    NarrativeLineageDetailResponse,
    NarrativeLineageSummary,
    TemporalSnapshotListResponse,
    TemporalStatusResponse,
)
from app.temporal.models import LineageState, TemporalSnapshotMetadata
from app.temporal.store import TemporalLineageStore

logger = logging.getLogger("traject.api.v1.temporal")

router = APIRouter(prefix="/temporal", tags=["Temporal Lineage & Monitoring"])


def _get_lineage_store() -> TemporalLineageStore:
    """Dependency helper to load TemporalLineageStore."""
    return TemporalLineageStore()


@router.get(
    "/status",
    response_model=TemporalStatusResponse,
    summary="Unified operational collection and temporal lineage health",
)
async def get_temporal_status(
    repository: ArtifactRepository = Depends(get_artifact_repository),
    store: TemporalLineageStore = Depends(_get_lineage_store),
) -> TemporalStatusResponse:
    """Expose combined operational collection telemetry, analytics freshness,
    and temporal narrative lineage distribution.
    """
    try:
        pipe_status = repository.get_pipeline_status()
        collection_mode = pipe_status.collection_mode
        last_collection_run = pipe_status.last_collection_run
        last_successful_collection = pipe_status.last_successful_collection
        cumulative_record_count = pipe_status.cumulative_record_count or len(repository._messages)
        corpus_snapshot_id = pipe_status.corpus_snapshot_id
        analytics_generated_at = pipe_status.analytics_generated_at
        analytics_current = pipe_status.analytics_current
        stale_analytics_reason = pipe_status.stale_analytics_reason
        last_temporal_update = pipe_status.last_temporal_update
    except Exception as exc:
        collection_mode = None
        last_collection_run = None
        last_successful_collection = None
        cumulative_record_count = len(repository._messages)
        corpus_snapshot_id = None
        analytics_generated_at = None
        analytics_current = False
        stale_analytics_reason = f"Pipeline metadata unavailable: {exc}"
        last_temporal_update = None

    lineages = store.lineages

    # Distribution of lineages across states
    state_counts: Counter[str] = Counter()
    for l in lineages.values():
        state_counts[l.state.value] += 1

    active_count = sum(1 for l in lineages.values() if l.state != LineageState.DISAPPEARED)

    # Read latest manifest if present
    repo_root = find_repo_root()
    latest_manifest = repo_root / "data" / "manifests" / "telegram" / "incremental" / "latest_manifest.json"
    if not corpus_snapshot_id and latest_manifest.is_file():
        try:
            with open(latest_manifest, "r", encoding="utf-8") as f:
                data = json.load(f)
                corpus_snapshot_id = data.get("corpus_snapshot_id")
        except Exception:
            pass

    return TemporalStatusResponse(
        collection_status="active" if collection_mode else "idle",
        last_collection_run=last_collection_run,
        last_successful_collection=last_successful_collection,
        cumulative_corpus_count=cumulative_record_count,
        latest_corpus_snapshot_id=corpus_snapshot_id,
        latest_analytics_snapshot_id=repository.dataset_source if repository.artifacts_loaded else "unloaded",
        analytics_generated_at_utc=analytics_generated_at,
        analytics_current=analytics_current,
        stale_analytics_reason=stale_analytics_reason,
        total_lineages_tracked=len(lineages),
        active_lineages_count=active_count,
        lineages_by_state=dict(state_counts),
        last_temporal_update=last_temporal_update,
    )


@router.get(
    "/snapshots",
    response_model=TemporalSnapshotListResponse,
    summary="List immutable analytics snapshots and corpus linkage",
)
async def list_temporal_snapshots() -> TemporalSnapshotListResponse:
    """Discover and list known analytics artifacts with corpus and generation metadata."""
    repo_root = find_repo_root()
    processed_dir = repo_root / "data" / "processed" / "telegram"

    snapshots: list[TemporalSnapshotMetadata] = []
    if processed_dir.is_dir():
        for artifact_path in sorted(processed_dir.glob("*-analytics-artifact.json")):
            try:
                with open(artifact_path, "r", encoding="utf-8") as f:
                    data = json.load(f)

                topics_count = len(data.get("topics", {}).get("topic_records", []))
                narratives_count = len(data.get("narratives", []))
                created_at = data.get("created_at_utc", "")
                metrics = data.get("metrics", {})
                corpus_size = metrics.get("records_ingested", 0)

                snap_id = f"snapshot_{artifact_path.stem.replace('-analytics-artifact', '')}"
                snapshots.append(
                    TemporalSnapshotMetadata(
                        snapshot_id=snap_id,
                        collection_run_id=None,
                        corpus_snapshot_id=None,
                        generated_at_utc=created_at,
                        corpus_size=corpus_size,
                        narrative_count=narratives_count,
                        topic_count=topics_count,
                        artifact_path=str(artifact_path),
                    )
                )
            except Exception as e:
                logger.warning("Could not read snapshot artifact %s: %s", artifact_path, e)

    return TemporalSnapshotListResponse(
        snapshots=snapshots,
        total_snapshots=len(snapshots),
    )


@router.get(
    "/narratives",
    response_model=LineageListResponse,
    summary="Paginated list of temporal narrative lineages",
)
async def list_lineages(
    state: LineageState | None = Query(default=None, description="Optional state filter (e.g. 'persisting', 'new')"),
    page: int = Query(default=1, ge=1, description="1-indexed page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    store: TemporalLineageStore = Depends(_get_lineage_store),
) -> LineageListResponse:
    """Retrieve paginated temporal lineages with deterministic ordering."""
    all_lineages = list(store.lineages.values())

    if state is not None:
        all_lineages = [l for l in all_lineages if l.state == state]

    # Deterministic sorting: priority signal descending, then last seen descending, then lineage ID
    sorted_lineages = sorted(
        all_lineages,
        key=lambda l: (l.priority_signal_current, l.last_seen_at, l.lineage_id),
        reverse=True,
    )

    total_items = len(sorted_lineages)
    total_pages = max(1, (total_items + page_size - 1) // page_size) if total_items > 0 else 1
    offset = (page - 1) * page_size
    page_items = sorted_lineages[offset : offset + page_size]

    data = [
        NarrativeLineageSummary(
            lineage_id=l.lineage_id,
            current_narrative_id=l.current_narrative_id,
            state=l.state,
            first_seen_at=l.first_seen_at,
            last_seen_at=l.last_seen_at,
            snapshot_count=l.snapshot_count,
            consecutive_snapshot_count=l.consecutive_snapshot_count,
            message_count_current=l.message_count_current,
            message_count_previous=l.message_count_previous,
            priority_signal_current=l.priority_signal_current,
            headline_claim_current=l.headline_claim_current,
            lineage_match_score=l.lineage_match_score,
        )
        for l in page_items
    ]

    return LineageListResponse(
        data=data,
        meta=PaginationMeta(
            total=total_items,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1,
        ),
    )


@router.get(
    "/narratives/{lineage_id}",
    response_model=NarrativeLineageDetailResponse,
    summary="Retrieve lineage details and lifecycle event history",
)
async def get_lineage_detail(
    lineage_id: str,
    store: TemporalLineageStore = Depends(_get_lineage_store),
) -> NarrativeLineageDetailResponse:
    """Retrieve full temporal lineage record and its complete audit event timeline."""
    lineage = store.get_lineage(lineage_id)
    if not lineage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "LINEAGE_NOT_FOUND", "message": f"Lineage '{lineage_id}' does not exist."},
        )

    events = store.get_events_for_lineage(lineage_id)
    return NarrativeLineageDetailResponse(
        lineage=lineage,
        events=events,
    )


@router.get(
    "/narratives/by-narrative/{narrative_id}",
    response_model=NarrativeLineageDetailResponse,
    summary="Resolve lineage using snapshot-local narrative identifier",
)
async def get_lineage_by_narrative(
    narrative_id: str,
    store: TemporalLineageStore = Depends(_get_lineage_store),
) -> NarrativeLineageDetailResponse:
    """Resolve temporal lineage associated with a snapshot-local narrative ID."""
    lineage = store.get_lineage_by_narrative_id(narrative_id)
    if not lineage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "LINEAGE_NOT_FOUND",
                "message": f"No temporal lineage is associated with narrative '{narrative_id}'.",
            },
        )

    events = store.get_events_for_lineage(lineage.lineage_id)
    return NarrativeLineageDetailResponse(
        lineage=lineage,
        events=events,
    )
