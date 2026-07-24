"""User aftersales endpoints — Phase 4 §7."""

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
from app.schemas.aftersales import (
    AftersalesAppealIn,
    AftersalesCancelIn,
    AftersalesCreateIn,
    AftersalesEvidenceIn,
    AftersalesSubmitTrackingIn,
)
from app.services import aftersales_service

router = APIRouter()


@router.post(
    "/orders/{order_id}/aftersales",
    status_code=status.HTTP_201_CREATED,
    summary="Create an aftersales case for an order",
)
async def create_aftersales(
    order_id: int,
    payload: AftersalesCreateIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_AFTERSALES_CREATE)),
    _: str = Depends(require_idempotency_key),
) -> dict[str, Any]:
    detail = await aftersales_service.user_create(
        session,
        user,
        order_id,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=detail.model_dump(mode="json"))


@router.get("/aftersales", summary="List my aftersales cases")
async def list_aftersales(
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_AFTERSALES_READ_OWN)),
    status_: str | None = Query(default=None, alias="status"),
    type_: str | None = Query(default=None, alias="type"),
    keyword: str | None = Query(default=None, max_length=200),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    items, total = await aftersales_service.user_list(
        session,
        user,
        status_filter=status_,
        type_filter=type_,
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


@router.get("/aftersales/{aftersales_id}", summary="Aftersales detail")
async def get_aftersales(
    aftersales_id: int,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_AFTERSALES_READ_OWN)),
) -> dict[str, Any]:
    detail = await aftersales_service.user_get_detail(session, user, aftersales_id)
    return envelope(data=detail.model_dump(mode="json"))


@router.post("/aftersales/{aftersales_id}/cancel", summary="Cancel an aftersales case")
async def cancel_aftersales(
    aftersales_id: int,
    payload: AftersalesCancelIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_AFTERSALES_CANCEL_OWN)),
) -> dict[str, Any]:
    detail = await aftersales_service.user_cancel(
        session,
        user,
        aftersales_id,
        payload.cancel_note,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=detail.model_dump(mode="json"))


@router.post(
    "/aftersales/{aftersales_id}/submit-tracking",
    summary="Submit return-shipment tracking",
)
async def submit_tracking(
    aftersales_id: int,
    payload: AftersalesSubmitTrackingIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_AFTERSALES_SUBMIT_TRACKING)),
) -> dict[str, Any]:
    detail = await aftersales_service.user_submit_tracking(
        session,
        user,
        aftersales_id,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=detail.model_dump(mode="json"))


@router.post(
    "/aftersales/{aftersales_id}/confirm-exchange",
    summary="Confirm exchange completion",
)
async def confirm_exchange(
    aftersales_id: int,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_AFTERSALES_CONFIRM_EXCHANGE)),
) -> dict[str, Any]:
    detail = await aftersales_service.user_confirm_exchange(
        session,
        user,
        aftersales_id,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=detail.model_dump(mode="json"))


@router.post("/aftersales/{aftersales_id}/nudge", summary="Nudge the merchant")
async def nudge_aftersales(
    aftersales_id: int,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_AFTERSALES_NUDGE)),
) -> dict[str, Any]:
    result = await aftersales_service.user_nudge(
        session,
        user,
        aftersales_id,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=result.model_dump(mode="json"))


@router.post("/aftersales/{aftersales_id}/appeal", summary="Appeal after rejection")
async def appeal_aftersales(
    aftersales_id: int,
    payload: AftersalesAppealIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_AFTERSALES_APPEAL)),
) -> dict[str, Any]:
    detail = await aftersales_service.user_appeal(
        session,
        user,
        aftersales_id,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=detail.model_dump(mode="json"))


@router.post("/aftersales/{aftersales_id}/evidences", summary="Add an evidence image")
async def add_evidence(
    aftersales_id: int,
    payload: AftersalesEvidenceIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_AFTERSALES_READ_OWN)),
) -> dict[str, Any]:
    detail = await aftersales_service.user_add_evidence(
        session,
        user,
        aftersales_id,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=detail.model_dump(mode="json"))
