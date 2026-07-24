"""Admin-side merchant-application review endpoints (contract §9)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_client_ip,
    get_user_agent,
    require_admin_permission,
)
from app.core.database import get_db
from app.core.errors import envelope
from app.core.rbac import Permission
from app.models.admin_user import AdminUser
from app.models.merchant_application import MerchantApplicationStatus
from app.schemas.merchant_application import MerchantApplicationReviewIn
from app.services import merchant_application_service as app_service

router = APIRouter()


@router.get("", summary="List merchant applications (admin)")
async def list_applications(
    session: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(
        require_admin_permission(Permission.ADMIN_MERCHANT_APPLICATION_READ)
    ),
    status_: MerchantApplicationStatus | None = Query(default=None, alias="status"),
    keyword: str | None = Query(default=None, max_length=120),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    items, total = await app_service.admin_list(
        session,
        status_=status_,
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


@router.get("/{application_id}", summary="Get one merchant application (admin)")
async def get_application(
    application_id: int,
    session: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(
        require_admin_permission(Permission.ADMIN_MERCHANT_APPLICATION_READ)
    ),
) -> dict[str, Any]:
    result = await app_service.admin_get(session, application_id)
    return envelope(data=result.model_dump(mode="json"))


@router.post(
    "/{application_id}/approve",
    summary="Approve a pending merchant application",
)
async def approve_application(
    application_id: int,
    payload: MerchantApplicationReviewIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(
        require_admin_permission(Permission.ADMIN_MERCHANT_APPLICATION_REVIEW)
    ),
) -> dict[str, Any]:
    application, account = await app_service.admin_approve(
        session,
        admin,
        application_id,
        review_note=payload.review_note,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(
        data={
            "application": application.model_dump(mode="json"),
            "merchant_account": account.model_dump(mode="json"),
        }
    )


@router.post(
    "/{application_id}/reject",
    summary="Reject a pending merchant application",
)
async def reject_application(
    application_id: int,
    payload: MerchantApplicationReviewIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(
        require_admin_permission(Permission.ADMIN_MERCHANT_APPLICATION_REVIEW)
    ),
) -> dict[str, Any]:
    result = await app_service.admin_reject(
        session,
        admin,
        application_id,
        review_note=payload.review_note or "",
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=result.model_dump(mode="json"))
