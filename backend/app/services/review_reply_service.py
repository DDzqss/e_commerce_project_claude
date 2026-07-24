"""Review reply service — Phase 5 contract §5.2.

One merchant reply per review. Reply create/edit/delete emits an audit
row and (for create) a notification to the review author.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppException, ErrorCode
from app.models.audit_log import AuditActorType
from app.models.merchant import MerchantAccount
from app.models.notification import NotificationCategory
from app.models.review import Review
from app.models.review_reply import ReviewReply
from app.schemas.review import ReviewReplyIn, ReviewReplyOut
from app.services import notification_service
from app.services.audit_service import write_audit


async def _load_review(session: AsyncSession, review_id: int) -> Review:
    row = await session.get(Review, review_id)
    if row is None or row.deleted_at is not None:
        raise AppException(ErrorCode.REVIEW_NOT_FOUND, "review not found")
    return row


async def _load_reply_for_shop(
    session: AsyncSession,
    account: MerchantAccount,
    review_id: int,
) -> tuple[Review, ReviewReply]:
    review = await _load_review(session, review_id)
    if review.shop_id != account.shop_id:
        raise AppException(
            ErrorCode.REVIEW_REPLY_PERMISSION_DENIED,
            "review belongs to another shop",
        )
    reply = (
        await session.execute(select(ReviewReply).where(ReviewReply.review_id == review_id))
    ).scalar_one_or_none()
    if reply is None:
        raise AppException(ErrorCode.REVIEW_REPLY_NOT_FOUND, "reply not found")
    return review, reply


async def create(
    session: AsyncSession,
    account: MerchantAccount,
    review_id: int,
    payload: ReviewReplyIn,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> ReviewReplyOut:
    review = await _load_review(session, review_id)
    if review.shop_id != account.shop_id:
        raise AppException(
            ErrorCode.REVIEW_REPLY_PERMISSION_DENIED,
            "review belongs to another shop",
        )
    exists = (
        await session.execute(select(ReviewReply).where(ReviewReply.review_id == review_id))
    ).scalar_one_or_none()
    if exists is not None:
        raise AppException(
            ErrorCode.REVIEW_REPLY_ALREADY_EXISTS,
            "review already has a reply",
        )
    row = ReviewReply(
        review_id=review.id,
        merchant_account_id=account.id,
        shop_id=account.shop_id,
        content=payload.content,
    )
    session.add(row)
    await session.flush()
    await session.refresh(row)

    await write_audit(
        session,
        actor_type=AuditActorType.MERCHANT,
        actor_id=account.id,
        action="merchant.review_reply.create",
        target_type="review_reply",
        target_id=row.id,
        ip=ip,
        user_agent=user_agent,
        extra={"review_id": review.id},
    )
    # Notify the reviewing user that the shop has replied.
    await notification_service.notify_user(
        session,
        review.user_id,
        NotificationCategory.REVIEW,
        title="商家回复了您的评价",
        body=(payload.content[:80] + "…") if len(payload.content) > 80 else payload.content,
        action_url=f"/user/reviews/{review.id}",
        related_type="review",
        related_id=review.id,
    )
    return ReviewReplyOut.model_validate(row)


async def update(
    session: AsyncSession,
    account: MerchantAccount,
    review_id: int,
    payload: ReviewReplyIn,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> ReviewReplyOut:
    _, reply = await _load_reply_for_shop(session, account, review_id)
    reply.content = payload.content
    await session.flush()
    await session.refresh(reply)
    await write_audit(
        session,
        actor_type=AuditActorType.MERCHANT,
        actor_id=account.id,
        action="merchant.review_reply.update",
        target_type="review_reply",
        target_id=reply.id,
        ip=ip,
        user_agent=user_agent,
    )
    return ReviewReplyOut.model_validate(reply)


async def delete(
    session: AsyncSession,
    account: MerchantAccount,
    review_id: int,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> None:
    _, reply = await _load_reply_for_shop(session, account, review_id)
    reply_id = reply.id
    await session.delete(reply)
    await session.flush()
    await write_audit(
        session,
        actor_type=AuditActorType.MERCHANT,
        actor_id=account.id,
        action="merchant.review_reply.delete",
        target_type="review_reply",
        target_id=reply_id,
        ip=ip,
        user_agent=user_agent,
    )


__all__ = ["create", "delete", "update"]
