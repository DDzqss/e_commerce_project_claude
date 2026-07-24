"""Merchant review endpoints — Phase 5 contract §5.2 / §5.3."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_client_ip, get_user_agent, require_merchant_permission
from app.core.database import get_db
from app.core.errors import envelope
from app.core.rbac import Permission
from app.models.merchant import MerchantAccount
from app.schemas.review import ReviewReplyIn
from app.services import review_reply_service, review_service

router = APIRouter()


@router.get("", summary="List reviews of my shop")
async def list_shop_reviews(
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(
        require_merchant_permission(Permission.MERCHANT_REVIEW_READ_SHOP)
    ),
    rating: int | None = Query(default=None, ge=1, le=5),
    has_reply: bool | None = Query(default=None),
    keyword: str | None = Query(default=None, max_length=200),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    out = await review_service.merchant_list_shop(
        session,
        account,
        rating=rating,
        has_reply=has_reply,
        keyword=keyword,
        page=page,
        size=size,
    )
    return envelope(data=out.model_dump(mode="json"))


@router.post(
    "/{review_id}/reply",
    status_code=status.HTTP_201_CREATED,
    summary="Reply to a review",
)
async def create_reply(
    review_id: int,
    payload: ReviewReplyIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(
        require_merchant_permission(Permission.MERCHANT_REVIEW_REPLY)
    ),
) -> dict[str, Any]:
    row = await review_reply_service.create(
        session,
        account,
        review_id,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=row.model_dump(mode="json"))


@router.patch("/{review_id}/reply", summary="Update reply")
async def update_reply(
    review_id: int,
    payload: ReviewReplyIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(
        require_merchant_permission(Permission.MERCHANT_REVIEW_REPLY)
    ),
) -> dict[str, Any]:
    row = await review_reply_service.update(
        session,
        account,
        review_id,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=row.model_dump(mode="json"))


@router.delete("/{review_id}/reply", summary="Delete reply")
async def delete_reply(
    review_id: int,
    request: Request,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(
        require_merchant_permission(Permission.MERCHANT_REVIEW_REPLY)
    ),
) -> dict[str, Any]:
    await review_reply_service.delete(
        session,
        account,
        review_id,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data={"deleted": True})
