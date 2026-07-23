"""Admin-side category management endpoints — contract §6.1."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin_permission
from app.core.database import get_db
from app.core.errors import envelope
from app.core.rbac import Permission
from app.models.admin_user import AdminUser
from app.schemas.catalog import CategoryCreateIn, CategoryUpdateIn
from app.services import category_service

router = APIRouter()


@router.get("", summary="List all categories (tree)")
async def list_categories(
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_admin_permission(Permission.ADMIN_CATEGORY_MANAGE)),
) -> dict[str, Any]:
    tree = await category_service.list_tree(session)
    return envelope(data={"items": [t.model_dump(mode="json") for t in tree]})


@router.get("/{category_id}", summary="Get a category")
async def get_category(
    category_id: int,
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_admin_permission(Permission.ADMIN_CATEGORY_MANAGE)),
) -> dict[str, Any]:
    row = await category_service.get(session, category_id)
    return envelope(data=row.model_dump(mode="json"))


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Create a category",
)
async def create_category(
    payload: CategoryCreateIn,
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_admin_permission(Permission.ADMIN_CATEGORY_MANAGE)),
) -> dict[str, Any]:
    row = await category_service.create(session, payload)
    return envelope(data=row.model_dump(mode="json"))


@router.patch("/{category_id}", summary="Update a category")
async def update_category(
    category_id: int,
    payload: CategoryUpdateIn,
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_admin_permission(Permission.ADMIN_CATEGORY_MANAGE)),
) -> dict[str, Any]:
    row = await category_service.update(session, category_id, payload)
    return envelope(data=row.model_dump(mode="json"))


@router.delete("/{category_id}", summary="Soft-delete a category")
async def delete_category(
    category_id: int,
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_admin_permission(Permission.ADMIN_CATEGORY_MANAGE)),
) -> dict[str, Any]:
    await category_service.soft_delete(session, category_id)
    return envelope(data={"deleted": True})
