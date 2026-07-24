"""Admin review-report queue endpoints — Phase 5 contract §5.5."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_client_ip, get_user_agent, require_admin_permission
from app.core.database import get_db
from app.core.errors import envelope
from app.core.rbac import Permission
from app.models.admin_user import AdminUser
from app.schemas.review import AdminReportHandleIn
from app.services import review_report_service

router = APIRouter()


@router.get("", summary="List review reports")
async def list_reports(
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_admin_permission(Permission.ADMIN_REVIEW_REPORT_HANDLE)),
    status: str | None = Query(default="pending", max_length=20),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    items, total = await review_report_service.admin_list(
        session, status=status, page=page, size=size
    )
    return envelope(
        data={
            "items": [i.model_dump(mode="json") for i in items],
            "total": total,
            "page": page,
            "size": size,
        }
    )


@router.post("/{report_id}/uphold", summary="Uphold a review report")
async def uphold_report(
    report_id: int,
    payload: AdminReportHandleIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(require_admin_permission(Permission.ADMIN_REVIEW_REPORT_HANDLE)),
) -> dict[str, Any]:
    row = await review_report_service.admin_uphold(
        session,
        admin,
        report_id,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=row.model_dump(mode="json"))


@router.post("/{report_id}/dismiss", summary="Dismiss a review report")
async def dismiss_report(
    report_id: int,
    payload: AdminReportHandleIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(require_admin_permission(Permission.ADMIN_REVIEW_REPORT_HANDLE)),
) -> dict[str, Any]:
    row = await review_report_service.admin_dismiss(
        session,
        admin,
        report_id,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=row.model_dump(mode="json"))
