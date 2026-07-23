"""Payment service — contract §9.

Simulated payment gateway: opening a session returns a URL the front-end
can navigate to, and the user manually "succeeds" or "fails" from there.
"""

from __future__ import annotations

import secrets
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppException, ErrorCode
from app.models.audit_log import AuditActorType
from app.models.order import Order, OrderStatus
from app.models.order_status_history import ActorType, OrderStatusHistory
from app.models.payment_session import PaymentChannel, PaymentSession, PaymentStatus
from app.models.user import User
from app.schemas.payment import PaymentAmountOnlyOut, PaymentSessionOut
from app.services.audit_service import write_audit


def _now() -> datetime:
    return datetime.now(UTC)


def _as_aware(dt: datetime | None) -> datetime | None:
    """SQLite loses timezone info; coerce naïve datetimes back to UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


def _mock_pay_url(session_id: int) -> str:
    return f"/mock-payment/{session_id}"


async def _load_order_for_user(session: AsyncSession, user: User, order_id: int) -> Order:
    order = await session.get(Order, order_id)
    if order is None:
        raise AppException(ErrorCode.ORDER_NOT_FOUND, "order not found")
    if order.user_id != user.id:
        raise AppException(ErrorCode.ORDER_PERMISSION_DENIED, "not owner")
    return order


async def _load_session_for_user(
    session: AsyncSession, user: User, session_id: int
) -> PaymentSession:
    ps = await session.get(PaymentSession, session_id)
    if ps is None:
        raise AppException(ErrorCode.PAYMENT_SESSION_NOT_FOUND, "payment session not found")
    order = await session.get(Order, ps.order_id)
    if order is None or order.user_id != user.id:
        raise AppException(ErrorCode.ORDER_PERMISSION_DENIED, "not owner")
    return ps


async def create_session(
    session: AsyncSession,
    user: User,
    order_id: int,
    channel: PaymentChannel,
    idempotency_key: str,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> PaymentSessionOut:
    order = await _load_order_for_user(session, user, order_id)
    if order.status != OrderStatus.PENDING_PAYMENT:
        raise AppException(
            ErrorCode.ORDER_STATUS_INVALID_FOR_ACTION,
            "order not awaiting payment",
        )
    if _as_aware(order.payment_deadline_at) < _now():
        raise AppException(
            ErrorCode.ORDER_PAYMENT_DEADLINE_PASSED,
            "payment deadline passed",
        )

    # Idempotency: return the existing pending session (if any).
    existing_stmt = select(PaymentSession).where(
        PaymentSession.order_id == order.id,
        PaymentSession.status == PaymentStatus.PENDING,
    )
    existing = (await session.execute(existing_stmt)).scalar_one_or_none()
    if existing is not None:
        return _to_out(existing, order.payment_deadline_at, idempotency_key)

    row = PaymentSession(
        order_id=order.id,
        channel=channel,
        amount_cents=order.total_cents,
        status=PaymentStatus.PENDING,
        external_txn_no=f"MOCK-{secrets.token_hex(8).upper()}",
    )
    try:
        session.add(row)
        await session.flush()
    except IntegrityError as exc:
        # Someone slipped in another pending session between the check and insert.
        await session.rollback()
        raise AppException(
            ErrorCode.PAYMENT_SESSION_NOT_PENDING,
            "another pending payment session already exists",
        ) from exc

    await session.refresh(row)
    await write_audit(
        session,
        actor_type=AuditActorType.USER,
        actor_id=user.id,
        action="user.payment.session_create",
        target_type="payment_session",
        target_id=row.id,
        ip=ip,
        user_agent=user_agent,
        extra={"order_id": order.id, "channel": channel.value},
    )
    return _to_out(row, order.payment_deadline_at, idempotency_key)


def _to_out(row: PaymentSession, expires_at: datetime, _idem: str) -> PaymentSessionOut:
    return PaymentSessionOut(
        session_id=row.id,
        order_id=row.order_id,
        channel=row.channel,
        amount_cents=row.amount_cents,
        status=row.status,
        external_txn_no=row.external_txn_no,
        failure_reason=row.failure_reason,
        mock_pay_url=_mock_pay_url(row.id) if row.status == PaymentStatus.PENDING else None,
        expires_at=expires_at,
        created_at=row.created_at,
        completed_at=row.completed_at,
    )


async def get_session(session: AsyncSession, user: User, session_id: int) -> PaymentSessionOut:
    ps = await _load_session_for_user(session, user, session_id)
    order = await session.get(Order, ps.order_id)
    assert order is not None
    return _to_out(ps, order.payment_deadline_at, "")


async def mock_succeed(
    session: AsyncSession,
    user: User,
    session_id: int,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> PaymentAmountOnlyOut:
    ps = await _load_session_for_user(session, user, session_id)
    if ps.status != PaymentStatus.PENDING:
        raise AppException(
            ErrorCode.PAYMENT_SESSION_NOT_PENDING,
            "payment session not pending",
        )
    order = await session.get(Order, ps.order_id)
    assert order is not None
    if order.status != OrderStatus.PENDING_PAYMENT:
        raise AppException(
            ErrorCode.ORDER_STATUS_INVALID_FOR_ACTION,
            "order not awaiting payment",
        )
    if _as_aware(order.payment_deadline_at) < _now():
        raise AppException(
            ErrorCode.ORDER_PAYMENT_DEADLINE_PASSED,
            "payment deadline passed",
        )

    now = _now()
    ps.status = PaymentStatus.SUCCEEDED
    ps.completed_at = now

    prior_status = order.status.value
    order.status = OrderStatus.PAID
    order.paid_at = now
    await session.flush()

    # write status history via the order_service helper
    session.add(
        OrderStatusHistory(
            order_id=order.id,
            from_status=prior_status,
            to_status=order.status.value,
            actor_type=ActorType.USER,
            actor_id=user.id,
            note="mock payment succeeded",
        )
    )
    await session.flush()

    await write_audit(
        session,
        actor_type=AuditActorType.USER,
        actor_id=user.id,
        action="user.payment.mock_succeed",
        target_type="payment_session",
        target_id=ps.id,
        ip=ip,
        user_agent=user_agent,
    )
    await session.refresh(order)
    return PaymentAmountOnlyOut(
        session_id=ps.id,
        order_id=order.id,
        order_status=order.status.value,
        session_status=ps.status,
    )


async def mock_fail(
    session: AsyncSession,
    user: User,
    session_id: int,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> PaymentAmountOnlyOut:
    ps = await _load_session_for_user(session, user, session_id)
    if ps.status != PaymentStatus.PENDING:
        raise AppException(
            ErrorCode.PAYMENT_SESSION_NOT_PENDING,
            "payment session not pending",
        )
    order = await session.get(Order, ps.order_id)
    assert order is not None

    ps.status = PaymentStatus.FAILED
    ps.failure_reason = "模拟支付失败: 用户点击了失败按钮"
    ps.completed_at = datetime.now(UTC)
    await session.flush()

    await write_audit(
        session,
        actor_type=AuditActorType.USER,
        actor_id=user.id,
        action="user.payment.mock_fail",
        target_type="payment_session",
        target_id=ps.id,
        ip=ip,
        user_agent=user_agent,
    )
    return PaymentAmountOnlyOut(
        session_id=ps.id,
        order_id=order.id,
        order_status=order.status.value,
        session_status=ps.status,
    )


# Public API
__all__ = [
    "create_session",
    "get_session",
    "mock_fail",
    "mock_succeed",
]
