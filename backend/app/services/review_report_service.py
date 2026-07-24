"""Review report service — Phase 5 contract §5.1 / §5.5.

- User: submit a report (one per user per review).
- Admin: uphold (hide the review) or dismiss.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppException, ErrorCode
from app.models.admin_user import AdminUser
from app.models.audit_log import AuditActorType
from app.models.review import Review
from app.models.review_report import ReviewReport, ReviewReportStatus
from app.models.user import User
from app.schemas.review import AdminReportHandleIn, ReviewReportIn, ReviewReportOut
from app.services import review_service
from app.services.audit_service import write_audit


async def _load_review(session: AsyncSession, review_id: int) -> Review:
    row = await session.get(Review, review_id)
    if row is None or row.deleted_at is not None:
        raise AppException(ErrorCode.REVIEW_NOT_FOUND, "review not found")
    return row


async def _load_report(session: AsyncSession, report_id: int) -> ReviewReport:
    row = await session.get(ReviewReport, report_id)
    if row is None:
        raise AppException(ErrorCode.REVIEW_REPORT_NOT_FOUND, "report not found")
    return row


async def user_create(
    session: AsyncSession,
    user: User,
    review_id: int,
    payload: ReviewReportIn,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> ReviewReportOut:
    review = await _load_review(session, review_id)

    # Pre-check for a duplicate (avoids raising IntegrityError inside the
    # user request). Race conditions still caught by the DB unique index.
    exists_stmt = select(ReviewReport.id).where(
        ReviewReport.review_id == review.id,
        ReviewReport.reporter_user_id == user.id,
    )
    if (await session.execute(exists_stmt)).scalar_one_or_none() is not None:
        raise AppException(
            ErrorCode.REVIEW_REPORT_ALREADY_EXISTS,
            "you have already reported this review",
        )

    row = ReviewReport(
        review_id=review.id,
        reporter_user_id=user.id,
        reason_category=payload.reason_category,
        reason_note=payload.reason_note,
        status=ReviewReportStatus.PENDING,
    )
    try:
        session.add(row)
        await session.flush()
    except IntegrityError as exc:
        raise AppException(
            ErrorCode.REVIEW_REPORT_ALREADY_EXISTS,
            "you have already reported this review",
        ) from exc
    await session.refresh(row)

    await write_audit(
        session,
        actor_type=AuditActorType.USER,
        actor_id=user.id,
        action="user.review_report.create",
        target_type="review_report",
        target_id=row.id,
        ip=ip,
        user_agent=user_agent,
        extra={"review_id": review.id, "reason": payload.reason_category.value},
    )
    return ReviewReportOut.model_validate(row)


async def admin_list(
    session: AsyncSession,
    *,
    status: str | None,
    page: int,
    size: int,
) -> tuple[list[ReviewReportOut], int]:
    where: list[Any] = []
    if status:
        try:
            where.append(ReviewReport.status == ReviewReportStatus(status))
        except ValueError as exc:
            raise AppException(ErrorCode.VALIDATION_ERROR, f"unknown status '{status}'") from exc

    stmt_base = select(ReviewReport)
    stmt_count = select(func.count(ReviewReport.id))
    if where:
        stmt_base = stmt_base.where(and_(*where))
        stmt_count = stmt_count.where(and_(*where))
    total = int((await session.execute(stmt_count)).scalar_one())
    rows = list(
        (
            await session.execute(
                stmt_base.order_by(ReviewReport.created_at.desc(), ReviewReport.id.desc())
                .offset((page - 1) * size)
                .limit(size)
            )
        )
        .scalars()
        .all()
    )
    return [ReviewReportOut.model_validate(r) for r in rows], total


async def admin_uphold(
    session: AsyncSession,
    admin: AdminUser,
    report_id: int,
    payload: AdminReportHandleIn,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> ReviewReportOut:
    row = await _load_report(session, report_id)
    if row.status != ReviewReportStatus.PENDING:
        raise AppException(
            ErrorCode.VALIDATION_ERROR,
            "report already handled",
        )
    row.status = ReviewReportStatus.UPHELD
    row.reviewer_admin_id = admin.id
    row.review_note = payload.review_note
    row.reviewed_at = datetime.now(UTC)

    # Hide the underlying review; propagate rating recalc.
    review = await session.get(Review, row.review_id)
    if review is not None and review.visible:
        review.visible = False
        review.hidden_by_admin_id = admin.id
        review.hidden_reason = payload.review_note or "举报核实，隐藏评价"
        review.hidden_at = row.reviewed_at
        await session.flush()
        await review_service.update_shop_rating(session, review.shop_id)

        # notify author
        from app.models.notification import NotificationCategory
        from app.services import notification_service

        await notification_service.notify_user(
            session,
            review.user_id,
            NotificationCategory.REVIEW,
            title="您的评价已被隐藏",
            body=review.hidden_reason or "举报核实",
            action_url=f"/user/reviews/{review.id}",
            related_type="review",
            related_id=review.id,
        )
    await session.flush()
    await session.refresh(row)

    await write_audit(
        session,
        actor_type=AuditActorType.ADMIN,
        actor_id=admin.id,
        action="admin.review_report.uphold",
        target_type="review_report",
        target_id=row.id,
        ip=ip,
        user_agent=user_agent,
    )
    return ReviewReportOut.model_validate(row)


async def admin_dismiss(
    session: AsyncSession,
    admin: AdminUser,
    report_id: int,
    payload: AdminReportHandleIn,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> ReviewReportOut:
    row = await _load_report(session, report_id)
    if row.status != ReviewReportStatus.PENDING:
        raise AppException(
            ErrorCode.VALIDATION_ERROR,
            "report already handled",
        )
    row.status = ReviewReportStatus.DISMISSED
    row.reviewer_admin_id = admin.id
    row.review_note = payload.review_note
    row.reviewed_at = datetime.now(UTC)
    await session.flush()
    await session.refresh(row)

    await write_audit(
        session,
        actor_type=AuditActorType.ADMIN,
        actor_id=admin.id,
        action="admin.review_report.dismiss",
        target_type="review_report",
        target_id=row.id,
        ip=ip,
        user_agent=user_agent,
    )
    return ReviewReportOut.model_validate(row)


# Ruff appeasement: keep `or_` import in play for future keyword search.
_ = or_

__all__ = ["admin_dismiss", "admin_list", "admin_uphold", "user_create"]
