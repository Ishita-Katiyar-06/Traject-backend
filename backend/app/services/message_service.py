import logging
from app.repositories.artifact_repository import ArtifactRepository, get_artifact_repository
from app.schemas.api.common import PaginationMeta
from app.schemas.api.messages import MessageDetailData, MessageSummaryResponse

logger = logging.getLogger("traject.services.message")


class MessageService:
    """Business logic and querying layer for canonical messages."""

    def __init__(self, repository: ArtifactRepository | None = None) -> None:
        self.repository = repository or get_artifact_repository()

    def get_messages(
        self,
        page: int = 1,
        page_size: int = 20,
        query: str | None = None,
        platform: str | None = None,
        channel_id: str | None = None,
        topic_id: str | None = None,
        has_media: bool | None = None,
        is_forward: bool | None = None,
        language: str | None = None,
        sort_by: str = "published_at",
        order: str = "desc",
    ) -> tuple[list[MessageSummaryResponse], PaginationMeta]:
        return self.repository.get_messages(
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
            order=order,
        )

    def get_message(self, message_id: str) -> MessageDetailData | None:
        return self.repository.get_message_by_id(message_id)


_shared_message_service: MessageService | None = None


def get_message_service() -> MessageService:
    global _shared_message_service
    if _shared_message_service is None:
        _shared_message_service = MessageService()
    return _shared_message_service
