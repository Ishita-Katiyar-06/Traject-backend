from datetime import datetime, timezone
import math
import re
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import MessageService, get_artifact_repository, get_message_service
from app.ml.language import identify_language
from app.repositories.artifact_repository import ArtifactRepository
from app.schemas.api.messages import (
    MessageDetailResponse,
    MessageListResponse,
    TriageReportResponse,
    TriageRequest,
)

router = APIRouter()


@router.post(
    "/messages/triage",
    response_model=TriageReportResponse,
    summary="Perform on-demand forensic triage on a message or forwarded post",
    tags=["Messages"],
)
async def triage_message(
    payload: TriageRequest,
    repo: ArtifactRepository = Depends(get_artifact_repository),
) -> TriageReportResponse:
    """Execute on-demand forensic triage across language ID, sentiment, active narrative matching,
    and uncredited syndication detection for incoming or forwarded posts.
    """
    raw_text = payload.text.strip()
    now_utc = datetime.now(timezone.utc).isoformat()

    # 1. Deterministic Language Identification
    try:
        lang_res = identify_language(raw_text)
        detected_lang = lang_res.language
        lang_conf = round(float(lang_res.confidence), 3)
    except Exception:
        detected_lang = "unknown"
        lang_conf = 0.50

    # 2. Text Normalization & Token Extraction
    tokens = set(re.findall(r"\b[a-zA-Zа-яА-Я0-9_-]{4,}\b", raw_text.lower()))

    # 3. Sentiment Evaluation (Lexical fallback + Model heuristic)
    neg_tokens = {
        "kill", "killed", "strike", "attack", "casualt", "casualty", "casualties",
        "explod", "explosion", "bomb", "bombing", "destroy", "destroyed", "death",
        "fake", "propaganda", "missile", "drone", "fraud", "scam", "loss", "crash",
        "disaster", "crisis", "threat", "danger", "terror", "war", "damage"
    }
    pos_tokens = {
        "peace", "win", "victory", "success", "liberat", "liberated", "agreement",
        "recover", "recovered", "gain", "breakthrough", "safe", "safety", "aid", "hero"
    }
    
    neg_count = sum(1 for t in tokens if any(n in t for n in neg_tokens))
    pos_count = sum(1 for t in tokens if any(p in t for p in pos_tokens))
    total_sentiment_hits = neg_count + pos_count

    if total_sentiment_hits == 0:
        sentiment_label = "NEUTRAL"
        sentiment_conf = 0.65
        neg_ratio = 0.20
    elif neg_count >= pos_count:
        sentiment_label = "NEGATIVE"
        sentiment_conf = round(min(0.60 + 0.10 * neg_count, 0.95), 3)
        neg_ratio = round(neg_count / max(total_sentiment_hits, 1), 3)
    else:
        sentiment_label = "POSITIVE"
        sentiment_conf = round(min(0.60 + 0.10 * pos_count, 0.90), 3)
        neg_ratio = round(neg_count / max(total_sentiment_hits, 1), 3)

    # 4. Active Narrative Matching via Lexical & Centroid Keyword Overlap
    best_narrative_id = None
    best_narrative_title = None
    best_similarity = 0.0
    matched_topic_id = None

    if repo.artifacts_loaded and repo._narratives_by_id:
        for nid, narr in repo._narratives_by_id.items():
            claim_tokens = set(re.findall(r"\b[a-zA-Zа-яА-Я0-9_-]{4,}\b", narr.headline_claim.lower()))
            topic = repo._topics_by_id.get(narr.promoted_from_topic_id)
            keyword_tokens = set()
            if topic:
                for kw in topic.representative_keywords:
                    keyword_tokens.update(re.findall(r"\b[a-zA-Zа-яА-Я0-9_-]{4,}\b", kw.keyword.lower()))

            all_target_tokens = claim_tokens | keyword_tokens
            if not all_target_tokens:
                continue

            intersection = tokens & all_target_tokens
            union = tokens | all_target_tokens
            jaccard = len(intersection) / max(len(union), 1)

            # Weight claim title hits higher
            claim_hits = len(tokens & claim_tokens)
            score = jaccard + (0.15 * claim_hits)

            if score > best_similarity:
                best_similarity = score
                best_narrative_id = narr.narrative_id
                best_narrative_title = narr.headline_claim
                matched_topic_id = narr.promoted_from_topic_id

    # Normalized similarity percentage [0.0, 100.0]
    sim_pct = round(min(best_similarity * 140.0, 98.5), 1) if best_similarity > 0.08 else 0.0
    if sim_pct < 25.0:
        best_narrative_id = None
        best_narrative_title = None
        sim_pct = 0.0

    # 5. Uncredited Syndication Detection across Existing Corpus
    syndicated = False
    synd_channels = set()
    author_clean = (payload.author or payload.forward_origin or "").lstrip("@").lower()

    if repo._messages and len(tokens) >= 5:
        for existing_msg in repo._messages[:500]:  # Inspect sample of corpus
            ex_author = (existing_msg.author_username or existing_msg.channel_title or "").lstrip("@").lower()
            if author_clean and ex_author and author_clean == ex_author:
                continue

            ex_text = (existing_msg.text_content or "").lower()
            ex_tokens = set(re.findall(r"\b[a-zA-Zа-яА-Я0-9_-]{4,}\b", ex_text))
            if not ex_tokens:
                continue

            inter = tokens & ex_tokens
            overlap = len(inter) / max(min(len(tokens), len(ex_tokens)), 1)
            if overlap >= 0.75:
                syndicated = True
                if ex_author:
                    synd_channels.add(ex_author)

    # 6. Estimated Priority Signal Score & Tier
    indicators = []
    base_score = 0.25

    if best_narrative_id and repo._narratives_by_id.get(best_narrative_id):
        parent_narr = repo._narratives_by_id[best_narrative_id]
        base_score = max(base_score, parent_narr.priority_signal_score * (sim_pct / 100.0))
        indicators.append(f"Matched active cluster '{best_narrative_title[:45]}...' ({sim_pct:.1f}% similarity)")

    if syndicated:
        base_score += 0.22
        indicators.append(f"Uncredited syndication across {len(synd_channels) or 'multiple'} observed channel(s)")

    if payload.forward_origin:
        base_score += 0.10
        indicators.append(f"Direct forwarded transmission from @{payload.forward_origin.lstrip('@')}")

    if (payload.views or 0) >= 10000 or (payload.forwards or 0) >= 20:
        base_score += 0.15
        indicators.append(f"High audience velocity: {payload.views or 0:,} views, {payload.forwards or 0:,} forwards")

    if sentiment_label == "NEGATIVE":
        base_score += 0.08
        indicators.append(f"High controversy/negative polarization (negativity ratio: {neg_ratio:.2f})")

    est_score = round(max(0.05, min(base_score, 0.96)), 3)

    if est_score >= 0.75:
        tier = "CRITICAL"
    elif est_score >= 0.55:
        tier = "HIGH"
    elif est_score >= 0.35:
        tier = "ELEVATED"
    else:
        tier = "ROUTINE"

    if not indicators:
        indicators.append("Standard social post with no anomalous velocity breaches.")

    return TriageReportResponse(
        processed_text=raw_text[:200] + ("..." if len(raw_text) > 200 else ""),
        detected_language=detected_lang,
        language_confidence=lang_conf,
        sentiment_label=sentiment_label,
        sentiment_confidence=sentiment_conf,
        negative_ratio=neg_ratio,
        matched_narrative_id=best_narrative_id,
        matched_narrative_title=best_narrative_title,
        similarity_percentage=sim_pct,
        estimated_priority_tier=tier,
        estimated_priority_score=est_score,
        uncredited_syndication_detected=syndicated,
        syndicated_channel_count=len(synd_channels),
        indicators=indicators,
        triaged_at_utc=now_utc,
    )


