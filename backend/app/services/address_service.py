"""Address-book service — contract §6.

Uses soft-delete: rows with ``deleted_at IS NOT NULL`` are hidden.
Setting a new default clears any prior default in the same transaction.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppException, ErrorCode
from app.models.address import Address
from app.models.audit_log import AuditActorType
from app.models.user import User
from app.schemas.address import AddressCreateIn, AddressOut, AddressUpdateIn
from app.services.audit_service import write_audit


async def _load_address_owned(session: AsyncSession, user: User, address_id: int) -> Address:
    row = await session.get(Address, address_id)
    if row is None or row.deleted_at is not None:
        raise AppException(ErrorCode.ADDRESS_NOT_FOUND, "address not found")
    if row.user_id != user.id:
        raise AppException(ErrorCode.ADDRESS_PERMISSION_DENIED, "address belongs to another user")
    return row


async def _clear_other_defaults(session: AsyncSession, user_id: int, except_id: int | None) -> None:
    stmt = (
        update(Address)
        .where(
            Address.user_id == user_id,
            Address.deleted_at.is_(None),
            Address.is_default.is_(True),
        )
        .values(is_default=False)
    )
    if except_id is not None:
        stmt = stmt.where(Address.id != except_id)
    await session.execute(stmt)


async def list_(session: AsyncSession, user: User) -> list[AddressOut]:
    """List the user's addresses; default row first, then newest first."""
    stmt = (
        select(Address)
        .where(Address.user_id == user.id, Address.deleted_at.is_(None))
        .order_by(Address.is_default.desc(), Address.created_at.desc())
    )
    rows = list((await session.execute(stmt)).scalars().all())
    return [AddressOut.model_validate(r) for r in rows]


async def get(session: AsyncSession, user: User, address_id: int) -> AddressOut:
    row = await _load_address_owned(session, user, address_id)
    return AddressOut.model_validate(row)


async def create(
    session: AsyncSession,
    user: User,
    payload: AddressCreateIn,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> AddressOut:
    settings = get_settings()
    count = int(
        (
            await session.execute(
                select(func.count(Address.id)).where(
                    Address.user_id == user.id, Address.deleted_at.is_(None)
                )
            )
        ).scalar_one()
    )
    if count >= settings.MAX_ADDRESSES_PER_USER:
        raise AppException(
            ErrorCode.ADDRESS_LIMIT_EXCEEDED,
            f"address count exceeds limit of {settings.MAX_ADDRESSES_PER_USER}",
        )

    make_default = payload.is_default or count == 0

    if make_default:
        await _clear_other_defaults(session, user.id, except_id=None)

    row = Address(
        user_id=user.id,
        receiver_name=payload.receiver_name,
        receiver_phone=payload.receiver_phone,
        province=payload.province,
        city=payload.city,
        district=payload.district,
        detail=payload.detail,
        postal_code=payload.postal_code,
        is_default=make_default,
    )
    session.add(row)
    await session.flush()
    await session.refresh(row)

    await write_audit(
        session,
        actor_type=AuditActorType.USER,
        actor_id=user.id,
        action="user.address.create",
        target_type="address",
        target_id=row.id,
        ip=ip,
        user_agent=user_agent,
    )
    return AddressOut.model_validate(row)


async def update_(
    session: AsyncSession,
    user: User,
    address_id: int,
    payload: AddressUpdateIn,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> AddressOut:
    row = await _load_address_owned(session, user, address_id)

    data = payload.model_dump(exclude_unset=True)
    became_default = data.pop("is_default", None) is True
    for field, value in data.items():
        setattr(row, field, value)

    if became_default:
        await _clear_other_defaults(session, user.id, except_id=row.id)
        row.is_default = True

    await session.flush()
    await session.refresh(row)

    await write_audit(
        session,
        actor_type=AuditActorType.USER,
        actor_id=user.id,
        action="user.address.update",
        target_type="address",
        target_id=row.id,
        ip=ip,
        user_agent=user_agent,
    )
    return AddressOut.model_validate(row)


async def soft_delete(
    session: AsyncSession,
    user: User,
    address_id: int,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> None:
    row = await _load_address_owned(session, user, address_id)
    row.deleted_at = datetime.now(UTC)
    row.is_default = False
    await session.flush()

    await write_audit(
        session,
        actor_type=AuditActorType.USER,
        actor_id=user.id,
        action="user.address.delete",
        target_type="address",
        target_id=address_id,
        ip=ip,
        user_agent=user_agent,
    )


async def set_default(
    session: AsyncSession,
    user: User,
    address_id: int,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> AddressOut:
    row = await _load_address_owned(session, user, address_id)
    if not row.is_default:
        await _clear_other_defaults(session, user.id, except_id=row.id)
        row.is_default = True
        await session.flush()
        await session.refresh(row)
        await write_audit(
            session,
            actor_type=AuditActorType.USER,
            actor_id=user.id,
            action="user.address.set_default",
            target_type="address",
            target_id=row.id,
            ip=ip,
            user_agent=user_agent,
        )
    return AddressOut.model_validate(row)


__all__ = [
    "create",
    "get",
    "list_",
    "set_default",
    "soft_delete",
    "update_",
]
