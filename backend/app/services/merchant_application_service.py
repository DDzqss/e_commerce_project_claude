"""Merchant onboarding application service.

Implements the state-machine described in contract §8.1:

    pending ─(admin approve)─▶ approved  (creates Shop + MerchantAccount)
       │  ─(admin reject +note)─▶ rejected
       │  ─(applicant withdraw)─▶ withdrawn

Approval is transactional: Shop + MerchantAccount + application update
either all commit or all roll back.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppException, ErrorCode
from app.core.security import hash_password
from app.models.admin_user import AdminUser
from app.models.audit_log import AuditActorType
from app.models.merchant import MerchantAccount, MerchantRole, Shop
from app.models.merchant_application import MerchantApplication, MerchantApplicationStatus
from app.models.user import User
from app.schemas.merchant import MerchantAccountWithPasswordOut
from app.schemas.merchant_application import (
    MerchantApplicationCreateIn,
    MerchantApplicationOut,
)
from app.services.audit_service import write_audit
from app.services.auth_service import generate_initial_merchant_password

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Applicant-side (user)
# ---------------------------------------------------------------------------
async def apply(
    session: AsyncSession,
    user: User,
    payload: MerchantApplicationCreateIn,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> MerchantApplicationOut:
    """Submit a new merchant application."""
    # Guard: user already has an active MerchantAccount → 3002.
    already_stmt = select(MerchantAccount.id).where(
        MerchantAccount.user_id == user.id,
        MerchantAccount.deleted_at.is_(None),
    )
    if (await session.execute(already_stmt)).scalar_one_or_none() is not None:
        raise AppException(ErrorCode.ALREADY_A_MERCHANT, "user is already a merchant")

    # Guard: an existing pending application → 3001.
    pending_stmt = select(MerchantApplication.id).where(
        MerchantApplication.applicant_user_id == user.id,
        MerchantApplication.status == MerchantApplicationStatus.PENDING,
    )
    if (await session.execute(pending_stmt)).scalar_one_or_none() is not None:
        raise AppException(
            ErrorCode.APPLICATION_ALREADY_PENDING,
            "an application is already pending",
        )

    row = MerchantApplication(
        applicant_user_id=user.id,
        shop_name=payload.shop_name,
        contact_name=payload.contact_name,
        contact_phone=payload.contact_phone,
        business_license_no=payload.business_license_no,
        description=payload.description,
        status=MerchantApplicationStatus.PENDING,
    )
    session.add(row)
    await session.flush()

    await write_audit(
        session,
        actor_type=AuditActorType.USER,
        actor_id=user.id,
        action="user.merchant_application.submit",
        target_type="merchant_application",
        target_id=row.id,
        ip=ip,
        user_agent=user_agent,
    )

    return MerchantApplicationOut.model_validate(row)


async def list_by_user(
    session: AsyncSession, user: User, *, page: int, size: int
) -> tuple[list[MerchantApplicationOut], int]:
    """Return this user's application history (newest first)."""
    total_stmt = select(func.count(MerchantApplication.id)).where(
        MerchantApplication.applicant_user_id == user.id
    )
    total = int((await session.execute(total_stmt)).scalar_one())

    stmt = (
        select(MerchantApplication)
        .where(MerchantApplication.applicant_user_id == user.id)
        .order_by(MerchantApplication.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    rows = (await session.execute(stmt)).scalars().all()
    return [MerchantApplicationOut.model_validate(r) for r in rows], total


async def get_owned(
    session: AsyncSession, user: User, application_id: int
) -> MerchantApplicationOut:
    """Return one of the user's own applications by id."""
    row = await session.get(MerchantApplication, application_id)
    if row is None or row.applicant_user_id != user.id:
        raise AppException(ErrorCode.APPLICATION_NOT_FOUND, "application not found")
    return MerchantApplicationOut.model_validate(row)


async def withdraw(
    session: AsyncSession,
    user: User,
    application_id: int,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> MerchantApplicationOut:
    """Applicant withdraws a pending application (only ``pending`` allowed)."""
    row = await session.get(MerchantApplication, application_id)
    if row is None or row.applicant_user_id != user.id:
        raise AppException(ErrorCode.APPLICATION_NOT_FOUND, "application not found")
    if row.status != MerchantApplicationStatus.PENDING:
        raise AppException(
            ErrorCode.APPLICATION_STATUS_INVALID_FOR_ACTION,
            "only pending applications can be withdrawn",
        )

    row.status = MerchantApplicationStatus.WITHDRAWN
    row.reviewed_at = datetime.now(UTC)
    await session.flush()

    await write_audit(
        session,
        actor_type=AuditActorType.USER,
        actor_id=user.id,
        action="user.merchant_application.withdraw",
        target_type="merchant_application",
        target_id=row.id,
        ip=ip,
        user_agent=user_agent,
    )
    return MerchantApplicationOut.model_validate(row)


# ---------------------------------------------------------------------------
# Admin-side
# ---------------------------------------------------------------------------
async def admin_list(
    session: AsyncSession,
    *,
    status_: MerchantApplicationStatus | None,
    keyword: str | None,
    page: int,
    size: int,
) -> tuple[list[MerchantApplicationOut], int]:
    """Admin listing with optional status + keyword filters."""
    conds = []
    if status_ is not None:
        conds.append(MerchantApplication.status == status_)
    if keyword:
        like = f"%{keyword}%"
        conds.append(
            or_(
                MerchantApplication.shop_name.ilike(like),
                MerchantApplication.contact_name.ilike(like),
            )
        )

    base = select(MerchantApplication)
    total_base = select(func.count(MerchantApplication.id))
    if conds:
        base = base.where(*conds)
        total_base = total_base.where(*conds)

    total = int((await session.execute(total_base)).scalar_one())
    rows = (
        (
            await session.execute(
                base.order_by(MerchantApplication.created_at.desc())
                .offset((page - 1) * size)
                .limit(size)
            )
        )
        .scalars()
        .all()
    )
    return [MerchantApplicationOut.model_validate(r) for r in rows], total


async def admin_get(session: AsyncSession, application_id: int) -> MerchantApplicationOut:
    """Admin lookup by id."""
    row = await session.get(MerchantApplication, application_id)
    if row is None:
        raise AppException(ErrorCode.APPLICATION_NOT_FOUND, "application not found")
    return MerchantApplicationOut.model_validate(row)


async def admin_approve(
    session: AsyncSession,
    admin: AdminUser,
    application_id: int,
    *,
    review_note: str | None,
    ip: str | None = None,
    user_agent: str | None = None,
) -> tuple[MerchantApplicationOut, MerchantAccountWithPasswordOut]:
    """Approve: create Shop + MerchantAccount + back-fill application."""
    row = await session.get(MerchantApplication, application_id)
    if row is None:
        raise AppException(ErrorCode.APPLICATION_NOT_FOUND, "application not found")
    if row.status != MerchantApplicationStatus.PENDING:
        raise AppException(
            ErrorCode.APPLICATION_STATUS_INVALID_FOR_ACTION,
            "only pending applications can be approved",
        )

    # 1) Shop
    shop = Shop(
        name=row.shop_name,
        description=row.description,
        contact_name=row.contact_name,
        contact_phone=row.contact_phone,
    )
    session.add(shop)
    await session.flush()  # populate shop.id

    # 2) MerchantAccount with system-generated password.
    initial_password = generate_initial_merchant_password()
    account = MerchantAccount(
        user_id=row.applicant_user_id,
        login_name=f"shop{shop.id}_owner",
        password_hash=hash_password(initial_password),
        shop_id=shop.id,
        role=MerchantRole.SHOP_OWNER,
    )
    session.add(account)
    await session.flush()

    # 3) Back-fill the application.
    row.status = MerchantApplicationStatus.APPROVED
    row.reviewer_admin_id = admin.id
    row.review_note = review_note
    row.reviewed_at = datetime.now(UTC)
    row.approved_merchant_account_id = account.id
    await session.flush()

    # SIMULATED CHANNEL — real SMS/email delivery is deferred; contract
    # §8.1 says we log the credentials so devs can complete onboarding.
    logger.info(
        "merchant onboarding approved: shop_id=%s login_name=%s initial_password=%s",
        shop.id,
        account.login_name,
        initial_password,
    )

    await write_audit(
        session,
        actor_type=AuditActorType.ADMIN,
        actor_id=admin.id,
        action="admin.merchant_application.approve",
        target_type="merchant_application",
        target_id=row.id,
        ip=ip,
        user_agent=user_agent,
        extra={"shop_id": shop.id, "account_id": account.id},
    )

    account_out = MerchantAccountWithPasswordOut.model_validate(
        {
            "id": account.id,
            "user_id": account.user_id,
            "login_name": account.login_name,
            "shop_id": account.shop_id,
            "role": account.role,
            "status": account.status,
            "initial_password": initial_password,
        }
    )
    return MerchantApplicationOut.model_validate(row), account_out


async def admin_reject(
    session: AsyncSession,
    admin: AdminUser,
    application_id: int,
    *,
    review_note: str,
    ip: str | None = None,
    user_agent: str | None = None,
) -> MerchantApplicationOut:
    """Reject: require a note (5-500 chars, contract §9)."""
    if review_note is None or not (5 <= len(review_note) <= 500):
        raise AppException(
            ErrorCode.VALIDATION_ERROR,
            "review_note is required and must be 5-500 characters",
        )

    row = await session.get(MerchantApplication, application_id)
    if row is None:
        raise AppException(ErrorCode.APPLICATION_NOT_FOUND, "application not found")
    if row.status != MerchantApplicationStatus.PENDING:
        raise AppException(
            ErrorCode.APPLICATION_STATUS_INVALID_FOR_ACTION,
            "only pending applications can be rejected",
        )

    row.status = MerchantApplicationStatus.REJECTED
    row.reviewer_admin_id = admin.id
    row.review_note = review_note
    row.reviewed_at = datetime.now(UTC)
    await session.flush()

    await write_audit(
        session,
        actor_type=AuditActorType.ADMIN,
        actor_id=admin.id,
        action="admin.merchant_application.reject",
        target_type="merchant_application",
        target_id=row.id,
        ip=ip,
        user_agent=user_agent,
    )
    return MerchantApplicationOut.model_validate(row)


__all__ = [
    "admin_approve",
    "admin_get",
    "admin_list",
    "admin_reject",
    "apply",
    "get_owned",
    "list_by_user",
    "withdraw",
]
