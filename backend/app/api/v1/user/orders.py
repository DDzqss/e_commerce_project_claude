"""User order endpoints — contract §8."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_client_ip, get_user_agent, require_user_permission
from app.core.database import get_db
from app.core.errors import envelope
from app.core.idempotency import require_idempotency_key
from app.core.rbac import Permission
from app.models.user import User
from app.schemas.order import (
    OrderCancelIn,
    OrderCreateIn,
    OrderPreviewIn,
)
from app.services import order_service

router = APIRouter()


@router.post("/preview", summary="Preview an order before creation")
async def preview_orders(
    payload: OrderPreviewIn,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_ORDER_CREATE)),
) -> dict[str, Any]:
    result = await order_service.preview(session, user, payload.cart_item_ids, payload.address_id)
    return envelope(data=result.model_dump(mode="json"))


@router.post(
    "", status_code=status.HTTP_201_CREATED, summary="Create orders (may fan out per shop)"
)
async def create_orders(
    payload: OrderCreateIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_ORDER_CREATE)),
    idempotency_key: str = Depends(require_idempotency_key),
) -> dict[str, Any]:
    result = await order_service.create(
        session,
        user,
        payload.cart_item_ids,
        payload.address_id,
        payload.user_note,
        idempotency_key,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=result.model_dump(mode="json"))


@router.get("", summary="List my orders")
async def list_orders(
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_ORDER_READ_OWN)),
    status_: str | None = Query(default=None, alias="status"),
    keyword: str | None = Query(default=None, max_length=200),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    items, total = await order_service.list_by_user(
        session,
        user,
        status_filter=status_,
        keyword=keyword,
        page=page,
        size=size,
    )
    return envelope(
        data={
            "items": [i.model_dump(mode="json") for i in items],
            "total": total,
            "page": page,
            "size": size,
        }
    )


@router.get("/{order_id}", summary="Order detail")
async def get_order(
    order_id: int,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_ORDER_READ_OWN)),
) -> dict[str, Any]:
    detail = await order_service.get_detail(session, order_id, "user", user.id)
    return envelope(data=detail.model_dump(mode="json"))


@router.post("/{order_id}/cancel", summary="Cancel a pending_payment order")
async def cancel_order(
    order_id: int,
    payload: OrderCancelIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_ORDER_CANCEL_OWN)),
) -> dict[str, Any]:
    detail = await order_service.cancel_by_user(
        session,
        user,
        order_id,
        payload.cancel_note,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=detail.model_dump(mode="json"))


@router.post("/{order_id}/confirm-receipt", summary="Confirm delivery (shipped → completed)")
async def confirm_receipt(
    order_id: int,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_ORDER_CONFIRM_RECEIPT)),
) -> dict[str, Any]:
    detail = await order_service.confirm_receipt(
        session,
        user,
        order_id,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=detail.model_dump(mode="json"))


@router.get("/{order_id}/shipment", summary="Get shipment tracking")
async def get_shipment(
    order_id: int,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_ORDER_READ_OWN)),
) -> dict[str, Any]:
    result = await order_service.get_shipment_for_user(session, user, order_id)
    return envelope(data=result)
