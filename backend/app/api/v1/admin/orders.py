"""Admin order endpoints — contract §11."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_client_ip, get_user_agent, require_admin_permission
from app.core.database import get_db
from app.core.errors import AppException, ErrorCode, envelope
from app.core.rbac import Permission
from app.models.admin_user import AdminUser
from app.schemas.order import OrderCancelIn, OrderNoteIn
from app.schemas.shipment import LogisticsSimulateIn
from app.services import order_service

router = APIRouter()


@router.get("", summary="List orders across all shops")
async def list_orders(
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_admin_permission(Permission.ADMIN_ORDER_READ_ALL)),
    status_: str | None = Query(default=None, alias="status"),
    shop_id: int | None = Query(default=None, ge=1),
    user_id: int | None = Query(default=None, ge=1),
    keyword: str | None = Query(default=None, max_length=200),
    start_date: datetime | None = Query(default=None),
    end_date: datetime | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    items, total = await order_service.list_by_admin(
        session,
        status_filter=status_,
        shop_id=shop_id,
        user_id=user_id,
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


@router.get("/stats/overview", summary="Platform-wide order overview")
async def stats_overview(
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_admin_permission(Permission.ADMIN_ORDER_READ_ALL)),
) -> dict[str, Any]:
    result = await order_service.admin_overview(session)
    return envelope(data=result.model_dump(mode="json"))


@router.get("/{order_id}", summary="Order detail (admin view)")
async def get_order(
    order_id: int,
    session: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(require_admin_permission(Permission.ADMIN_ORDER_READ_ALL)),
) -> dict[str, Any]:
    detail = await order_service.get_detail(session, order_id, "admin", admin.id)
    return envelope(data=detail.model_dump(mode="json"))


@router.post("/{order_id}/cancel", summary="Admin intervene: force-cancel an order")
async def cancel_order(
    order_id: int,
    payload: OrderCancelIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(require_admin_permission(Permission.ADMIN_ORDER_INTERVENE)),
) -> dict[str, Any]:
    if not payload.cancel_note:
        raise AppException(ErrorCode.VALIDATION_ERROR, "cancel_note is required")
    detail = await order_service.cancel_by_admin(
        session,
        admin,
        order_id,
        payload.cancel_note,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=detail.model_dump(mode="json"))


@router.post("/{order_id}/note", summary="Add / update admin internal note")
async def add_note(
    order_id: int,
    payload: OrderNoteIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(require_admin_permission(Permission.ADMIN_ORDER_ADD_NOTE)),
) -> dict[str, Any]:
    detail = await order_service.add_note_admin(
        session,
        admin,
        order_id,
        payload.note,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=detail.model_dump(mode="json"))


@router.post("/{order_id}/logistics/simulate", summary="Append a simulated logistics event")
async def simulate_logistics(
    order_id: int,
    payload: LogisticsSimulateIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(require_admin_permission(Permission.ADMIN_ORDER_INTERVENE)),
) -> dict[str, Any]:
    detail = await order_service.simulate_logistics(
        session,
        admin,
        order_id,
        payload.event_type,
        payload.description,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=detail.model_dump(mode="json"))
