"""Merchant self-service business logic (profile / shop / password)."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppException, ErrorCode
from app.core.rbac import Permission, permissions_for_merchant
from app.core.security import hash_password, verify_password
from app.models.audit_log import AuditActorType
from app.models.merchant import MerchantAccount, Shop
from app.models.refresh_token import SubjectType
from app.schemas.merchant import (
    MerchantAccountOut,
    MerchantChangePasswordIn,
    MerchantMeOut,
    ShopOut,
    ShopUpdateIn,
)
from app.services import auth_service
from app.services.audit_service import write_audit


async def get_me(session: AsyncSession, account: MerchantAccount) -> MerchantMeOut:
    """Build the merchant self view."""
    shop = await session.get(Shop, account.shop_id)
    if shop is None:
        raise AppException(ErrorCode.RESOURCE_NOT_FOUND, "shop missing")

    perms = sorted(p.value for p in permissions_for_merchant(account.role))
    return MerchantMeOut(
        account=MerchantAccountOut.model_validate(account),
        shop=ShopOut.model_validate(shop),
        permissions=perms,
    )


async def update_shop(
    session: AsyncSession,
    account: MerchantAccount,
    payload: ShopUpdateIn,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> ShopOut:
    """Update whitelisted shop fields; SHOP_OWNER only (checked upstream)."""
    if Permission.MERCHANT_SHOP_UPDATE not in permissions_for_merchant(account.role):
        raise AppException(ErrorCode.PERMISSION_DENIED, "permission denied")

    shop = await session.get(Shop, account.shop_id)
    if shop is None:
        raise AppException(ErrorCode.RESOURCE_NOT_FOUND, "shop missing")

    changed: dict[str, object] = {}
    if payload.description is not None:
        shop.description = payload.description
        changed["description"] = True
    if payload.contact_name is not None:
        shop.contact_name = payload.contact_name
        changed["contact_name"] = payload.contact_name
    if payload.contact_phone is not None:
        shop.contact_phone = payload.contact_phone
        changed["contact_phone"] = payload.contact_phone

    if changed:
        await session.flush()
        await write_audit(
            session,
            actor_type=AuditActorType.MERCHANT,
            actor_id=account.id,
            action="merchant.shop.update",
            target_type="shop",
            target_id=shop.id,
            ip=ip,
            user_agent=user_agent,
            extra={"fields": list(changed.keys())},
        )
    return ShopOut.model_validate(shop)


async def change_password(
    session: AsyncSession,
    account: MerchantAccount,
    payload: MerchantChangePasswordIn,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> None:
    """Verify old password, rewrite hash, revoke all refresh tokens."""
    if not verify_password(payload.old_password, account.password_hash):
        raise AppException(ErrorCode.OLD_PASSWORD_MISMATCH, "old password mismatch")

    account.password_hash = hash_password(payload.new_password)
    await session.flush()

    await auth_service._revoke_all_refresh_for_subject(session, SubjectType.MERCHANT, account.id)

    await write_audit(
        session,
        actor_type=AuditActorType.MERCHANT,
        actor_id=account.id,
        action="merchant.password.change",
        target_type="merchant_account",
        target_id=account.id,
        ip=ip,
        user_agent=user_agent,
    )


__all__ = ["change_password", "get_me", "update_shop"]
