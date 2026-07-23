"""Merchant order endpoints — contract §10."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_client_ip, get_user_agent, require_merchant_permission
from app.core.database import get_db
from app.core.errors import envelope
from app.core.rbac import Permission
from app.models.merchant import MerchantAccount
from app.schemas.order import OrderCancelIn, OrderNoteIn
from app.schemas.shipment import ShipIn
from app.services import order_service

router = APIRouter()


@router.get("", summary="List orders for the merchant's shop")
async def list_orders(
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(
        require_merchant_permission(Permission.MERCHANT_ORDER_READ_SHOP)
    ),
    status_: str | None = Query(default=None, alias="status"),
    keyword: str | None = Query(default=None, max_length=200),
    start_date: datetime | None = Query(default=None),
    end_date: datetime | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    items, total = await order_service.list_by_merchant(
        session,
        account,
        status_filter=status_,
        keyword=keyword,
        start_date=start_date,
        end_date=end_date,
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


@router.get("/stats/summary", summary="Merchant shop-summary dashboard")
async def stats_summary(
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(
        require_merchant_permission(Permission.MERCHANT_ORDER_READ_SHOP)
    ),
) -> dict[str, Any]:
    result = await order_service.merchant_summary(session, account)
    return envelope(data=result.model_dump(mode="json"))


@router.get("/{order_id}", summary="Order detail (merchant view)")
async def get_order(
    order_id: int,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(
        require_merchant_permission(Permission.MERCHANT_ORDER_READ_SHOP)
    ),
) -> dict[str, Any]:
    detail = await order_service.get_detail(
        session, order_id, "merchant", account.shop_id
    )
    return envelope(data=detail.model_dump(mode="json"))


@router.post("/{order_id}/ship", summary="Mark order as shipped")
async def ship_order(
    order_id: int,
    payload: ShipIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(
        require_merchant_permission(Permission.MERCHANT_ORDER_SHIP)
    ),
) -> dict[str, Any]:
    detail = await order_service.ship_by_merchant(
        session,
        account,
        order_id,
        payload.carrier,
        payload.tracking_no,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=detail.model_dump(mode="json"))


@router.post("/{order_id}/cancel", summary="Cancel a paid order (out of stock / merchant issue)")
async def cancel_order(
    order_id: int,
    payload: OrderCancelIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(
        require_merchant_permission(Permission.MERCHANT_ORDER_CANCEL_SHOP)
    ),
) -> dict[str, Any]:
    if not payload.cancel_note:
        # 契约 §10.3 要求商家取消必须填理由
        from app.core.errors import AppException, ErrorCode

        raise AppException(ErrorCode.VALIDATION_ERROR, "cancel_note is required for merchant cancel")
    detail = await order_service.cancel_by_merchant(
        session,
        account,
        order_id,
        payload.cancel_note,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=detail.model_dump(mode="json"))


@router.post("/{order_id}/note", summary="Add / update merchant note on an order")
async def add_note(
    order_id: int,
    payload: OrderNoteIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(
        require_merchant_permission(Permission.MERCHANT_ORDER_ADD_NOTE)
    ),
) -> dict[str, Any]:
    detail = await order_service.add_note_merchant(
        session,
        account,
        order_id,
        payload.note,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=detail.model_dump(mode="json"))
