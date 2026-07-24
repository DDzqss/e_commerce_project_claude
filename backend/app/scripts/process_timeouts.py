"""Timeout scanner — contract §12 + Phase 4 §11.

Sweeps through both order-side and aftersales-side deadlines and runs the
appropriate transitions in batched slices of 100. Safe to run on a cron
every 1-5 minutes.

Order-side (Phase 3):
1. Expire ``pending_payment`` orders whose payment deadline has passed
2. Auto-complete ``shipped`` orders whose ``auto_complete_at`` has passed

Aftersales-side (Phase 4):
1. Merchant 72h no-review → admin_arbitrating (merchant_timeout)
2. User 7d no-return → system_closed (user_ship_timeout)
3. Merchant 15d no-receive → auto-confirm (refund / continue exchange)
4. Exchange 15d no user-confirm → completed_exchanged (auto_confirmed)

Both loops guard with ``WHERE status = X AND deadline < now`` so a re-run
after the transition is a no-op.

Usage::

    uv run python -m app.scripts.process_timeouts
    uv run python -m app.scripts.process_timeouts --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory, dispose_engine
from app.models.aftersales import Aftersales, AftersalesStatus
from app.models.order import Order, OrderStatus
from app.services import aftersales_service, order_service

logger = logging.getLogger(__name__)


async def _run(dry_run: bool) -> dict[str, int]:
    counts: dict[str, int] = {
        "expired_pending_payments": 0,
        "auto_completed_orders": 0,
        "aftersales_merchant_review_timeouts": 0,
        "aftersales_user_return_timeouts": 0,
        "aftersales_merchant_receive_timeouts": 0,
        "aftersales_exchange_confirm_timeouts": 0,
    }

    async with async_session_factory() as session:
        if dry_run:
            expired_ids = await _list_candidate_expired(session)
            completed_ids = await _list_candidate_completed(session)
            merchant_ids = await _list_candidate_merchant_review(session)
            return_ids = await _list_candidate_user_return(session)
            receive_ids = await _list_candidate_merchant_receive(session)
            exchange_ids = await _list_candidate_exchange_confirm(session)
            logger.info("[dry-run] expire=%d %s", len(expired_ids), expired_ids)
            logger.info("[dry-run] complete=%d %s", len(completed_ids), completed_ids)
            logger.info("[dry-run] as-merchant=%d %s", len(merchant_ids), merchant_ids)
            logger.info("[dry-run] as-return=%d %s", len(return_ids), return_ids)
            logger.info("[dry-run] as-receive=%d %s", len(receive_ids), receive_ids)
            logger.info("[dry-run] as-exchange=%d %s", len(exchange_ids), exchange_ids)
            counts["expired_pending_payments"] = len(expired_ids)
            counts["auto_completed_orders"] = len(completed_ids)
            counts["aftersales_merchant_review_timeouts"] = len(merchant_ids)
            counts["aftersales_user_return_timeouts"] = len(return_ids)
            counts["aftersales_merchant_receive_timeouts"] = len(receive_ids)
            counts["aftersales_exchange_confirm_timeouts"] = len(exchange_ids)
            return counts

        # Order-side sweeps (Phase 3).
        while True:
            n = await order_service.scan_and_expire_payments(session, batch=100)
            await session.commit()
            counts["expired_pending_payments"] += n
            if n < 100:
                break
        while True:
            n = await order_service.scan_and_auto_complete(session, batch=100)
            await session.commit()
            counts["auto_completed_orders"] += n
            if n < 100:
                break

        # Aftersales-side sweeps (Phase 4).
        while True:
            n = await aftersales_service.scan_merchant_review_timeouts(session, batch=100)
            await session.commit()
            counts["aftersales_merchant_review_timeouts"] += n
            if n < 100:
                break
        while True:
            n = await aftersales_service.scan_user_return_timeouts(session, batch=100)
            await session.commit()
            counts["aftersales_user_return_timeouts"] += n
            if n < 100:
                break
        while True:
            n = await aftersales_service.scan_merchant_receive_timeouts(session, batch=100)
            await session.commit()
            counts["aftersales_merchant_receive_timeouts"] += n
            if n < 100:
                break
        while True:
            n = await aftersales_service.scan_exchange_confirm_timeouts(session, batch=100)
            await session.commit()
            counts["aftersales_exchange_confirm_timeouts"] += n
            if n < 100:
                break

    logger.info("process_timeouts: %s", counts)
    return counts


async def _list_candidate_expired(session: AsyncSession) -> list[int]:
    now = datetime.now(UTC)
    stmt = select(Order.id).where(
        Order.status == OrderStatus.PENDING_PAYMENT, Order.payment_deadline_at < now
    )
    return list((await session.execute(stmt)).scalars().all())


async def _list_candidate_completed(session: AsyncSession) -> list[int]:
    now = datetime.now(UTC)
    stmt = select(Order.id).where(
        Order.status == OrderStatus.SHIPPED,
        Order.auto_complete_at.is_not(None),
        Order.auto_complete_at < now,
    )
    return list((await session.execute(stmt)).scalars().all())


async def _list_candidate_merchant_review(session: AsyncSession) -> list[int]:
    now = datetime.now(UTC)
    stmt = select(Aftersales.id).where(
        Aftersales.status == AftersalesStatus.PENDING_MERCHANT_REVIEW,
        Aftersales.merchant_review_deadline < now,
    )
    return list((await session.execute(stmt)).scalars().all())


async def _list_candidate_user_return(session: AsyncSession) -> list[int]:
    now = datetime.now(UTC)
    stmt = select(Aftersales.id).where(
        Aftersales.status == AftersalesStatus.MERCHANT_AGREED_WAITING_RETURN,
        Aftersales.return_ship_deadline.is_not(None),
        Aftersales.return_ship_deadline < now,
    )
    return list((await session.execute(stmt)).scalars().all())


async def _list_candidate_merchant_receive(session: AsyncSession) -> list[int]:
    now = datetime.now(UTC)
    stmt = select(Aftersales.id).where(
        Aftersales.status == AftersalesStatus.RETURN_SHIPPED_WAITING_RECEIVE,
        Aftersales.merchant_receive_deadline.is_not(None),
        Aftersales.merchant_receive_deadline < now,
    )
    return list((await session.execute(stmt)).scalars().all())


async def _list_candidate_exchange_confirm(session: AsyncSession) -> list[int]:
    now = datetime.now(UTC)
    stmt = select(Aftersales.id).where(
        Aftersales.status == AftersalesStatus.EXCHANGE_SHIPPED_WAITING_RECEIVE,
        Aftersales.exchange_confirm_deadline.is_not(None),
        Aftersales.exchange_confirm_deadline < now,
    )
    return list((await session.execute(stmt)).scalars().all())


async def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Order + aftersales timeout scanner")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only report what would be updated; make no changes.",
    )
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-5s %(name)s: %(message)s",
    )
    try:
        await _run(args.dry_run)
    finally:
        await dispose_engine()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
