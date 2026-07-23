"""Admin-side brand management endpoints — contract §6.2."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin_permission
from app.core.database import get_db
from app.core.errors import envelope
from app.core.rbac import Permission
from app.models.admin_user import AdminUser
from app.schemas.catalog import BrandCreateIn, BrandUpdateIn
from app.services import brand_service

router = APIRouter()


@router.get("", summary="List brands")
async def list_brands(
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_admin_permission(Permission.ADMIN_BRAND_MANAGE)),
    keyword: str | None = Query(default=None, max_length=120),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    items, total = await brand_service.list_(
        session, keyword=keyword, only_visible=False, page=page, size=size
    )
    return envelope(
        data={
            "items": [i.model_dump(mode="json") for i in items],
            "total": total,
            "page": page,
            "size": size,
        }
    )


@router.get("/{brand_id}", summary="Get a brand")
async def get_brand(
    brand_id: int,
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_admin_permission(Permission.ADMIN_BRAND_MANAGE)),
) -> dict[str, Any]:
    row = await brand_service.get(session, brand_id)
    return envelope(data=row.model_dump(mode="json"))


@router.post("", status_code=status.HTTP_201_CREATED, summary="Create a brand")
async def create_brand(
    payload: BrandCreateIn,
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_admin_permission(Permission.ADMIN_BRAND_MANAGE)),
) -> dict[str, Any]:
    row = await brand_service.create(session, payload)
    return envelope(data=row.model_dump(mode="json"))


@router.patch("/{brand_id}", summary="Update a brand")
async def update_brand(
    brand_id: int,
    payload: BrandUpdateIn,
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_admin_permission(Permission.ADMIN_BRAND_MANAGE)),
) -> dict[str, Any]:
    row = await brand_service.update(session, brand_id, payload)
    return envelope(data=row.model_dump(mode="json"))


@router.delete("/{brand_id}", summary="Soft-delete a brand")
async def delete_brand(
    brand_id: int,
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_admin_permission(Permission.ADMIN_BRAND_MANAGE)),
) -> dict[str, Any]:
    await brand_service.soft_delete(session, brand_id)
    return envelope(data={"deleted": True})
