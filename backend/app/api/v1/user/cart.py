"""User cart endpoints — contract §7."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_client_ip, get_user_agent, require_user_permission
from app.core.database import get_db
from app.core.errors import envelope
from app.core.rbac import Permission
from app.models.user import User
from app.schemas.cart import (
    CartAddIn,
    CartBatchDeleteIn,
    CartSelectAllIn,
    CartUpdateIn,
)
from app.services import cart_service

router = APIRouter()


@router.get("", summary="Get cart grouped by shop")
async def get_cart(
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_CART_MANAGE)),
) -> dict[str, Any]:
    body = await cart_service.get_cart_grouped(session, user)
    return envelope(data=body.model_dump(mode="json"))


@router.post("/items", status_code=status.HTTP_201_CREATED, summary="Add item to cart")
async def add_item(
    payload: CartAddIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_CART_MANAGE)),
) -> dict[str, Any]:
    row = await cart_service.add(
        session,
        user,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=row.model_dump(mode="json"))


@router.patch("/items/{item_id}", summary="Update cart item (quantity/selected)")
async def update_item(
    item_id: int,
    payload: CartUpdateIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_CART_MANAGE)),
) -> dict[str, Any]:
    row = await cart_service.update_item(
        session,
        user,
        item_id,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=row.model_dump(mode="json"))


@router.delete("/items/{item_id}", summary="Delete cart item")
async def delete_item(
    item_id: int,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_CART_MANAGE)),
) -> dict[str, Any]:
    await cart_service.delete_(
        session,
        user,
        item_id,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data={"deleted": True})


@router.post("/items/batch-delete", summary="Bulk-delete cart items")
async def batch_delete_items(
    payload: CartBatchDeleteIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_CART_MANAGE)),
) -> dict[str, Any]:
    removed = await cart_service.batch_delete(
        session,
        user,
        payload.ids,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data={"removed": removed})


@router.post("/select-all", summary="Select or unselect every cart item")
async def select_all_items(
    payload: CartSelectAllIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_CART_MANAGE)),
) -> dict[str, Any]:
    changed = await cart_service.select_all(
        session,
        user,
        payload.selected,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data={"changed": changed})


@router.delete("/invalid", summary="Remove all invalid items from the cart")
async def clear_invalid_items(
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_CART_MANAGE)),
) -> dict[str, Any]:
    removed = await cart_service.clear_invalid(
        session,
        user,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data={"removed": removed})
