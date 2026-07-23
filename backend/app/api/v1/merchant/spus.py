"""Merchant-side SPU management endpoints — contract §8.1."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_client_ip, get_user_agent, require_merchant_permission
from app.core.database import get_db
from app.core.errors import envelope
from app.core.rbac import Permission
from app.models.merchant import MerchantAccount
from app.models.product import SPUStatus
from app.schemas.product import SPUCreateIn, SPUUpdateIn
from app.services import product_service

router = APIRouter()


@router.get("", summary="List this shop's SPUs")
async def list_spus(
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(require_merchant_permission(Permission.MERCHANT_SPU_MANAGE)),
    status_: SPUStatus | None = Query(default=None, alias="status"),
    keyword: str | None = Query(default=None, max_length=200),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    items, total = await product_service.merchant_list(
        session, account, status_=status_, keyword=keyword, page=page, size=size
    )
    return envelope(
        data={
            "items": [i.model_dump(mode="json") for i in items],
            "total": total,
            "page": page,
            "size": size,
        }
    )


@router.get("/{spu_id}", summary="Get a SPU with SKUs (merchant view)")
async def get_spu(
    spu_id: int,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(require_merchant_permission(Permission.MERCHANT_SPU_MANAGE)),
) -> dict[str, Any]:
    row = await product_service.merchant_get(session, account, spu_id)
    return envelope(data=row.model_dump(mode="json"))


@router.post("", status_code=status.HTTP_201_CREATED, summary="Create a draft SPU")
async def create_spu(
    payload: SPUCreateIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(require_merchant_permission(Permission.MERCHANT_SPU_MANAGE)),
) -> dict[str, Any]:
    row = await product_service.merchant_create(
        session,
        account,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=row.model_dump(mode="json"))


@router.patch("/{spu_id}", summary="Update a SPU (may trigger re-review)")
async def update_spu(
    spu_id: int,
    payload: SPUUpdateIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(require_merchant_permission(Permission.MERCHANT_SPU_MANAGE)),
) -> dict[str, Any]:
    row = await product_service.merchant_update(
        session,
        account,
        spu_id,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=row.model_dump(mode="json"))


@router.delete("/{spu_id}", summary="Soft-delete a SPU")
async def delete_spu(
    spu_id: int,
    request: Request,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(require_merchant_permission(Permission.MERCHANT_SPU_MANAGE)),
) -> dict[str, Any]:
    await product_service.merchant_delete(
        session,
        account,
        spu_id,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data={"deleted": True})


@router.post("/{spu_id}/submit-review", summary="Submit a draft SPU for review")
async def submit_review(
    spu_id: int,
    request: Request,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(require_merchant_permission(Permission.MERCHANT_SPU_MANAGE)),
) -> dict[str, Any]:
    row = await product_service.submit_review(
        session,
        account,
        spu_id,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=row.model_dump(mode="json"))


@router.post("/{spu_id}/withdraw-review", summary="Withdraw a pending SPU back to draft")
async def withdraw_review(
    spu_id: int,
    request: Request,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(require_merchant_permission(Permission.MERCHANT_SPU_MANAGE)),
) -> dict[str, Any]:
    row = await product_service.withdraw_review(
        session,
        account,
        spu_id,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=row.model_dump(mode="json"))


@router.post("/{spu_id}/offshelf", summary="Off-shelf an approved SPU")
async def offshelf(
    spu_id: int,
    request: Request,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(require_merchant_permission(Permission.MERCHANT_SPU_MANAGE)),
) -> dict[str, Any]:
    row = await product_service.offshelf(
        session,
        account,
        spu_id,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=row.model_dump(mode="json"))


@router.post("/{spu_id}/onshelf", summary="Put an off-shelf SPU back on shelf")
async def onshelf(
    spu_id: int,
    request: Request,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(require_merchant_permission(Permission.MERCHANT_SPU_MANAGE)),
) -> dict[str, Any]:
    row = await product_service.onshelf(
        session,
        account,
        spu_id,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=row.model_dump(mode="json"))
