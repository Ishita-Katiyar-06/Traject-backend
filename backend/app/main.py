import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import logging
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import v1_router
from app.core.config import APISettings, get_settings
from app.repositories.artifact_repository import get_artifact_repository
from app.schemas.api.common import ErrorDetail, ErrorEnvelope

logger = logging.getLogger("traject.api")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifecycle management: initialize in-memory artifact repository on startup."""
    settings = get_settings()
    repo = get_artifact_repository()
    
    # Configure logging level
    log_level = getattr(logging, settings.log_level.upper(), logging.INFO)
    logging.basicConfig(level=log_level, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    
    logger.info("Initializing TRAJECT Backend Analytics API (Version 0.1.0)...")
    success = repo.load_artifacts()
    if success:
        logger.info(
            "Artifacts loaded successfully: %d messages, %d narratives.",
            len(repo._messages),
            len(repo._narratives_by_id),
        )
    else:
        logger.warning("Backend started in degraded mode (analytics artifacts not loaded).")
    
    # Initialize and start Real-Time Telegram Collector & In-flight Alerting
    from app.services.live_collector_service import get_live_collector_service
    collector_service = get_live_collector_service()
    collector_task = asyncio.create_task(collector_service.start())

    yield

    logger.info("Shutting down TRAJECT Backend Analytics API.")
    await collector_service.stop()
    if not collector_task.done():
        collector_task.cancel()


def create_app(settings: APISettings | None = None) -> FastAPI:
    """FastAPI application factory."""
    cfg = settings or get_settings()

    app = FastAPI(
        title="TRAJECT Backend Analytics API",
        description=(
            "High-performance, typed, versioned serving API exposing precomputed narrative "
            "intelligence, semantic topic clusters, and canonical social media streams."
        ),
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # 1. CORS Configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.api_cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "OPTIONS"],
        allow_headers=["*"],
    )

    # 2. Register API v1 Routers
    app.include_router(v1_router, prefix=cfg.api_prefix)

    # 3. Custom Error Handlers conforming to ErrorEnvelope specification

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        error_details = []
        for err in exc.errors():
            loc = " -> ".join(str(l) for l in err.get("loc", []))
            msg = err.get("msg", "Validation error")
            error_details.append(f"{loc}: {msg}")
        
        envelope = ErrorEnvelope(
            error=ErrorDetail(
                code="INVALID_QUERY_PARAMETER",
                message="Request validation failed: " + "; ".join(error_details),
                details={"errors": exc.errors()},
                timestamp_utc=datetime.now(timezone.utc).isoformat(),
            )
        )
        return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=envelope.model_dump())

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        if isinstance(exc.detail, dict) and "code" in exc.detail:
            code = exc.detail["code"]
            msg = exc.detail.get("message", "An HTTP error occurred.")
            extra = exc.detail.get("details", {})
        else:
            code = "HTTP_ERROR"
            msg = str(exc.detail)
            extra = {}

        envelope = ErrorEnvelope(
            error=ErrorDetail(
                code=code,
                message=msg,
                details=extra,
                timestamp_utc=datetime.now(timezone.utc).isoformat(),
            )
        )
        return JSONResponse(status_code=exc.status_code, content=envelope.model_dump())

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.error("Unhandled exception on %s: %s", request.url.path, exc, exc_info=True)
        envelope = ErrorEnvelope(
            error=ErrorDetail(
                code="INTERNAL_SERVER_ERROR",
                message="An unexpected internal server error occurred.",
                details={},
                timestamp_utc=datetime.now(timezone.utc).isoformat(),
            )
        )
        return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=envelope.model_dump())

    return app


app = create_app()
