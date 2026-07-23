"""Inventory adjust + log service — contract §10.

Every mutation is transactional: update ``skus.stock`` and insert a
matching ``inventory_logs`` row in the same session flush.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppException, ErrorCode
from app.models.audit_log import AuditActorType
from app.models.inventory_log import (
    InventoryLog,
    InventoryOperatorType,
    InventoryReason,
)
from app.models.merchant import MerchantAccount
from app.models.product import SPU
from app.models.sku import SKU
from app.schemas.inventory import InventoryAdjustIn, InventoryLogOut
from app.services.audit_service import write_audit


async def write_log_row(
    session: AsyncSession,
    *,
    sku: SKU,
    delta: int,
    reason: InventoryReason,
    operator_type: InventoryOperatorType,
    operator_id: int | None,
    note: str | None,
    related_order_id: int | None = None,
) -> InventoryLog:
    """Insert an ``inventory_logs`` row. Assumes ``sku.stock`` is already updated."""
    log = InventoryLog(
        sku_id=sku.id,
        delta=delta,
        balance_after=sku.stock,
        reason=reason,
        operator_type=operator_type,
        operator_id=operator_id,
        note=note,
        related_order_id=related_order_id,
    )
    session.add(log)
    await session.flush()
    return log


async def _load_owned_sku(session: AsyncSession, account: MerchantAccount, sku_id: int) -> SKU:
    sku = await session.get(SKU, sku_id)
    if sku is None or sku.deleted_at is not None:
        raise AppException(ErrorCode.SKU_NOT_FOUND, "sku not found")
    spu = await session.get(SPU, sku.spu_id)
    if spu is None or spu.deleted_at is not None or spu.shop_id != account.shop_id:
        raise AppException(ErrorCode.SPU_PERMISSION_DENIED, "sku belongs to another shop")
    return sku


async def adjust(
    session: AsyncSession,
    account: MerchantAccount,
    sku_id: int,
    payload: InventoryAdjustIn,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> InventoryLogOut:
    if payload.delta == 0:
        raise AppException(ErrorCode.INVENTORY_DELTA_INVALID, "delta must be non-zero")
    if payload.reason not in {
        InventoryReason.PURCHASE,
        InventoryReason.ADJUST,
        InventoryReason.REFUND_RETURN,
        InventoryReason.INITIAL,
        InventoryReason.SALE,
    }:  # pragma: no cover — enum guard
        raise AppException(ErrorCode.INVENTORY_REASON_INVALID, "invalid reason")

    sku = await _load_owned_sku(session, account, sku_id)

    new_stock = sku.stock + payload.delta
    if new_stock < 0:
        raise AppException(
            ErrorCode.INVENTORY_STOCK_INSUFFICIENT,
            f"stock would go negative (current={sku.stock}, delta={payload.delta})",
        )
    sku.stock = new_stock
    await session.flush()

    log = await write_log_row(
        session,
        sku=sku,
        delta=payload.delta,
        reason=payload.reason,
        operator_type=InventoryOperatorType.MERCHANT,
        operator_id=account.id,
        note=payload.note,
    )
    await session.refresh(log)

    await write_audit(
        session,
        actor_type=AuditActorType.MERCHANT,
        actor_id=account.id,
        action="merchant.inventory.adjust",
        target_type="sku",
        target_id=sku.id,
        ip=ip,
        user_agent=user_agent,
        extra={
            "delta": payload.delta,
            "reason": payload.reason.value,
            "balance_after": sku.stock,
        },
    )
    return InventoryLogOut.model_validate(log)


async def list_logs(
    session: AsyncSession,
    account: MerchantAccount,
    sku_id: int,
    *,
    page: int,
    size: int,
) -> tuple[list[InventoryLogOut], int]:
    sku = await _load_owned_sku(session, account, sku_id)
    total_stmt = select(func.count(InventoryLog.id)).where(InventoryLog.sku_id == sku.id)
    total = int((await session.execute(total_stmt)).scalar_one())
    stmt = (
        select(InventoryLog)
        .where(InventoryLog.sku_id == sku.id)
        .order_by(InventoryLog.created_at.desc(), InventoryLog.id.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    rows = list((await session.execute(stmt)).scalars().all())
    return [InventoryLogOut.model_validate(r) for r in rows], total


__all__ = ["adjust", "list_logs", "write_log_row"]
