"""Merchant self-service endpoints (contract §6.2)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_client_ip,
    get_current_merchant,
    get_user_agent,
    require_merchant_permission,
)
from app.core.database import get_db
from app.core.errors import envelope
from app.core.rbac import Permission
from app.models.merchant import MerchantAccount
from app.schemas.merchant import ShopUpdateIn
from app.services import merchant_service

router = APIRouter()


@router.get("", summary="Get current merchant account + shop")
async def me(
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(get_current_merchant),
) -> dict[str, Any]:
    result = await merchant_service.get_me(session, account)
    return envelope(data=result.model_dump())


@router.patch("/shop", summary="Update current shop (SHOP_OWNER only)")
async def update_shop(
    payload: ShopUpdateIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(
        require_merchant_permission(Permission.MERCHANT_SHOP_UPDATE)
    ),
) -> dict[str, Any]:
    result = await merchant_service.update_shop(
        session,
        account,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=result.model_dump())
