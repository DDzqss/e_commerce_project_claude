"""Product review service — Phase 5 contract §4-§5.

Owns review lifecycle:
- user_create_batch: batch-create for a single order
- user_edit / user_delete_soft: only inside the 15-day window and once
- list variants for user / merchant / admin / public catalog
- shop rating aggregate recompute (rating_avg / rating_count)
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppException, ErrorCode
from app.models.admin_user import AdminUser
from app.models.audit_log import AuditActorType
from app.models.merchant import MerchantAccount, Shop
from app.models.notification import NotificationCategory
from app.models.order import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.review import Review
from app.models.review_reply import ReviewReply
from app.models.user import User
from app.schemas.review import (
    AdminReviewHideIn,
    ReviewCreateBatchIn,
    ReviewListOut,
    ReviewOut,
    ReviewRatingSummary,
    ReviewReplyBrief,
    ReviewUpdateIn,
)
from app.services import notification_service
from app.services.audit_service import write_audit


def _now() -> datetime:
    return datetime.now(UTC)


def _as_aware(dt: datetime | None) -> datetime | None:
    """SQLite drops tzinfo; coerce back to UTC when reading."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


def _mask_nickname(name: str | None) -> str:
    """Return an anonymised display name: keep first char, add 匿***名."""
    if not name:
        return "匿***名"
    return f"{name[0]}***匿"


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------
async def _serialize_review(
    session: AsyncSession,
    review: Review,
    *,
    include_reply: bool = True,
    include_user_name: bool = True,
) -> ReviewOut:
    await session.refresh(review)
    reply_brief: ReviewReplyBrief | None = None
    if include_reply:
        stmt = select(ReviewReply).where(ReviewReply.review_id == review.id).limit(1)
        reply = (await session.execute(stmt)).scalar_one_or_none()
        if reply is not None:
            reply_brief = ReviewReplyBrief.model_validate(reply)

    user_display_name: str | None = None
    if include_user_name:
        user = await session.get(User, review.user_id)
        if review.is_anonymous:
            user_display_name = _mask_nickname(user.nickname if user else None)
        elif user is not None:
            user_display_name = user.nickname

    return ReviewOut(
        id=review.id,
        order_id=review.order_id,
        order_item_id=review.order_item_id,
        user_id=review.user_id,
        user_display_name=user_display_name,
        spu_id=review.spu_id,
        sku_id=review.sku_id,
        shop_id=review.shop_id,
        rating=review.rating,
        content=review.content,
        images=list(review.images or []),
        is_anonymous=review.is_anonymous,
        visible=review.visible,
        hidden_reason=review.hidden_reason,
        edit_count=review.edit_count,
        edit_deadline_at=review.edit_deadline_at,
        created_at=review.created_at,
        updated_at=review.updated_at,
        reply=reply_brief,
    )


async def _summarize(session: AsyncSession, where: list[Any]) -> ReviewRatingSummary:
    conds = [*where, Review.visible.is_(True), Review.deleted_at.is_(None)]
    count_stmt = select(func.count(Review.id)).where(and_(*conds))
    avg_stmt = select(func.coalesce(func.avg(Review.rating), 0)).where(and_(*conds))
    count = int((await session.execute(count_stmt)).scalar_one())
    if count == 0:
        return ReviewRatingSummary(avg=0.0, count=0, distribution=dict.fromkeys(range(1, 6), 0))
    avg = float((await session.execute(avg_stmt)).scalar_one())

    dist: dict[int, int] = dict.fromkeys(range(1, 6), 0)
    dist_stmt = (
        select(Review.rating, func.count(Review.id)).where(and_(*conds)).group_by(Review.rating)
    )
    for rating, n in (await session.execute(dist_stmt)).all():
        dist[int(rating)] = int(n)
    return ReviewRatingSummary(avg=round(avg, 2), count=count, distribution=dist)


# ---------------------------------------------------------------------------
# Shop rating aggregation
# ---------------------------------------------------------------------------
async def update_shop_rating(session: AsyncSession, shop_id: int) -> None:
    """Recompute shops.rating_avg / rating_count from visible reviews."""
    stmt = select(func.coalesce(func.avg(Review.rating), 0), func.count(Review.id)).where(
        Review.shop_id == shop_id,
        Review.visible.is_(True),
        Review.deleted_at.is_(None),
    )
    row = (await session.execute(stmt)).one()
    avg_raw = row[0]
    count = int(row[1])
    shop = await session.get(Shop, shop_id)
    if shop is None:
        return
    if count == 0:
        shop.rating_avg = Decimal("5.00")
    else:
        try:
            shop.rating_avg = Decimal(str(round(float(avg_raw), 2)))
        except Exception:
            shop.rating_avg = Decimal("5.00")
    shop.rating_count = count
    await session.flush()


