"""User self-service business logic (profile / password)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppException, ErrorCode
from app.core.security import hash_password, verify_password
from app.models.audit_log import AuditActorType
from app.models.merchant import MerchantAccount
from app.models.merchant_application import MerchantApplication, MerchantApplicationStatus
from app.models.refresh_token import SubjectType
from app.models.user import User
from app.schemas.user import ChangePasswordIn, UserMeOut, UserOut, UserUpdateIn
from app.services import auth_service
from app.services.audit_service import write_audit


async def get_me(session: AsyncSession, user: User) -> UserMeOut:
    """Build the ``/user/me`` payload (profile + merchant/apply context)."""
    accounts_stmt = select(MerchantAccount.id).where(
        MerchantAccount.user_id == user.id,
        MerchantAccount.deleted_at.is_(None),
    )
    account_ids = list((await session.execute(accounts_stmt)).scalars().all())

    pending_stmt = select(MerchantApplication.id).where(
        MerchantApplication.applicant_user_id == user.id,
        MerchantApplication.status == MerchantApplicationStatus.PENDING,
    )
    pending = (await session.execute(pending_stmt)).scalar_one_or_none()

    return UserMeOut(
        user=UserOut.model_validate(user),
        merchant_account_ids=account_ids,
        pending_application_id=pending,
    )


async def update_profile(
    session: AsyncSession,
    user: User,
    payload: UserUpdateIn,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> UserOut:
    """Update the whitelisted profile fields."""
    changed: dict[str, object] = {}
    if payload.nickname is not None:
        user.nickname = payload.nickname
        changed["nickname"] = payload.nickname
    if payload.avatar_url is not None:
        user.avatar_url = payload.avatar_url
        changed["avatar_url"] = payload.avatar_url

    if changed:
        await session.flush()
        await write_audit(
            session,
            actor_type=AuditActorType.USER,
            actor_id=user.id,
            action="user.profile.update",
            target_type="user",
            target_id=user.id,
            ip=ip,
            user_agent=user_agent,
            extra={"fields": list(changed.keys())},
        )
    return UserOut.model_validate(user)


async def change_password(
    session: AsyncSession,
    user: User,
    payload: ChangePasswordIn,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> None:
    """Verify old password and rewrite the hash; revoke all refresh."""
    if not verify_password(payload.old_password, user.password_hash):
        raise AppException(ErrorCode.OLD_PASSWORD_MISMATCH, "old password mismatch")

    user.password_hash = hash_password(payload.new_password)
    await session.flush()

    # Revoke all outstanding refresh tokens for this user.
    await auth_service._revoke_all_refresh_for_subject(session, SubjectType.USER, user.id)

    await write_audit(
        session,
        actor_type=AuditActorType.USER,
        actor_id=user.id,
        action="user.password.change",
        target_type="user",
        target_id=user.id,
        ip=ip,
        user_agent=user_agent,
    )


__all__ = ["change_password", "get_me", "update_profile"]
