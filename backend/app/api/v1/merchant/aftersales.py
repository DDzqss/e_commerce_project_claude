"""Merchant aftersales endpoints — Phase 4 §8."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_client_ip,
    get_user_agent,
    require_merchant_permission,
)
from app.core.database import get_db
from app.core.errors import envelope
from app.core.rbac import Permission
from app.models.merchant import MerchantAccount
from app.schemas.aftersales import (
    AftersalesConfirmReceiveIn,
    AftersalesMerchantApproveIn,
    AftersalesMerchantRejectIn,
    AftersalesNoteIn,
    AftersalesRefuseReceiveIn,
    AftersalesShipExchangeIn,
)
from app.services import aftersales_service

router = APIRouter()


@router.get("", summary="List shop aftersales cases")
async def list_aftersales(
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(
        require_merchant_permission(Permission.MERCHANT_AFTERSALES_READ_SHOP)
    ),
    status_: str | None = Query(default=None, alias="status"),
    type_: str | None = Query(default=None, alias="type"),
    overdue_soon: bool | None = Query(default=None),
    keyword: str | None = Query(default=None, max_length=200),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    items, total = await aftersales_service.merchant_list(
        session,
        account,
        status_filter=status_,
        type_filter=type_,
        overdue_soon=overdue_soon,
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


@router.get("/{aftersales_id}", summary="Aftersales detail (merchant view)")
async def get_aftersales(
    aftersales_id: int,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(
        require_merchant_permission(Permission.MERCHANT_AFTERSALES_READ_SHOP)
    ),
) -> dict[str, Any]:
    detail = await aftersales_service.merchant_get_detail(session, account, aftersales_id)
    return envelope(data=detail.model_dump(mode="json"))


@router.post("/{aftersales_id}/approve", summary="Approve aftersales")
async def approve_aftersales(
    aftersales_id: int,
    payload: AftersalesMerchantApproveIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(
        require_merchant_permission(Permission.MERCHANT_AFTERSALES_REVIEW)
    ),
) -> dict[str, Any]:
    detail = await aftersales_service.merchant_approve(
        session,
        account,
        aftersales_id,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=detail.model_dump(mode="json"))


@router.post("/{aftersales_id}/reject", summary="Reject aftersales")
async def reject_aftersales(
    aftersales_id: int,
    payload: AftersalesMerchantRejectIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(
        require_merchant_permission(Permission.MERCHANT_AFTERSALES_REVIEW)
    ),
) -> dict[str, Any]:
    detail = await aftersales_service.merchant_reject(
        session,
        account,
        aftersales_id,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=detail.model_dump(mode="json"))


@router.post("/{aftersales_id}/confirm-received", summary="Confirm return received")
async def confirm_received(
    aftersales_id: int,
    payload: AftersalesConfirmReceiveIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(
        require_merchant_permission(Permission.MERCHANT_AFTERSALES_CONFIRM_RECEIVE)
    ),
) -> dict[str, Any]:
    detail = await aftersales_service.merchant_confirm_received(
        session,
        account,
        aftersales_id,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=detail.model_dump(mode="json"))


@router.post("/{aftersales_id}/refuse-receive", summary="Refuse return (auto-escalate)")
async def refuse_receive(
    aftersales_id: int,
    payload: AftersalesRefuseReceiveIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(
        require_merchant_permission(Permission.MERCHANT_AFTERSALES_CONFIRM_RECEIVE)
    ),
) -> dict[str, Any]:
    detail = await aftersales_service.merchant_refuse_receive(
        session,
        account,
        aftersales_id,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=detail.model_dump(mode="json"))


@router.post("/{aftersales_id}/ship-exchange", summary="Ship the exchange package")
async def ship_exchange(
    aftersales_id: int,
    payload: AftersalesShipExchangeIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(
        require_merchant_permission(Permission.MERCHANT_AFTERSALES_SHIP_EXCHANGE)
    ),
) -> dict[str, Any]:
    detail = await aftersales_service.merchant_ship_exchange(
        session,
        account,
        aftersales_id,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=detail.model_dump(mode="json"))


@router.post("/{aftersales_id}/note", summary="Merchant note (overwrite)")
async def note_aftersales(
    aftersales_id: int,
    payload: AftersalesNoteIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(
        require_merchant_permission(Permission.MERCHANT_AFTERSALES_ADD_NOTE)
    ),
) -> dict[str, Any]:
    detail = await aftersales_service.merchant_note(
        session,
        account,
        aftersales_id,
        payload.note,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=detail.model_dump(mode="json"))