# ---------------------------------------------------------------------------
# Loaders
# ---------------------------------------------------------------------------
async def _load_review(session: AsyncSession, review_id: int) -> Review:
    row = await session.get(Review, review_id)
    if row is None or row.deleted_at is not None:
        raise AppException(ErrorCode.REVIEW_NOT_FOUND, "review not found")
    return row


async def _load_review_for_user(session: AsyncSession, user: User, review_id: int) -> Review:
    row = await _load_review(session, review_id)
    if row.user_id != user.id:
        raise AppException(ErrorCode.REVIEW_PERMISSION_DENIED, "review belongs to another user")
    return row


# ---------------------------------------------------------------------------
# User: create batch
# ---------------------------------------------------------------------------
async def user_create_batch(
    session: AsyncSession,
    user: User,
    order_id: int,
    payload: ReviewCreateBatchIn,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> list[ReviewOut]:
    settings = get_settings()

    order = await session.get(Order, order_id)
    if order is None:
        raise AppException(ErrorCode.ORDER_NOT_FOUND, "order not found")
    if order.user_id != user.id:
        raise AppException(ErrorCode.ORDER_PERMISSION_DENIED, "order belongs to another user")
    if order.status != OrderStatus.COMPLETED:
        raise AppException(
            ErrorCode.REVIEW_ORDER_NOT_REVIEWABLE,
            "order is not completed",
        )

    # Preload order items belonging to this order.
    oi_rows = list(
        (await session.execute(select(OrderItem).where(OrderItem.order_id == order.id)))
        .scalars()
        .all()
    )
    oi_by_id = {oi.id: oi for oi in oi_rows}

    # Preload existing reviews on those items (soft-deleted excluded).
    if oi_rows:
        exists_stmt = select(Review.order_item_id).where(
            Review.order_item_id.in_(oi_by_id.keys()),
            Review.deleted_at.is_(None),
        )
        already = set((await session.execute(exists_stmt)).scalars().all())
    else:
        already = set()

    now = _now()
    deadline = now + timedelta(days=settings.REVIEW_EDIT_WINDOW_DAYS)

    created: list[Review] = []
    for it in payload.reviews:
        oi = oi_by_id.get(it.order_item_id)
        if oi is None:
            raise AppException(
                ErrorCode.REVIEW_ORDER_NOT_REVIEWABLE,
                f"order_item {it.order_item_id} not part of order",
            )
        if it.order_item_id in already:
            raise AppException(
                ErrorCode.REVIEW_ORDER_NOT_REVIEWABLE,
                f"order_item {it.order_item_id} already reviewed",
            )
        if not (1 <= it.rating <= 5):
            raise AppException(ErrorCode.REVIEW_RATING_INVALID, "rating must be 1..5")
        if len(it.content) > settings.MAX_REVIEW_LENGTH:
            raise AppException(ErrorCode.REVIEW_CONTENT_TOO_LONG, "content too long")
        if len(it.images) > settings.MAX_REVIEW_IMAGES:
            raise AppException(
                ErrorCode.REVIEW_IMAGES_LIMIT_EXCEEDED,
                f"at most {settings.MAX_REVIEW_IMAGES} images allowed",
            )
        row = Review(
            order_id=order.id,
            order_item_id=oi.id,
            user_id=user.id,
            spu_id=oi.spu_id,
            sku_id=oi.sku_id,
            shop_id=order.shop_id,
            rating=it.rating,
            content=it.content,
            images=list(it.images),
            is_anonymous=it.is_anonymous,
            visible=True,
            edit_count=0,
            edit_deadline_at=deadline,
        )
        session.add(row)
        created.append(row)
        already.add(oi.id)
    await session.flush()

    # Aggregate refresh.
    await update_shop_rating(session, order.shop_id)

    await write_audit(
        session,
        actor_type=AuditActorType.USER,
        actor_id=user.id,
        action="user.review.create",
        target_type="order",
        target_id=order.id,
        ip=ip,
        user_agent=user_agent,
        extra={"review_ids": [r.id for r in created]},
    )

    # Notify shop merchants (best-effort, does not affect rollback semantics
    # because service is expected to be committed by the surrounding request
    # dependency).
    for r in created:
        await notification_service.notify_merchants_of_shop(
            session,
            r.shop_id,
            NotificationCategory.REVIEW,
            title=f"新评价 {r.rating}星",
            body=(r.content[:80] + "…") if len(r.content) > 80 else r.content,
            action_url=f"/merchant/reviews/{r.id}",
            related_type="review",
            related_id=r.id,
        )

    return [await _serialize_review(session, r) for r in created]


# ---------------------------------------------------------------------------
# User: edit / delete
# ---------------------------------------------------------------------------
async def user_edit(
    session: AsyncSession,
    user: User,
    review_id: int,
    payload: ReviewUpdateIn,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> ReviewOut:
    row = await _load_review_for_user(session, user, review_id)
    if row.edit_count >= 1:
        raise AppException(
            ErrorCode.REVIEW_EDIT_WINDOW_EXPIRED,
            "review has already been edited once",
        )
    now = _now()
    deadline = _as_aware(row.edit_deadline_at) or now
    if now > deadline:
        raise AppException(
            ErrorCode.REVIEW_EDIT_WINDOW_EXPIRED,
            "edit window has expired",
        )

    if payload.rating is not None:
        row.rating = payload.rating
    if payload.content is not None:
        row.content = payload.content
    if payload.images is not None:
        row.images = list(payload.images)
    row.edit_count += 1
    await session.flush()
    await session.refresh(row)

    await update_shop_rating(session, row.shop_id)

    await write_audit(
        session,
        actor_type=AuditActorType.USER,
        actor_id=user.id,
        action="user.review.edit",
        target_type="review",
        target_id=row.id,
        ip=ip,
        user_agent=user_agent,
    )
    return await _serialize_review(session, row)


async def user_delete_soft(
    session: AsyncSession,
    user: User,
    review_id: int,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> None:
    row = await _load_review_for_user(session, user, review_id)
    row.deleted_at = _now()
    await session.flush()
    await update_shop_rating(session, row.shop_id)
    await write_audit(
        session,
        actor_type=AuditActorType.USER,
        actor_id=user.id,
        action="user.review.delete",
        target_type="review",
        target_id=row.id,
        ip=ip,
        user_agent=user_agent,
    )


# ---------------------------------------------------------------------------
# List helpers
# ---------------------------------------------------------------------------
async def _paginate(
    session: AsyncSession,
    where: list[Any],
    *,
    page: int,
    size: int,
    include_reply: bool,
    include_user_name: bool,
    with_summary: bool = False,
) -> ReviewListOut:
    total = int(
        (await session.execute(select(func.count(Review.id)).where(and_(*where)))).scalar_one()
    )
    stmt = (
        select(Review)
        .where(and_(*where))
        .order_by(Review.created_at.desc(), Review.id.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    rows = list((await session.execute(stmt)).scalars().all())
    items = [
        await _serialize_review(
            session, r, include_reply=include_reply, include_user_name=include_user_name
        )
        for r in rows
    ]
    summary: ReviewRatingSummary | None = None
    if with_summary:
        summary = await _summarize(session, where)
    return ReviewListOut(items=items, total=total, page=page, size=size, summary=summary)


async def list_by_user(
    session: AsyncSession,
    user: User,
    *,
    page: int,
    size: int,
) -> ReviewListOut:
    where = [Review.user_id == user.id, Review.deleted_at.is_(None)]
    return await _paginate(
        session, where, page=page, size=size, include_reply=True, include_user_name=False
    )


async def list_by_spu(
    session: AsyncSession,
    spu_id: int,
    *,
    rating: int | None,
    with_images: bool,
    page: int,
    size: int,
) -> ReviewListOut:
    where: list[Any] = [
        Review.spu_id == spu_id,
        Review.visible.is_(True),
        Review.deleted_at.is_(None),
    ]
    if rating is not None:
        if not (1 <= rating <= 5):
            raise AppException(ErrorCode.REVIEW_RATING_INVALID, "rating filter must be 1..5")
        where.append(Review.rating == rating)
    # Return with rating summary for the SPU as a whole (ignoring filter).
    return await _paginate(
        session,
        where,
        page=page,
        size=size,
        include_reply=True,
        include_user_name=True,
        with_summary=True,
    )


async def list_by_shop(
    session: AsyncSession,
    shop_id: int,
    *,
    page: int,
    size: int,
) -> ReviewListOut:
    where = [
        Review.shop_id == shop_id,
        Review.visible.is_(True),
        Review.deleted_at.is_(None),
    ]
    return await _paginate(
        session,
        where,
        page=page,
        size=size,
        include_reply=True,
        include_user_name=True,
        with_summary=True,
    )


async def merchant_list_shop(
    session: AsyncSession,
    account: MerchantAccount,
    *,
    rating: int | None,
    has_reply: bool | None,
    keyword: str | None,
    page: int,
    size: int,
) -> ReviewListOut:
    where: list[Any] = [
        Review.shop_id == account.shop_id,
        Review.deleted_at.is_(None),
    ]
    if rating is not None:
        where.append(Review.rating == rating)
    if keyword:
        kw = f"%{keyword.strip()}%"
        where.append(Review.content.ilike(kw))
    if has_reply is True:
        where.append(Review.id.in_(select(ReviewReply.review_id)))
    elif has_reply is False:
        where.append(Review.id.notin_(select(ReviewReply.review_id)))

    return await _paginate(
        session, where, page=page, size=size, include_reply=True, include_user_name=True
    )


async def admin_list_all(
    session: AsyncSession,
    *,
    visible: bool | None,
    shop_id: int | None,
    spu_id: int | None,
    keyword: str | None,
    page: int,
    size: int,
) -> ReviewListOut:
    where: list[Any] = [Review.deleted_at.is_(None)]
    if visible is not None:
        where.append(Review.visible.is_(visible))
    if shop_id is not None:
        where.append(Review.shop_id == shop_id)
    if spu_id is not None:
        where.append(Review.spu_id == spu_id)
    if keyword:
        kw = f"%{keyword.strip()}%"
        where.append(or_(Review.content.ilike(kw), Review.hidden_reason.ilike(kw)))
    return await _paginate(
        session, where, page=page, size=size, include_reply=True, include_user_name=True
    )


async def admin_get_detail(session: AsyncSession, review_id: int) -> ReviewOut:
    row = await _load_review(session, review_id)
    return await _serialize_review(session, row)


# ---------------------------------------------------------------------------
# Admin moderation
# ---------------------------------------------------------------------------
async def admin_hide(
    session: AsyncSession,
    admin: AdminUser,
    review_id: int,
    payload: AdminReviewHideIn,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> ReviewOut:
    row = await _load_review(session, review_id)
    if not row.visible:
        # Idempotent: hiding an already-hidden review is a no-op success.
        return await _serialize_review(session, row)
    row.visible = False
    row.hidden_by_admin_id = admin.id
    row.hidden_reason = payload.hidden_reason
    row.hidden_at = _now()
    await session.flush()
    await update_shop_rating(session, row.shop_id)

    await write_audit(
        session,
        actor_type=AuditActorType.ADMIN,
        actor_id=admin.id,
        action="admin.review.hide",
        target_type="review",
        target_id=row.id,
        ip=ip,
        user_agent=user_agent,
        extra={"reason": payload.hidden_reason},
    )
    await notification_service.notify_user(
        session,
        row.user_id,
        NotificationCategory.REVIEW,
        title="您的评价已被隐藏",
        body=payload.hidden_reason,
        action_url=f"/user/reviews/{row.id}",
        related_type="review",
        related_id=row.id,
    )
    return await _serialize_review(session, row)


async def admin_restore(
    session: AsyncSession,
    admin: AdminUser,
    review_id: int,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> ReviewOut:
    row = await _load_review(session, review_id)
    if row.visible:
        return await _serialize_review(session, row)
    row.visible = True
    row.hidden_by_admin_id = None
    row.hidden_reason = None
    row.hidden_at = None
    await session.flush()
    await update_shop_rating(session, row.shop_id)
    await write_audit(
        session,
        actor_type=AuditActorType.ADMIN,
        actor_id=admin.id,
        action="admin.review.restore",
        target_type="review",
        target_id=row.id,
        ip=ip,
        user_agent=user_agent,
    )
    return await _serialize_review(session, row)


__all__ = [
    "_load_review",
    "admin_get_detail",
    "admin_hide",
    "admin_list_all",
    "admin_restore",
    "list_by_shop",
    "list_by_spu",
    "list_by_user",
    "merchant_list_shop",
    "update_shop_rating",
    "user_create_batch",
    "user_delete_soft",
    "user_edit",
]