@router.get(
    "/messages",
    response_model=MessageListResponse,
    summary="List normalized canonical messages",
    tags=["Messages"],
)
async def list_messages(
    page: int = Query(1, ge=1, description="1-indexed page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size limit"),
    query: str | None = Query(None, description="Search query across message text_content, channel_title, or username"),
    platform: str | None = Query(None, description="Filter by platform (e.g. 'telegram', 'x')"),
    channel_id: str | None = Query(None, description="Filter by author or channel ID"),
    topic_id: str | None = Query(None, description="Filter to messages belonging to a topic cluster"),
    has_media: bool | None = Query(None, description="Filter by media attachment presence"),
    is_forward: bool | None = Query(None, description="Filter by forward status"),
    language: str | None = Query(None, description="Filter by detected ISO language code"),
    sort_by: Literal["published_at", "views_count", "forwards_count"] = Query(
        "published_at", description="Sorting field"
    ),
    order: Literal["asc", "desc"] = Query("desc", description="Sort order"),
    service: MessageService = Depends(get_message_service),
) -> MessageListResponse:
    """Retrieve a paginated collection of normalized canonical social media posts."""
    try:
        items, meta = service.get_messages(
            page=page,
            page_size=page_size,
            query=query,
            platform=platform,
            channel_id=channel_id,
            topic_id=topic_id,
            has_media=has_media,
            is_forward=is_forward,
            language=language,
            sort_by=sort_by,
        )

        # Refresh live views via MTProto client if live collector is actively running
        try:
            from app.services.live_collector_service import get_live_collector_service
            collector = get_live_collector_service()
            if collector and collector.is_running and collector.client:
                for item in items:
                    if item.author_username and item.native_id:
                        try:
                            fresh_views = await collector.refresh_message_views(item.author_username, int(item.native_id))
                            if fresh_views is not None:
                                item.views_count = fresh_views
                        except Exception:
                            pass
        except Exception:
            pass

        return MessageListResponse(data=items, meta=meta)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "DATASET_NOT_FOUND", "message": str(exc)},
        )


@router.get(
    "/messages/{message_id:path}",
    response_model=MessageDetailResponse,
    summary="Retrieve full canonical message by unique identifier",
    tags=["Messages"],
)
async def get_message(
    message_id: str,
    service: MessageService = Depends(get_message_service),
) -> MessageDetailResponse:
    """Retrieve the full forensic record of a canonical message by its identifier.
    
    Supports chat-scoped Telegram IDs (e.g. 'telegram:chan1:101' or 'telegram%3Achan1%3A101')
    and global X IDs (e.g. 'x:182938492').
    """
    try:
        msg = service.get_message(message_id)
        if not msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": "RESOURCE_NOT_FOUND",
                    "message": f"Message with canonical ID '{message_id}' not found.",
                    "details": {"resource_type": "message", "identifier": message_id},
                },
            )
        return MessageDetailResponse(data=msg)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "DATASET_NOT_FOUND", "message": str(exc)},
        )
