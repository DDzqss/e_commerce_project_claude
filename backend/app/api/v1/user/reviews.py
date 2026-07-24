"""User review endpoints — Phase 5 contract §4."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_client_ip, get_user_agent, require_user_permission
from app.core.database import get_db
from app.core.errors import envelope
from app.core.rbac import Permission
from app.models.user import User
from app.schemas.review import ReviewCreateBatchIn, ReviewUpdateIn
from app.services import review_service

router = APIRouter()


@router.post(
    "/orders/{order_id}/reviews",
    status_code=status.HTTP_201_CREATED,
    summary="Batch-create reviews for a completed order",
)
async def create_reviews(
    order_id: int,
    payload: ReviewCreateBatchIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_REVIEW_CREATE)),
) -> dict[str, Any]:
    items = await review_service.user_create_batch(
        session,
        user,
        order_id,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data={"items": [i.model_dump(mode="json") for i in items]})


@router.patch("/reviews/{review_id}", summary="Edit own review (once within window)")
async def edit_review(
    review_id: int,
    payload: ReviewUpdateIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_REVIEW_EDIT_OWN)),
) -> dict[str, Any]:
    row = await review_service.user_edit(
        session,
        user,
        review_id,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=row.model_dump(mode="json"))


@router.delete("/reviews/{review_id}", summary="Soft-delete own review")
async def delete_review(
    review_id: int,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_REVIEW_DELETE_OWN)),
) -> dict[str, Any]:
    await review_service.user_delete_soft(
        session,
        user,
        review_id,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data={"deleted": True})


@router.get("/reviews", summary="List my reviews")
async def list_my_reviews(
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_REVIEW_CREATE)),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=60),
) -> dict[str, Any]:
    out = await review_service.list_by_user(session, user, page=page, size=size)
    return envelope(data=out.model_dump(mode="json"))
