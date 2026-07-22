"""FastAPI dependency injection helpers.

Provides the three ``get_current_*`` dependencies (one per identity
domain) plus a ``require_permission`` factory for RBAC checks on
individual endpoints.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import Depends, Header, Request
from jose import ExpiredSignatureError, JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.errors import AppException, ErrorCode
from app.core.rbac import (
    USER_BASE_PERMISSIONS,
    Permission,
    permissions_for_admin,
    permissions_for_merchant,
)
from app.core.security import Audience, decode_access_token
from app.models.admin_user import AdminStatus, AdminUser
from app.models.merchant import MerchantAccount, MerchantAccountStatus
from app.models.user import User, UserStatus


# ---------------------------------------------------------------------------
# Bearer token extraction
# ---------------------------------------------------------------------------
def _extract_bearer(authorization: str | None) -> str:
    if not authorization:
        raise AppException(ErrorCode.UNAUTHENTICATED, "missing Authorization header")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AppException(ErrorCode.UNAUTHENTICATED, "invalid Authorization header")
    return parts[1]


def _decode_or_raise(token: str, audience: Audience) -> dict[str, object]:
    try:
        return decode_access_token(token, audience=audience)
    except ExpiredSignatureError as exc:
        raise AppException(ErrorCode.TOKEN_EXPIRED, "token expired") from exc
    except JWTError as exc:
        raise AppException(ErrorCode.UNAUTHENTICATED, "invalid token") from exc


# ---------------------------------------------------------------------------
# Current-principal getters
# ---------------------------------------------------------------------------
async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    session: AsyncSession = Depends(get_db),
) -> User:
    """Resolve the authenticated User (aud=user) or raise."""
    token = _extract_bearer(authorization)
    payload = _decode_or_raise(token, "user")
    subject = payload.get("sub")
    if subject is None:
        raise AppException(ErrorCode.UNAUTHENTICATED, "invalid token subject")
    try:
        user_id = int(str(subject))
    except (TypeError, ValueError) as exc:
        raise AppException(ErrorCode.UNAUTHENTICATED, "invalid token subject") from exc

    user = await session.get(User, user_id)
    if user is None or user.deleted_at is not None:
        raise AppException(ErrorCode.USER_NOT_FOUND, "user not found")
    if user.status != UserStatus.ACTIVE:
        raise AppException(ErrorCode.ACCOUNT_DISABLED, "account disabled")
    return user


async def get_current_merchant(
    authorization: Annotated[str | None, Header()] = None,
    session: AsyncSession = Depends(get_db),
) -> MerchantAccount:
    """Resolve the authenticated MerchantAccount (aud=merchant) or raise."""
    token = _extract_bearer(authorization)
    payload = _decode_or_raise(token, "merchant")
    subject = payload.get("sub")
    if subject is None:
        raise AppException(ErrorCode.UNAUTHENTICATED, "invalid token subject")
    try:
        account_id = int(str(subject))
    except (TypeError, ValueError) as exc:
        raise AppException(ErrorCode.UNAUTHENTICATED, "invalid token subject") from exc

    account = await session.get(MerchantAccount, account_id)
    if account is None or account.deleted_at is not None:
        raise AppException(ErrorCode.RESOURCE_NOT_FOUND, "merchant account not found")
    if account.status != MerchantAccountStatus.ACTIVE:
        raise AppException(ErrorCode.MERCHANT_ACCOUNT_FROZEN, "merchant account frozen")
    return account


async def get_current_admin(
    authorization: Annotated[str | None, Header()] = None,
    session: AsyncSession = Depends(get_db),
) -> AdminUser:
    """Resolve the authenticated AdminUser (aud=admin) or raise."""
    token = _extract_bearer(authorization)
    payload = _decode_or_raise(token, "admin")
    subject = payload.get("sub")
    if subject is None:
        raise AppException(ErrorCode.UNAUTHENTICATED, "invalid token subject")
    try:
        admin_id = int(str(subject))
    except (TypeError, ValueError) as exc:
        raise AppException(ErrorCode.UNAUTHENTICATED, "invalid token subject") from exc

    admin = await session.get(AdminUser, admin_id)
    if admin is None or admin.deleted_at is not None:
        raise AppException(ErrorCode.ADMIN_NOT_FOUND, "admin not found")
    if admin.status != AdminStatus.ACTIVE:
        raise AppException(ErrorCode.ACCOUNT_DISABLED, "admin disabled")
    return admin


# ---------------------------------------------------------------------------
# Permission checking (factory)
# ---------------------------------------------------------------------------
def _user_permissions() -> frozenset[Permission]:
    return USER_BASE_PERMISSIONS


def require_user_permission(
    perm: Permission,
) -> Callable[..., Awaitable[User]]:
    """Return a dependency that grants access only if ``perm`` is held."""

    async def _dep(user: User = Depends(get_current_user)) -> User:
        if perm not in _user_permissions():
            raise AppException(ErrorCode.PERMISSION_DENIED, "permission denied")
        return user

    return _dep


def require_merchant_permission(
    perm: Permission,
) -> Callable[..., Awaitable[MerchantAccount]]:
    """Return a dependency that grants access only if the merchant has ``perm``."""

    async def _dep(
        account: MerchantAccount = Depends(get_current_merchant),
    ) -> MerchantAccount:
        if perm not in permissions_for_merchant(account.role):
            raise AppException(ErrorCode.PERMISSION_DENIED, "permission denied")
        return account

    return _dep


def require_admin_permission(
    perm: Permission,
) -> Callable[..., Awaitable[AdminUser]]:
    """Return a dependency that grants access only if the admin has ``perm``."""

    async def _dep(admin: AdminUser = Depends(get_current_admin)) -> AdminUser:
        if perm not in permissions_for_admin(admin.role):
            raise AppException(ErrorCode.ADMIN_PERMISSION_DENIED, "permission denied")
        return admin

    return _dep


# ---------------------------------------------------------------------------
# Request-context helpers (best-effort audit metadata)
# ---------------------------------------------------------------------------
def get_client_ip(request: Request) -> str | None:
    """Extract the caller's IP (honours X-Forwarded-For if present)."""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    client = request.client
    return client.host if client is not None else None


def get_user_agent(request: Request) -> str | None:
    return request.headers.get("user-agent")


__all__ = [
    "get_client_ip",
    "get_current_admin",
    "get_current_merchant",
    "get_current_user",
    "get_user_agent",
    "require_admin_permission",
    "require_merchant_permission",
    "require_user_permission",
]
