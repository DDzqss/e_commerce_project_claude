"""Timeout scanner — contract §12.

Two responsibilities:

1. Expire ``pending_payment`` orders whose payment deadline has passed;
   cancel them + release stock + write history rows.
2. Auto-complete ``shipped`` orders whose ``auto_complete_at`` has
   passed; mark the sale as final + update sold_count / sales_count.

Both loops batch in slices of 100 to avoid long transactions on large
backlogs. The whole thing is safe to run on a cron every 1-5 minutes.

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
from app.models.order import Order, OrderStatus
from app.services import order_service

logger = logging.getLogger(__name__)


async def _run(dry_run: bool) -> tuple[int, int]:
    total_expired = 0
    total_completed = 0

    async with async_session_factory() as session:
        if dry_run:
            expired_ids = await _list_candidate_expired(session)
            completed_ids = await _list_candidate_completed(session)
            logger.info(
                "[dry-run] would expire %d orders: %s",
                len(expired_ids),
                expired_ids,
            )
            logger.info(
                "[dry-run] would auto-complete %d orders: %s",
                len(completed_ids),
                completed_ids,
            )
            return len(expired_ids), len(completed_ids)

        # Loop until nothing left to process (batched at 100 by the service).
        while True:
            n = await order_service.scan_and_expire_payments(session, batch=100)
            await session.commit()
            total_expired += n
            if n < 100:
                break
        while True:
            n = await order_service.scan_and_auto_complete(session, batch=100)
            await session.commit()
            total_completed += n
            if n < 100:
                break

    logger.info("process_timeouts: expired=%d completed=%d", total_expired, total_completed)
    return total_expired, total_completed


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


async def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Order timeout scanner")
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
