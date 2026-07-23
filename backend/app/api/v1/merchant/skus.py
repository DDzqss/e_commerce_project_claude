"""Merchant-side SKU management endpoints — contract §8.2.

Mounted under ``/merchant/spus/{spu_id}/skus`` — the SPU is the parent
resource so we always check its shop ownership first.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_client_ip, get_user_agent, require_merchant_permission
from app.core.database import get_db
from app.core.errors import envelope
from app.core.rbac import Permission
from app.models.merchant import MerchantAccount
from app.schemas.sku import SKUCreateIn, SKUUpdateIn
from app.services import sku_service

router = APIRouter()


@router.get("/{spu_id}/skus", summary="List SKUs of a SPU")
async def list_skus(
    spu_id: int,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(require_merchant_permission(Permission.MERCHANT_SKU_MANAGE)),
) -> dict[str, Any]:
    items = await sku_service.list_by_spu(session, account, spu_id)
    return envelope(data={"items": [i.model_dump(mode="json") for i in items]})


@router.post(
    "/{spu_id}/skus",
    status_code=status.HTTP_201_CREATED,
    summary="Create a SKU",
)
async def create_sku(
    spu_id: int,
    payload: SKUCreateIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(require_merchant_permission(Permission.MERCHANT_SKU_MANAGE)),
) -> dict[str, Any]:
    row = await sku_service.create(
        session,
        account,
        spu_id,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=row.model_dump(mode="json"))


@router.patch("/{spu_id}/skus/{sku_id}", summary="Update a SKU (price/image/is_active)")
async def update_sku(
    spu_id: int,
    sku_id: int,
    payload: SKUUpdateIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(require_merchant_permission(Permission.MERCHANT_SKU_MANAGE)),
) -> dict[str, Any]:
    row = await sku_service.update(
        session,
        account,
        spu_id,
        sku_id,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=row.model_dump(mode="json"))


@router.delete("/{spu_id}/skus/{sku_id}", summary="Soft-delete a SKU")
async def delete_sku(
    spu_id: int,
    sku_id: int,
    request: Request,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(require_merchant_permission(Permission.MERCHANT_SKU_MANAGE)),
) -> dict[str, Any]:
    await sku_service.delete_(
        session,
        account,
        spu_id,
        sku_id,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data={"deleted": True})
