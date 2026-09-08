# pyrefly: ignore [missing-import]
from fastapi import APIRouter

from app.api.v1.analytics import router as analytics_router
from app.api.v1.forecasting import router as forecasting_router
from app.api.v1.health import router as health_router
from app.api.v1.messages import router as messages_router
from app.api.v1.narratives import router as narratives_router
from app.api.v1.pipeline import router as pipeline_router
from app.api.v1.stream import router as stream_router
from app.api.v1.temporal import router as temporal_router
from app.api.v1.topics import router as topics_router
from app.api.v1.trends import router as trends_router

v1_router = APIRouter()

v1_router.include_router(health_router)
v1_router.include_router(analytics_router)
v1_router.include_router(narratives_router)
v1_router.include_router(topics_router)
v1_router.include_router(trends_router)
v1_router.include_router(messages_router)
v1_router.include_router(pipeline_router)
v1_router.include_router(temporal_router)
v1_router.include_router(stream_router)
v1_router.include_router(forecasting_router)

__all__ = ["v1_router"]

