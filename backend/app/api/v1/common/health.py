"""Detailed health / readiness probe.

Distinct from the top-level ``/health`` liveness probe: this endpoint
actively pings dependencies (DB, Redis) so orchestrators can decide
whether to route traffic to the pod.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app import __version__
from app.core.config import get_settings
from app.core.database import get_db

router = APIRouter()

Status = Literal["ok", "degraded", "down"]


async def _check_db(session: AsyncSession) -> tuple[Status, str | None]:
    try:
        await session.execute(text("SELECT 1"))
        return "ok", None
    except Exception as exc:
        return "down", str(exc)


async def _check_redis(url: str) -> tuple[Status, str | None]:
    client: aioredis.Redis | None = None
    try:
        client = aioredis.from_url(url, socket_connect_timeout=2, socket_timeout=2)
        pong = await client.ping()
        return ("ok", None) if pong else ("down", "no PONG")
    except Exception as exc:
        return "down", str(exc)
    finally:
        if client is not None:
            await client.aclose()


@router.get(
    "/health",
    summary="Readiness probe (DB + Redis)",
    response_model=None,
)
async def health_detailed(session: AsyncSession = Depends(get_db)) -> dict[str, object]:
    """Ping downstream dependencies and report their status."""
    settings = get_settings()

    db_status, db_err = await _check_db(session)
    redis_status, redis_err = await _check_redis(settings.REDIS_URL)

    overall: Status = "ok"
    if "down" in (db_status, redis_status):
        overall = "down"
    elif "degraded" in (db_status, redis_status):
        overall = "degraded"

    return {
        "status": overall,
        "version": __version__,
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.now(UTC).isoformat(),
        "checks": {
            "database": {"status": db_status, "error": db_err},
            "redis": {"status": redis_status, "error": redis_err},
        },
    }
