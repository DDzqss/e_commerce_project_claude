"""FastAPI application entrypoint.

Bootstraps the JD-Clone backend: config, CORS, router mounting, and
lifecycle hooks. Business routers live under ``app.api.v1``; this module
only wires them up.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.v1 import api_router as v1_router
from app.core.config import get_settings


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Application lifespan hook.

    Placeholder for future startup/shutdown wiring (e.g. warm DB pool,
    prime Redis connection, register workers).
    """
    # startup
    yield
    # shutdown


def create_app() -> FastAPI:
    """FastAPI application factory."""
    settings = get_settings()

    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=__version__,
        description="JD-Clone e-commerce platform backend API.",
        openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Mount v1 API
    app.include_router(v1_router, prefix=settings.API_V1_PREFIX)

    # Top-level lightweight health probe (Kubernetes liveness style).
    # A richer probe (DB + Redis) is exposed under /api/v1/common/health.
    @app.get("/health", tags=["health"], summary="Liveness probe")
    async def health() -> dict[str, str]:
        return {
            "status": "ok",
            "version": __version__,
            "timestamp": datetime.now(UTC).isoformat(),
        }

    return app


app = create_app()
