"""User payment-mock endpoints — contract §9."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_client_ip, get_user_agent, require_user_permission
from app.core.database import get_db
from app.core.errors import envelope
from app.core.idempotency import require_idempotency_key
from app.core.rbac import Permission
from app.models.user import User
from app.schemas.payment import PayCreateIn
from app.services import payment_service

router = APIRouter()


@router.post(
    "/orders/{order_id}/pay",
    summary="Create a payment session for an order",
)
async def create_pay_session(
    order_id: int,
    payload: PayCreateIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_ORDER_CREATE)),
    idempotency_key: str = Depends(require_idempotency_key),
) -> dict[str, Any]:
    result = await payment_service.create_session(
        session,
        user,
        order_id,
        payload.channel,
        idempotency_key,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=result.model_dump(mode="json"))


@router.post(
    "/payment-sessions/{session_id}/mock-succeed",
    summary="Simulate a successful payment",
)
async def mock_succeed(
    session_id: int,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_ORDER_CREATE)),
) -> dict[str, Any]:
    result = await payment_service.mock_succeed(
        session,
        user,
        session_id,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=result.model_dump(mode="json"))


@router.post(
    "/payment-sessions/{session_id}/mock-fail",
    summary="Simulate a failed payment",
)
async def mock_fail(
    session_id: int,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_ORDER_CREATE)),
) -> dict[str, Any]:
    result = await payment_service.mock_fail(
        session,
        user,
        session_id,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=result.model_dump(mode="json"))


@router.get(
    "/payment-sessions/{session_id}",
    summary="Fetch a payment session (for polling)",
)
async def get_pay_session(
    session_id: int,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_ORDER_CREATE)),
) -> dict[str, Any]:
    result = await payment_service.get_session(session, user, session_id)
    return envelope(data=result.model_dump(mode="json"))
