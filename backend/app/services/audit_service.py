"""Audit-log writing service.

Phase 1 is *fire-and-forget*: we insert best-effort and swallow any
DB error rather than letting audit failures break the parent request.
Query UIs are deferred to later phases.
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditActorType, AuditLog

logger = logging.getLogger(__name__)


async def write_audit(
    session: AsyncSession,
    *,
    actor_type: AuditActorType,
    actor_id: int | None,
    action: str,
    target_type: str | None = None,
    target_id: int | None = None,
    ip: str | None = None,
    user_agent: str | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    """Insert an ``AuditLog`` row.

    Safe to call inside a service function — any failure is logged
    but never re-raised.
    """
    try:
        row = AuditLog(
            actor_type=actor_type,
            actor_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            ip=ip,
            user_agent=user_agent,
            extra=extra,
        )
        session.add(row)
        await session.flush()
    except Exception as exc:
        logger.warning("audit_log write failed: action=%s err=%s", action, exc)


__all__ = ["write_audit"]
