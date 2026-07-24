"""SKU service — contract §8.2.

Every mutation (create/update/delete) recomputes the parent SPU's
``min_price_cents`` / ``max_price_cents`` conveniently displayed on the
listing pages.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppException, ErrorCode
from app.models.audit_log import AuditActorType
from app.models.inventory_log import InventoryOperatorType, InventoryReason
from app.models.merchant import MerchantAccount
from app.models.product import SPU
from app.models.sku import SKU
from app.schemas.sku import SKUCreateIn, SKUOut, SKUUpdateIn
from app.services import product_service
from app.services.audit_service import write_audit
from app.services.inventory_service import write_log_row


async def _load_spu_owned(session: AsyncSession, account: MerchantAccount, spu_id: int) -> SPU:
    spu = await session.get(SPU, spu_id)
    if spu is None or spu.deleted_at is not None:
        raise AppException(ErrorCode.SPU_NOT_FOUND, "spu not found")
    if spu.shop_id != account.shop_id:
        raise AppException(ErrorCode.SPU_PERMISSION_DENIED, "spu belongs to another shop")
    return spu


async def _load_sku_owned(
    session: AsyncSession,
    account: MerchantAccount,
    spu_id: int,
    sku_id: int,
) -> tuple[SPU, SKU]:
    spu = await _load_spu_owned(session, account, spu_id)
    sku = await session.get(SKU, sku_id)
    if sku is None or sku.deleted_at is not None or sku.spu_id != spu.id:
        raise AppException(ErrorCode.SKU_NOT_FOUND, "sku not found")
    return spu, sku


def _validate_specs(spu: SPU, specs: dict[str, str]) -> None:
    axes = set(spu.spec_axes or [])
    keys = set(specs.keys())
    if not keys.issubset(axes):
        offenders = sorted(keys - axes)
        raise AppException(
            ErrorCode.VALIDATION_ERROR,
            f"specs keys not defined on spu.spec_axes: {offenders}",
        )


async def list_by_spu(session: AsyncSession, account: MerchantAccount, spu_id: int) -> list[SKUOut]:
    spu = await _load_spu_owned(session, account, spu_id)
    stmt = select(SKU).where(SKU.spu_id == spu.id, SKU.deleted_at.is_(None)).order_by(SKU.id)
    rows = list((await session.execute(stmt)).scalars().all())
    return [SKUOut.model_validate(r) for r in rows]


async def create(
    session: AsyncSession,
    account: MerchantAccount,
    spu_id: int,
    payload: SKUCreateIn,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> SKUOut:
    spu = await _load_spu_owned(session, account, spu_id)
    _validate_specs(spu, payload.specs)

    dup_stmt = select(SKU.id).where(
        SKU.spu_id == spu.id,
        SKU.sku_code == payload.sku_code,
        SKU.deleted_at.is_(None),
    )
    if (await session.execute(dup_stmt)).scalar_one_or_none() is not None:
        raise AppException(
            ErrorCode.SKU_CODE_CONFLICT,
            f"sku_code '{payload.sku_code}' already exists on this SPU",
        )

    sku = SKU(
        spu_id=spu.id,
        sku_code=payload.sku_code,
        specs=dict(payload.specs),
        price_cents=payload.price_cents,
        original_price_cents=payload.original_price_cents,
        stock=payload.stock,
        image=payload.image,
        is_active=payload.is_active,
    )
    session.add(sku)
    await session.flush()

    # Record an "initial" inventory log if stock > 0.
    if sku.stock > 0:
        await write_log_row(
            session,
            sku=sku,
            delta=sku.stock,
            reason=InventoryReason.INITIAL,
            operator_type=InventoryOperatorType.MERCHANT,
            operator_id=account.id,
            note="initial stock at SKU creation",
        )

    await product_service.recompute_price_range(session, spu)
    await session.refresh(sku)

    await write_audit(
        session,
        actor_type=AuditActorType.MERCHANT,
        actor_id=account.id,
        action="merchant.sku.create",
        target_type="sku",
        target_id=sku.id,
        ip=ip,
        user_agent=user_agent,
        extra={"spu_id": spu.id, "sku_code": sku.sku_code},
    )
    return SKUOut.model_validate(sku)


async def update(
    session: AsyncSession,
    account: MerchantAccount,
    spu_id: int,
    sku_id: int,
    payload: SKUUpdateIn,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> SKUOut:
    spu, sku = await _load_sku_owned(session, account, spu_id, sku_id)

    changed = False
    if payload.price_cents is not None and payload.price_cents != sku.price_cents:
        sku.price_cents = payload.price_cents
        changed = True
    if payload.original_price_cents is not None:
        sku.original_price_cents = payload.original_price_cents
        changed = True
    if payload.image is not None:
        sku.image = payload.image
        changed = True
    if payload.is_active is not None and payload.is_active != sku.is_active:
        sku.is_active = payload.is_active
        changed = True

    if changed:
        await session.flush()
        await product_service.recompute_price_range(session, spu)
        await session.refresh(sku)
        await write_audit(
            session,
            actor_type=AuditActorType.MERCHANT,
            actor_id=account.id,
            action="merchant.sku.update",
            target_type="sku",
            target_id=sku.id,
            ip=ip,
            user_agent=user_agent,
        )
    return SKUOut.model_validate(sku)


async def delete_(
    session: AsyncSession,
    account: MerchantAccount,
    spu_id: int,
    sku_id: int,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> None:
    spu, sku = await _load_sku_owned(session, account, spu_id, sku_id)
    sku.deleted_at = datetime.now(UTC)
    await session.flush()
    await product_service.recompute_price_range(session, spu)

    await write_audit(
        session,
        actor_type=AuditActorType.MERCHANT,
        actor_id=account.id,
        action="merchant.sku.delete",
        target_type="sku",
        target_id=sku.id,
        ip=ip,
        user_agent=user_agent,
    )


__all__ = ["create", "delete_", "list_by_spu", "update"]
