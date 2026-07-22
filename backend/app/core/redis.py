"""Async Redis client accessor.

Provides an application-scoped :class:`redis.asyncio.Redis` client and
a FastAPI dependency ``get_redis``. Tests can override the dependency
with a ``fakeredis.aioredis.FakeRedis`` instance.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import redis.asyncio as aioredis

from app.core.config import get_settings

# Wrap the singleton in a dict to avoid the ``global`` keyword (ruff PLW0603).
_state: dict[str, aioredis.Redis | None] = {"client": None}


def get_redis_client() -> aioredis.Redis:
    """Return the process-wide Redis client (lazy-initialized)."""
    client = _state["client"]
    if client is None:
        settings = get_settings()
        client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
        _state["client"] = client
    return client


async def get_redis() -> AsyncIterator[aioredis.Redis]:
    """FastAPI dependency yielding the shared Redis client."""
    yield get_redis_client()


async def close_redis() -> None:
    """Dispose the shared Redis client (called on shutdown)."""
    client = _state["client"]
    if client is not None:
        await client.aclose()
        _state["client"] = None


__all__ = ["close_redis", "get_redis", "get_redis_client"]
