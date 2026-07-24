"""Refund execution service — Phase 4 §12.

Phase 4 has no real payment gateway; refunds are a no-op that stamps a
mock ``REFUND-...`` txn number on the aftersales row. The parent
``aftersales_service`` calls :func:`simulate_refund` inside the same
transaction that flips the case to ``refunding``.

The ``simulate`` flag is retained so a later phase can wire this to a
real gateway without changing every call-site.
"""

from __future__ import annotations

import secrets
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.aftersales import Aftersales
from app.models.audit_log import AuditActorType
from app.services.audit_service import write_audit


def _mock_refund_txn_no() -> str:
    return f"REFUND-{secrets.token_hex(8).upper()}"


async def simulate_refund(
    session: AsyncSession,
    aftersales: Aftersales,
    *,
    simulate: bool = True,
) -> str:
    """Stamp a refund txn number + timestamp on the aftersales row.

    Returns the generated txn number so the caller can log / echo it.
    ``simulate=True`` skips any external gateway call (Phase 4 default).
    """
    _ = simulate  # placeholder — future phases will branch here
    txn_no = _mock_refund_txn_no()
    aftersales.refund_txn_no = txn_no
    aftersales.refunded_at = datetime.now(UTC)
    await session.flush()

    await write_audit(
        session,
        actor_type=AuditActorType.SYSTEM,
        actor_id=None,
        action="system.aftersales.refund_succeeded",
        target_type="aftersales",
        target_id=aftersales.id,
        extra={
            "refund_txn_no": txn_no,
            "amount_cents": aftersales.actual_refund_cents or aftersales.refund_amount_cents,
        },
    )
    return txn_no


__all__ = ["simulate_refund"]
