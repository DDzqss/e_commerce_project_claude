"""Risk assessment service — Phase 4 §14.

Phase 4 is a placeholder; only implements the "same-user 3+ refunds within
30 days" rule. Real risk / fraud detection is deferred.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.aftersales import Aftersales, AftersalesStatus
from app.models.user import User


async def assess_aftersales_request(
    session: AsyncSession,
    user: User,
) -> bool:
    """Return True if the request should be auto-escalated to admin arbitration.

    Rule: if the user has ≥ ``AFTERSALES_RISK_THRESHOLD`` completed_refunded
    aftersales cases within the last ``AFTERSALES_RISK_WINDOW_DAYS``, flag it.
    """
    settings = get_settings()
    cutoff = datetime.now(UTC) - timedelta(days=settings.AFTERSALES_RISK_WINDOW_DAYS)
    stmt = select(func.count(Aftersales.id)).where(
        Aftersales.user_id == user.id,
        Aftersales.status == AftersalesStatus.COMPLETED_REFUNDED,
        Aftersales.refunded_at.is_not(None),
        Aftersales.refunded_at >= cutoff,
    )
    count = int((await session.execute(stmt)).scalar_one())
    return count >= settings.AFTERSALES_RISK_THRESHOLD


__all__ = ["assess_aftersales_request"]
