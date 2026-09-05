import logging
from app.repositories.artifact_repository import ArtifactRepository, get_artifact_repository
from app.schemas.api.analytics import AnalyticsOverviewData
from app.schemas.api.common import PaginationMeta
from app.schemas.api.narratives import NarrativeCandidate, NarrativeSummaryResponse
from app.schemas.api.topics import TopicDetailData, TopicSummaryResponse

logger = logging.getLogger("traject.services.analytics")


class AnalyticsService:
    """Business logic and service orchestration layer for analytics, narratives, and topics."""

    def __init__(self, repository: ArtifactRepository | None = None) -> None:
        self.repository = repository or get_artifact_repository()

    def get_overview(self) -> AnalyticsOverviewData:
        return self.repository.get_analytics_overview()

    def get_narratives(
        self,
        page: int = 1,
        page_size: int = 20,
        priority_tier: str | None = None,
        min_priority: float | None = None,
        has_coordination_signal: bool | None = None,
        sort_by: str = "priority_signal_score",
        order: str = "desc",
    ) -> tuple[list[NarrativeSummaryResponse], PaginationMeta]:
        return self.repository.get_narratives(
            page=page,
            page_size=page_size,
            priority_tier=priority_tier,
            min_priority=min_priority,
            has_coordination_signal=has_coordination_signal,
            sort_by=sort_by,
            order=order,
        )

    def get_narrative(self, narrative_id: str) -> NarrativeCandidate | None:
        return self.repository.get_narrative_by_id(narrative_id)

    def get_topics(
        self,
        page: int = 1,
        page_size: int = 20,
        min_messages: int | None = None,
        sort_by: str = "message_count",
        order: str = "desc",
    ) -> tuple[list[TopicSummaryResponse], PaginationMeta]:
        return self.repository.get_topics(
            page=page,
            page_size=page_size,
            min_messages=min_messages,
            sort_by=sort_by,
            order=order,
        )

    def get_topic(self, topic_id: str) -> TopicDetailData | None:
        return self.repository.get_topic_by_id(topic_id)


_shared_analytics_service: AnalyticsService | None = None


def get_analytics_service() -> AnalyticsService:
    global _shared_analytics_service
    if _shared_analytics_service is None:
        _shared_analytics_service = AnalyticsService()
    return _shared_analytics_service
