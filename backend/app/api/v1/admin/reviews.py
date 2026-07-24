"""Admin review moderation endpoints — Phase 5 contract §5.4."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_client_ip, get_user_agent, require_admin_permission
from app.core.database import get_db
from app.core.errors import envelope
from app.core.rbac import Permission
from app.models.admin_user import AdminUser
from app.schemas.review import AdminReviewHideIn
from app.services import review_service

router = APIRouter()


@router.get("", summary="List all reviews (admin)")
async def list_reviews(
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_admin_permission(Permission.ADMIN_REVIEW_MODERATE)),
    visible: bool | None = Query(default=None),
    shop_id: int | None = Query(default=None, ge=1),
    spu_id: int | None = Query(default=None, ge=1),
    keyword: str | None = Query(default=None, max_length=200),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    out = await review_service.admin_list_all(
        session,
        visible=visible,
        shop_id=shop_id,
        spu_id=spu_id,
        keyword=keyword,
        page=page,
        size=size,
    )
    return envelope(data=out.model_dump(mode="json"))


@router.get("/{review_id}", summary="Get one review (admin)")
async def get_review(
    review_id: int,
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_admin_permission(Permission.ADMIN_REVIEW_MODERATE)),
) -> dict[str, Any]:
    row = await review_service.admin_get_detail(session, review_id)
    return envelope(data=row.model_dump(mode="json"))


@router.post("/{review_id}/hide", summary="Hide a review")
async def hide_review(
    review_id: int,
    payload: AdminReviewHideIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(require_admin_permission(Permission.ADMIN_REVIEW_MODERATE)),
) -> dict[str, Any]:
    row = await review_service.admin_hide(
        session,
        admin,
        review_id,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=row.model_dump(mode="json"))


@router.post("/{review_id}/restore", summary="Restore a hidden review")
async def restore_review(
    review_id: int,
    request: Request,
    session: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(require_admin_permission(Permission.ADMIN_REVIEW_MODERATE)),
) -> dict[str, Any]:
    row = await review_service.admin_restore(
        session,
        admin,
        review_id,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=row.model_dump(mode="json"))
