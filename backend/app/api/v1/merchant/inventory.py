"""Merchant-side inventory adjust + log endpoints — contract §10."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_client_ip, get_user_agent, require_merchant_permission
from app.core.database import get_db
from app.core.errors import envelope
from app.core.rbac import Permission
from app.models.merchant import MerchantAccount
from app.schemas.inventory import InventoryAdjustIn
from app.services import inventory_service

router = APIRouter()


@router.post(
    "/skus/{sku_id}/inventory/adjust",
    summary="Adjust a SKU's stock (writes an audit log row)",
)
async def adjust_inventory(
    sku_id: int,
    payload: InventoryAdjustIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(
        require_merchant_permission(Permission.MERCHANT_INVENTORY_ADJUST)
    ),
) -> dict[str, Any]:
    log = await inventory_service.adjust(
        session,
        account,
        sku_id,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=log.model_dump(mode="json"))


@router.get(
    "/skus/{sku_id}/inventory-logs",
    summary="List stock-movement history for a SKU",
)
async def list_inventory_logs(
    sku_id: int,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(
        require_merchant_permission(Permission.MERCHANT_INVENTORY_ADJUST)
    ),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    items, total = await inventory_service.list_logs(session, account, sku_id, page=page, size=size)
    return envelope(
        data={
            "items": [i.model_dump(mode="json") for i in items],
            "total": total,
            "page": page,
            "size": size,
        }
    )
