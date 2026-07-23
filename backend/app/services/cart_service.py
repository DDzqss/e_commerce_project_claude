"""Cart service — contract §7.

All queries here are scoped to a specific user. Cart invalidity
(SKU/SPU status, stock == 0) is computed at read time — invalid rows
stay in the cart until the user explicitly clears them.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppException, ErrorCode
from app.models.audit_log import AuditActorType
from app.models.cart import CartItem
from app.models.merchant import Shop
from app.models.product import SPU, SPUStatus
from app.models.sku import SKU
from app.models.user import User
from app.schemas.cart import (
    CartAddIn,
    CartGroupOut,
    CartItemOut,
    CartResponseOut,
    CartShopBrief,
    CartSkuBrief,
    CartSpuBrief,
    CartUpdateIn,
)
from app.services.audit_service import write_audit


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _judge_status(sku: SKU | None, spu: SPU | None) -> tuple[str, str | None]:
    """Return (status, invalid_reason) for a cart row."""
    if sku is None or sku.deleted_at is not None:
        return "invalid", "sku_deleted"
    if spu is None or spu.deleted_at is not None:
        return "invalid", "spu_deleted"
    if spu.status != SPUStatus.APPROVED:
        return "invalid", "spu_not_on_sale"
    if not sku.is_active:
        return "invalid", "sku_inactive"
    if sku.stock < 1:
        return "invalid", "out_of_stock"
    return "valid", None


async def _load_owned_cart_item(
    session: AsyncSession, user: User, item_id: int
) -> CartItem:
    row = await session.get(CartItem, item_id)
    if row is None or row.user_id != user.id:
        raise AppException(ErrorCode.CART_ITEM_NOT_FOUND, "cart item not found")
    return row


async def _fetch_related(
    session: AsyncSession, sku_ids: Iterable[int]
) -> tuple[dict[int, SKU], dict[int, SPU], dict[int, Shop]]:
    sku_id_list = list({int(x) for x in sku_ids})
    if not sku_id_list:
        return {}, {}, {}
    sku_rows = list(
        (await session.execute(select(SKU).where(SKU.id.in_(sku_id_list)))).scalars().all()
    )
    sku_map: dict[int, SKU] = {r.id: r for r in sku_rows}
    spu_ids = list({s.spu_id for s in sku_rows})
    spu_rows = (
        list((await session.execute(select(SPU).where(SPU.id.in_(spu_ids)))).scalars().all())
        if spu_ids
        else []
    )
    spu_map: dict[int, SPU] = {r.id: r for r in spu_rows}
    shop_ids = list({s.shop_id for s in spu_rows})
    shop_rows = (
        list((await session.execute(select(Shop).where(Shop.id.in_(shop_ids)))).scalars().all())
        if shop_ids
        else []
    )
    shop_map: dict[int, Shop] = {r.id: r for r in shop_rows}
    return sku_map, spu_map, shop_map


def _build_item_out(
    row: CartItem, sku: SKU | None, spu: SPU | None
) -> CartItemOut | None:
    """Return None if the SKU/SPU is completely gone (extreme case)."""
    status, reason = _judge_status(sku, spu)
    # For rendering we still want the SKU/SPU snapshot even if invalid;
    # if either row was completely purged we bail rather than crash.
    if sku is None or spu is None:
        return None
    return CartItemOut(
        id=row.id,
        sku_id=row.sku_id,
        quantity=row.quantity,
        selected=row.selected,
        status=status,
        invalid_reason=reason,
        sku=CartSkuBrief.model_validate(sku),
        spu=CartSpuBrief(
            id=spu.id,
            title=spu.title,
            main_image=spu.main_image,
            status=spu.status.value,
        ),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------
async def get_cart_grouped(session: AsyncSession, user: User) -> CartResponseOut:
    rows = list(
        (
            await session.execute(
                select(CartItem)
                .where(CartItem.user_id == user.id)
                .order_by(CartItem.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    sku_map, spu_map, shop_map = await _fetch_related(session, (r.sku_id for r in rows))

    # Build items and group by shop.
    groups_map: dict[int, dict[str, Any]] = {}
    total_cents_selected = 0
    total_selected_count = 0
    invalid_count = 0
    for r in rows:
        sku = sku_map.get(r.sku_id)
        spu = spu_map.get(sku.spu_id) if sku is not None else None
        item_out = _build_item_out(r, sku, spu)
        if item_out is None:
            invalid_count += 1
            continue
        if item_out.status == "invalid":
            invalid_count += 1
        line_total = sku.price_cents * r.quantity if sku is not None else 0
        if item_out.status == "valid" and r.selected:
            total_cents_selected += line_total
            total_selected_count += r.quantity

        assert spu is not None  # noqa: S101 — narrowed by item_out check
        shop_id = spu.shop_id
        group = groups_map.get(shop_id)
        if group is None:
            shop = shop_map.get(shop_id)
            groups_map[shop_id] = group = {
                "shop": CartShopBrief(id=shop.id, name=shop.name)
                if shop is not None
                else CartShopBrief(id=shop_id, name="(unknown)"),
                "items": [],
                "subtotal_cents_selected": 0,
            }
        group["items"].append(item_out)
        if item_out.status == "valid" and r.selected:
            group["subtotal_cents_selected"] += line_total

    groups = [
        CartGroupOut(
            shop=g["shop"],
            items=g["items"],
            subtotal_cents_selected=g["subtotal_cents_selected"],
        )
        for g in groups_map.values()
    ]
    return CartResponseOut(
        groups=groups,
        total_cents_selected=total_cents_selected,
        total_selected_count=total_selected_count,
        invalid_count=invalid_count,
    )


# ---------------------------------------------------------------------------
# Writes
# ---------------------------------------------------------------------------
async def add(
    session: AsyncSession,
    user: User,
    payload: CartAddIn,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> CartItemOut:
    settings = get_settings()

    sku = await session.get(SKU, payload.sku_id)
    if sku is None or sku.deleted_at is not None:
        raise AppException(ErrorCode.CART_SKU_INVALID, "sku not found")
    spu = await session.get(SPU, sku.spu_id)
    if (
        spu is None
        or spu.deleted_at is not None
        or spu.status != SPUStatus.APPROVED
        or not sku.is_active
    ):
        raise AppException(ErrorCode.CART_SKU_INVALID, "sku not available")

    existing_stmt = select(CartItem).where(
        CartItem.user_id == user.id, CartItem.sku_id == payload.sku_id
    )
    existing = (await session.execute(existing_stmt)).scalar_one_or_none()

    if existing is not None:
        new_qty = existing.quantity + payload.quantity
        if new_qty > settings.MAX_CART_ITEM_QUANTITY:
            raise AppException(
                ErrorCode.CART_QUANTITY_EXCEEDS_LIMIT,
                f"quantity exceeds limit of {settings.MAX_CART_ITEM_QUANTITY}",
            )
        if new_qty > sku.stock:
            raise AppException(
                ErrorCode.CART_QUANTITY_EXCEEDS_STOCK,
                f"quantity {new_qty} exceeds stock {sku.stock}",
            )
        existing.quantity = new_qty
        existing.selected = True
        await session.flush()
        await session.refresh(existing)
        row = existing
    else:
        cart_count = int(
            (
                await session.execute(
                    select(func.count(CartItem.id)).where(CartItem.user_id == user.id)
                )
            ).scalar_one()
        )
        if cart_count >= settings.MAX_CART_ITEMS_PER_USER:
            raise AppException(
                ErrorCode.CART_LIMIT_EXCEEDED,
                f"cart size exceeds limit of {settings.MAX_CART_ITEMS_PER_USER}",
            )
        if payload.quantity > sku.stock:
            raise AppException(
                ErrorCode.CART_QUANTITY_EXCEEDS_STOCK,
                f"quantity {payload.quantity} exceeds stock {sku.stock}",
            )
        row = CartItem(
            user_id=user.id,
            sku_id=payload.sku_id,
            quantity=payload.quantity,
            selected=True,
        )
        session.add(row)
        await session.flush()
        await session.refresh(row)

    await write_audit(
        session,
        actor_type=AuditActorType.USER,
        actor_id=user.id,
        action="user.cart.add",
        target_type="cart_item",
        target_id=row.id,
        ip=ip,
        user_agent=user_agent,
        extra={"sku_id": row.sku_id, "quantity": row.quantity},
    )
    out = _build_item_out(row, sku, spu)
    assert out is not None  # noqa: S101
    return out


async def update_item(
    session: AsyncSession,
    user: User,
    item_id: int,
    payload: CartUpdateIn,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> CartItemOut:
    row = await _load_owned_cart_item(session, user, item_id)
    sku = await session.get(SKU, row.sku_id)
    if sku is None or sku.deleted_at is not None:
        raise AppException(ErrorCode.CART_SKU_INVALID, "sku no longer available")
    spu = await session.get(SPU, sku.spu_id)

    if payload.quantity is not None:
        settings = get_settings()
        if payload.quantity > settings.MAX_CART_ITEM_QUANTITY:
            raise AppException(
                ErrorCode.CART_QUANTITY_EXCEEDS_LIMIT,
                f"quantity exceeds limit of {settings.MAX_CART_ITEM_QUANTITY}",
            )
        if payload.quantity > sku.stock:
            raise AppException(
                ErrorCode.CART_QUANTITY_EXCEEDS_STOCK,
                f"quantity {payload.quantity} exceeds stock {sku.stock}",
            )
        row.quantity = payload.quantity
    if payload.selected is not None:
        row.selected = payload.selected

    await session.flush()
    await session.refresh(row)

    await write_audit(
        session,
        actor_type=AuditActorType.USER,
        actor_id=user.id,
        action="user.cart.update",
        target_type="cart_item",
        target_id=row.id,
        ip=ip,
        user_agent=user_agent,
    )
    out = _build_item_out(row, sku, spu)
    assert out is not None  # noqa: S101
    return out


async def delete_(
    session: AsyncSession,
    user: User,
    item_id: int,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> None:
    row = await _load_owned_cart_item(session, user, item_id)
    await session.delete(row)
    await session.flush()
    await write_audit(
        session,
        actor_type=AuditActorType.USER,
        actor_id=user.id,
        action="user.cart.delete",
        target_type="cart_item",
        target_id=item_id,
        ip=ip,
        user_agent=user_agent,
    )


async def batch_delete(
    session: AsyncSession,
    user: User,
    ids: list[int],
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> int:
    stmt = delete(CartItem).where(CartItem.user_id == user.id, CartItem.id.in_(ids))
    result = await session.execute(stmt)
    await session.flush()
    removed = int(result.rowcount or 0)
    await write_audit(
        session,
        actor_type=AuditActorType.USER,
        actor_id=user.id,
        action="user.cart.batch_delete",
        target_type="cart_item",
        target_id=None,
        ip=ip,
        user_agent=user_agent,
        extra={"ids": ids, "removed": removed},
    )
    return removed


async def select_all(
    session: AsyncSession,
    user: User,
    selected: bool,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> int:
    stmt = (
        update(CartItem).where(CartItem.user_id == user.id).values(selected=selected)
    )
    result = await session.execute(stmt)
    await session.flush()
    changed = int(result.rowcount or 0)
    await write_audit(
        session,
        actor_type=AuditActorType.USER,
        actor_id=user.id,
        action="user.cart.select_all",
        target_type="cart_item",
        target_id=None,
        ip=ip,
        user_agent=user_agent,
        extra={"selected": selected, "changed": changed},
    )
    return changed


async def clear_invalid(
    session: AsyncSession,
    user: User,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> int:
    rows = list(
        (
            await session.execute(
                select(CartItem).where(CartItem.user_id == user.id)
            )
        )
        .scalars()
        .all()
    )
    sku_map, spu_map, _ = await _fetch_related(session, (r.sku_id for r in rows))

    invalid_ids: list[int] = []
    for r in rows:
        sku = sku_map.get(r.sku_id)
        spu = spu_map.get(sku.spu_id) if sku is not None else None
        status, _reason = _judge_status(sku, spu)
        if status == "invalid":
            invalid_ids.append(r.id)

    if invalid_ids:
        await session.execute(
            delete(CartItem).where(
                CartItem.user_id == user.id, CartItem.id.in_(invalid_ids)
            )
        )
        await session.flush()
    await write_audit(
        session,
        actor_type=AuditActorType.USER,
        actor_id=user.id,
        action="user.cart.clear_invalid",
        target_type="cart_item",
        target_id=None,
        ip=ip,
        user_agent=user_agent,
        extra={"removed": len(invalid_ids)},
    )
    return len(invalid_ids)


__all__ = [
    "_build_item_out",
    "_fetch_related",
    "_judge_status",
    "add",
    "batch_delete",
    "clear_invalid",
    "delete_",
    "get_cart_grouped",
    "select_all",
    "update_item",
]
