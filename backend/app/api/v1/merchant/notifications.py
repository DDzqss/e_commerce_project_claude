"""Merchant in-app notification endpoints — Phase 5 contract §6."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_merchant_permission
from app.core.database import get_db
from app.core.errors import envelope
from app.core.rbac import Permission
from app.models.merchant import MerchantAccount
from app.models.notification import NotificationRecipientType
from app.services import notification_service

router = APIRouter()

_RECIPIENT = NotificationRecipientType.MERCHANT


@router.get("", summary="List merchant notifications")
async def list_notifications(
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(
        require_merchant_permission(Permission.MERCHANT_NOTIFICATION_READ_SHOP)
    ),
    is_read: bool | None = Query(default=None),
    category: str | None = Query(default=None, max_length=40),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    items, total, unread = await notification_service.list_(
        session,
        recipient_type=_RECIPIENT,
        recipient_id=account.id,
        is_read=is_read,
        category=category,
        page=page,
        size=size,
    )
    return envelope(
        data={
            "items": [i.model_dump(mode="json") for i in items],
            "total": total,
            "page": page,
            "size": size,
            "unread_total": unread,
        }
    )


@router.get("/unread-count", summary="Unread notification count")
async def unread_count(
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(
        require_merchant_permission(Permission.MERCHANT_NOTIFICATION_READ_SHOP)
    ),
) -> dict[str, Any]:
    n = await notification_service.get_unread_count(
        session, recipient_type=_RECIPIENT, recipient_id=account.id
    )
    return envelope(data={"count": n})


@router.post("/{notification_id}/read", summary="Mark one notification as read")
async def mark_read(
    notification_id: int,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(
        require_merchant_permission(Permission.MERCHANT_NOTIFICATION_READ_SHOP)
    ),
) -> dict[str, Any]:
    row = await notification_service.mark_read(
        session,
        notification_id,
        recipient_type=_RECIPIENT,
        recipient_id=account.id,
    )
    return envelope(data=row.model_dump(mode="json"))


@router.post("/read-all", summary="Mark all my notifications as read")
async def mark_all_read(
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(
        require_merchant_permission(Permission.MERCHANT_NOTIFICATION_READ_SHOP)
    ),
) -> dict[str, Any]:
    n = await notification_service.mark_all_read(
        session, recipient_type=_RECIPIENT, recipient_id=account.id
    )
    return envelope(data={"updated": n})


@router.delete("/read", summary="Delete all read notifications")
async def delete_all_read(
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(
        require_merchant_permission(Permission.MERCHANT_NOTIFICATION_READ_SHOP)
    ),
) -> dict[str, Any]:
    n = await notification_service.delete_all_read(
        session, recipient_type=_RECIPIENT, recipient_id=account.id
    )
    return envelope(data={"deleted": n})


# Keep the parameterised route LAST so the literal "/read" above wins the match.
@router.delete("/{notification_id}", summary="Delete one notification")
async def delete_notification(
    notification_id: int,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(
        require_merchant_permission(Permission.MERCHANT_NOTIFICATION_READ_SHOP)
    ),
) -> dict[str, Any]:
    await notification_service.delete_(
        session, notification_id, recipient_type=_RECIPIENT, recipient_id=account.id
    )
    return envelope(data={"deleted": True})
