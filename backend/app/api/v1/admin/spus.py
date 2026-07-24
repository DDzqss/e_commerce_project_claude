"""Admin-side SPU review endpoints — contract §7."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_client_ip, get_user_agent, require_admin_permission
from app.core.database import get_db
from app.core.errors import envelope
from app.core.rbac import Permission
from app.models.admin_user import AdminUser
from app.models.product import SPUStatus
from app.schemas.product import SPUReviewIn
from app.services import product_service

router = APIRouter()


@router.get("", summary="List SPUs across all shops")
async def list_spus(
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_admin_permission(Permission.ADMIN_SPU_READ_ALL)),
    status_: SPUStatus | None = Query(default=None, alias="status"),
    shop_id: int | None = Query(default=None, ge=1),
    keyword: str | None = Query(default=None, max_length=200),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    items, total = await product_service.admin_list(
        session,
        status_=status_,
        shop_id=shop_id,
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


@router.get("/{spu_id}", summary="Get one SPU with SKUs")
async def get_spu(
    spu_id: int,
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_admin_permission(Permission.ADMIN_SPU_READ_ALL)),
) -> dict[str, Any]:
    row = await product_service.admin_get(session, spu_id)
    return envelope(data=row.model_dump(mode="json"))


@router.post("/{spu_id}/approve", summary="Approve a pending SPU")
async def approve_spu(
    spu_id: int,
    payload: SPUReviewIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(require_admin_permission(Permission.ADMIN_SPU_REVIEW)),
) -> dict[str, Any]:
    row = await product_service.admin_approve(
        session,
        admin,
        spu_id,
        review_note=payload.review_note,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=row.model_dump(mode="json"))


@router.post("/{spu_id}/reject", summary="Reject a pending SPU")
async def reject_spu(
    spu_id: int,
    payload: SPUReviewIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(require_admin_permission(Permission.ADMIN_SPU_REVIEW)),
) -> dict[str, Any]:
    row = await product_service.admin_reject(
        session,
        admin,
        spu_id,
        review_note=payload.review_note or "",
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=row.model_dump(mode="json"))


@router.post("/{spu_id}/force-offshelf", summary="Force off-shelf an approved SPU")
async def force_offshelf_spu(
    spu_id: int,
    payload: SPUReviewIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(require_admin_permission(Permission.ADMIN_SPU_FORCE_OFFSHELF)),
) -> dict[str, Any]:
    row = await product_service.admin_force_offshelf(
        session,
        admin,
        spu_id,
        review_note=payload.review_note or "",
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=row.model_dump(mode="json"))
