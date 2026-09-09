from datetime import datetime, timezone
import math
import re
from typing import Any, Literal
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import (
    MessageService,
    get_artifact_repository,
    get_message_service,
    require_ntro_analyst,
)
from app.ml.language import identify_language
from app.repositories.artifact_repository import ArtifactRepository
from app.schemas.api.messages import (
    MessageDetailResponse,
    MessageListResponse,
    TriageReportResponse,
    TriageRequest,
)

router = APIRouter(dependencies=[Depends(require_ntro_analyst)])


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

    # 4. Active Narrative Matching via Content-Aware Semantic Overlap
    best_narrative_id = None
    best_narrative_title = None
    best_narrative_summary = None
    best_similarity = 0.0
    matched_topic_id = None

    TEMPORAL_GENERIC_STOPWORDS = {
        "january", "february", "march", "april", "may", "june", "july", "august", "september",
        "october", "november", "december", "monday", "tuesday", "wednesday", "thursday", "friday",
        "saturday", "sunday", "mon", "tue", "wed", "thu", "fri", "sat", "sun", "stats", "today",
        "yesterday", "breaking", "update", "time", "first", "since", "early", "roughly", "between",
        "amid", "above", "below", "week", "month", "year", "days", "hours", "news", "report",
    }
    content_tokens = tokens - TEMPORAL_GENERIC_STOPWORDS

    def synthesize_clean_title(raw_name: str, summary: str | None, topic_obj: Any | None) -> str:
        # Strip topic brackets like [topic_060] or [#tags]
        cleaned = re.sub(r"\[.*?\]", "", raw_name).strip()
        cleaned = re.sub(r"[\u2010-\u2015\u2212\uff0d—–]", "-", cleaned)
        cleaned = re.sub(r"^(rainbetcom|venotify|pwatch|osintdefender|geopwatch|moscow|bloomberg|reuters)[-_ ]*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"[-_ ]*(Discourse|Coverage|Developments)$", "", cleaned, flags=re.IGNORECASE).strip(" -:,")

        # If title looks like raw comma-separated keywords or is too obscure/short, extract concise headline from summary
        if summary and (not cleaned or "," in cleaned or len(cleaned.split()) <= 2 or any(t in cleaned.lower() for t in ["stats", "topic_"])):
            first_clause = summary.split(".")[0].strip()
            first_clause = re.sub(r"^(according to|reports indicate|sources say|earlier today|reuters|bloomberg|official|spokesperson)\s*[:-]?\s*", "", first_clause, flags=re.IGNORECASE)
            words = [w for w in first_clause.split() if not w.startswith("http") and not w.startswith("@")]
            if 3 <= len(words) <= 9:
                return " ".join(words).strip(" -:,.").title()
            elif len(words) > 9:
                return " ".join(words[:8]).strip(" -:,.").title()

        if cleaned and "," not in cleaned and len(cleaned.split()) >= 2:
            return cleaned.strip(" -:,").title()

        if summary:
            first_clause = summary.split(".")[0].strip()
            words = [w for w in first_clause.split() if not w.startswith("http") and not w.startswith("@")][:8]
            if len(words) >= 3:
                return " ".join(words).strip(" -:,.").title()

        if topic_obj and hasattr(topic_obj, "representative_keywords"):
            kws = [k.keyword for k in topic_obj.representative_keywords if len(k.keyword) >= 3 and k.keyword.lower() not in TEMPORAL_GENERIC_STOPWORDS][:3]
            if kws:
                return (" ".join(k.title() for k in kws) + " Dynamics").strip()

        return cleaned.strip(" -:,").title() or "Strategic Narrative Track"

    if repo.artifacts_loaded and repo._narratives_by_id and len(content_tokens) >= 1:
        for nid, narr in repo._narratives_by_id.items():
            claim_tokens = set(re.findall(r"\b[a-zA-Zа-яА-Я0-9_-]{4,}\b", (narr.headline_claim or "").lower())) - TEMPORAL_GENERIC_STOPWORDS
            name_tokens = set(re.findall(r"\b[a-zA-Zа-яА-Я0-9_-]{4,}\b", (getattr(narr, "narrative_name", "") or "").lower())) - TEMPORAL_GENERIC_STOPWORDS
            summary_tokens = set(re.findall(r"\b[a-zA-Zа-яА-Я0-9_-]{4,}\b", (getattr(narr, "narrative_summary", "") or "").lower())) - TEMPORAL_GENERIC_STOPWORDS

            topic = repo._topics_by_id.get(narr.promoted_from_topic_id)
            keyword_tokens = set()
            if topic:
                for kw in topic.representative_keywords:
                    keyword_tokens.update(set(re.findall(r"\b[a-zA-Zа-яА-Я0-9_-]{4,}\b", kw.keyword.lower())) - TEMPORAL_GENERIC_STOPWORDS)

            all_target_tokens = claim_tokens | keyword_tokens | name_tokens | summary_tokens
            if not all_target_tokens:
                continue

            overlap = content_tokens & all_target_tokens
            # Require at least 2 distinct topical content tokens to avoid accidental single-word noise
            if len(overlap) < 2:
                continue

            summary_hits = len(content_tokens & summary_tokens)
            claim_hits = len(content_tokens & claim_tokens)
            kw_hits = len(content_tokens & keyword_tokens)

            jaccard = len(overlap) / max(len(content_tokens | all_target_tokens), 1)
            score = (len(overlap) * 0.25) + (summary_hits * 0.20) + (claim_hits * 0.15) + (kw_hits * 0.10) + jaccard

            if score > best_similarity:
                best_similarity = score
                best_narrative_id = narr.narrative_id
                raw_name = getattr(narr, "narrative_name", None) or narr.headline_claim
                narr_summary = getattr(narr, "narrative_summary", None)
                best_narrative_title = synthesize_clean_title(raw_name, narr_summary, topic)
                best_narrative_summary = narr_summary
                matched_topic_id = narr.promoted_from_topic_id

    # Normalized similarity percentage [0.0, 100.0]
    sim_pct = round(min(best_similarity * 28.0, 96.0), 1) if best_similarity >= 0.40 else 0.0
    if sim_pct < 25.0:
        best_narrative_id = None
        best_narrative_title = None
        best_narrative_summary = None
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
        indicators.append(f"Correlated with narrative: {best_narrative_title} ({sim_pct:.1f}% alignment)")

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
        matched_narrative_summary=best_narrative_summary,
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
