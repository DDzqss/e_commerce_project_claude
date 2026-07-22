"""User-side merchant-application endpoints (contract §8.2)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_client_ip, get_current_user, get_user_agent
from app.core.database import get_db
from app.core.errors import envelope
from app.models.user import User
from app.schemas.merchant_application import MerchantApplicationCreateIn
from app.services import merchant_application_service as app_service

router = APIRouter()


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Submit a new merchant application",
)
async def submit_application(
    payload: MerchantApplicationCreateIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    result = await app_service.apply(
        session,
        user,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=result.model_dump(mode="json"))


@router.get("", summary="List current user's merchant applications")
async def list_applications(
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    items, total = await app_service.list_by_user(session, user, page=page, size=size)
    return envelope(
        data={
            "items": [i.model_dump(mode="json") for i in items],
            "total": total,
            "page": page,
            "size": size,
        }
    )


@router.get("/{application_id}", summary="Get one of the user's own applications")
async def get_application(
    application_id: int,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    result = await app_service.get_owned(session, user, application_id)
    return envelope(data=result.model_dump(mode="json"))


@router.post("/{application_id}/withdraw", summary="Withdraw a pending application")
async def withdraw_application(
    application_id: int,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    result = await app_service.withdraw(
        session,
        user,
        application_id,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=result.model_dump(mode="json"))
