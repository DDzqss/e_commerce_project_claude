"""Order service — contract §8 / §10 / §11.

Owns the full order state machine (see contract §4). All state
transitions go through :func:`_transition` so the ``order_status_history``
row and status flip stay consistent.
"""

from __future__ import annotations

import secrets
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppException, ErrorCode
from app.models.address import Address
from app.models.admin_user import AdminUser
from app.models.audit_log import AuditActorType
from app.models.cart import CartItem
from app.models.inventory_log import InventoryOperatorType, InventoryReason
from app.models.merchant import MerchantAccount, Shop
from app.models.order import CancelReason, Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.order_status_history import ActorType, OrderStatusHistory
from app.models.payment_session import PaymentSession
from app.models.product import SPU
from app.models.shipment_event import ShipmentEvent, ShipmentEventType
from app.models.sku import SKU
from app.models.user import User
from app.schemas.address import AddressOut
from app.schemas.cart import CartShopBrief
from app.schemas.order import (
    OrderCreatedItem,
    OrderCreateOut,
    OrderDetailOut,
    OrderItemOut,
    OrderListItemOut,
    OrderPreviewGroupOut,
    OrderPreviewOut,
    OrderPreviewWarning,
    OrderStatusHistoryOut,
    PaymentSessionBriefOut,
    ShipmentEventOut,
)
from app.schemas.stats import AdminOrderOverviewOut, MerchantOrderStatsOut
from app.services import cart_service
from app.services.audit_service import write_audit
from app.services.inventory_service import write_log_row

# ---------------------------------------------------------------------------
# Type helpers
# ---------------------------------------------------------------------------
RoleScope = Literal["user", "merchant", "admin"]


def _as_aware(dt: datetime | None) -> datetime | None:
    """SQLite loses timezone info; coerce naïve datetimes back to UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


# ---------------------------------------------------------------------------
# Loaders
# ---------------------------------------------------------------------------
async def _load_order(session: AsyncSession, order_id: int) -> Order:
    row = await session.get(Order, order_id)
    if row is None:
        raise AppException(ErrorCode.ORDER_NOT_FOUND, "order not found")
    return row


async def _load_order_for_user(session: AsyncSession, user: User, order_id: int) -> Order:
    order = await _load_order(session, order_id)
    if order.user_id != user.id:
        raise AppException(ErrorCode.ORDER_PERMISSION_DENIED, "order belongs to another user")
    return order


async def _load_order_for_shop(
    session: AsyncSession, account: MerchantAccount, order_id: int
) -> Order:
    order = await _load_order(session, order_id)
    if order.shop_id != account.shop_id:
        raise AppException(ErrorCode.ORDER_PERMISSION_DENIED, "order belongs to another shop")
    return order


async def _load_owned_address(session: AsyncSession, user: User, address_id: int) -> Address:
    row = await session.get(Address, address_id)
    if row is None or row.deleted_at is not None or row.user_id != user.id:
        raise AppException(ErrorCode.ORDER_ADDRESS_INVALID, "address invalid")
    return row


# ---------------------------------------------------------------------------
# Order-no generation
# ---------------------------------------------------------------------------
def _generate_order_no() -> str:
    """Return an 18-char order number: ``YYYYMMDD`` + 10 random digits.

    Uniqueness is enforced by DB UNIQUE constraint; on collision the caller
    retries.
    """
    today = datetime.now(UTC).strftime("%Y%m%d")
    tail = f"{secrets.randbelow(10_000_000_000):010d}"
    return f"{today}{tail}"


# ---------------------------------------------------------------------------
# History / transitions
# ---------------------------------------------------------------------------
async def _write_history(
    session: AsyncSession,
    order: Order,
    *,
    from_status: str | None,
    to_status: str,
    actor_type: ActorType,
    actor_id: int | None,
    note: str | None,
) -> None:
    row = OrderStatusHistory(
        order_id=order.id,
        from_status=from_status,
        to_status=to_status,
        actor_type=actor_type,
        actor_id=actor_id,
        note=note,
    )
    session.add(row)
    await session.flush()


async def _transition(
    session: AsyncSession,
    order: Order,
    to_status: OrderStatus,
    *,
    actor_type: ActorType,
    actor_id: int | None,
    note: str | None,
    allowed_from: Iterable[OrderStatus],
) -> None:
    if order.status not in set(allowed_from):
        raise AppException(
            ErrorCode.ORDER_STATUS_INVALID_FOR_ACTION,
            f"cannot transition from {order.status.value} to {to_status.value}",
        )
    from_status_str = order.status.value
    order.status = to_status
    await _write_history(
        session,
        order,
        from_status=from_status_str,
        to_status=to_status.value,
        actor_type=actor_type,
        actor_id=actor_id,
        note=note,
    )


# ---------------------------------------------------------------------------
# Stock helpers
# ---------------------------------------------------------------------------
async def _lock_stock(
    session: AsyncSession,
    order: Order,
    items: list[OrderItem],
    *,
    actor_type: InventoryOperatorType,
    actor_id: int | None,
) -> None:
    """Deduct stock + bump locked_stock for each order line."""
    for item in items:
        sku = await session.get(SKU, item.sku_id)
        if sku is None:  # pragma: no cover — FK guards this
            raise AppException(ErrorCode.ORDER_STOCK_INSUFFICIENT, "sku missing")
        if sku.stock < item.quantity:
            raise AppException(
                ErrorCode.ORDER_STOCK_INSUFFICIENT,
                f"sku #{sku.id} stock insufficient: have={sku.stock} need={item.quantity}",
            )
        sku.stock -= item.quantity
        sku.locked_stock += item.quantity
        await session.flush()
        await write_log_row(
            session,
            sku=sku,
            delta=-item.quantity,
            reason=InventoryReason.SALE,
            operator_type=actor_type,
            operator_id=actor_id,
            note=f"order #{order.id} created",
            related_order_id=order.id,
        )


async def _release_stock(
    session: AsyncSession,
    order: Order,
    *,
    actor_type: InventoryOperatorType,
    actor_id: int | None,
) -> None:
    """Give stock back and unlock — on cancel."""
    items_stmt = select(OrderItem).where(OrderItem.order_id == order.id)
    items = list((await session.execute(items_stmt)).scalars().all())
    for item in items:
        sku = await session.get(SKU, item.sku_id)
        if sku is None:  # pragma: no cover
            continue
        sku.stock += item.quantity
        sku.locked_stock = max(0, sku.locked_stock - item.quantity)
        await session.flush()
        await write_log_row(
            session,
            sku=sku,
            delta=item.quantity,
            reason=InventoryReason.REFUND_RETURN,
            operator_type=actor_type,
            operator_id=actor_id,
            note=f"order #{order.id} cancelled",
            related_order_id=order.id,
        )


async def _finalize_sale(
    session: AsyncSession,
    order: Order,
) -> None:
    """On order completion: locked_stock -= qty, sold_count += qty, spu.sales_count += qty."""
    items_stmt = select(OrderItem).where(OrderItem.order_id == order.id)
    items = list((await session.execute(items_stmt)).scalars().all())
    per_spu: dict[int, int] = {}
    for item in items:
        sku = await session.get(SKU, item.sku_id)
        if sku is not None:
            sku.locked_stock = max(0, sku.locked_stock - item.quantity)
            sku.sold_count += item.quantity
            per_spu[item.spu_id] = per_spu.get(item.spu_id, 0) + item.quantity
    for spu_id, qty in per_spu.items():
        spu = await session.get(SPU, spu_id)
        if spu is not None:
            spu.sales_count += qty
    await session.flush()


# ---------------------------------------------------------------------------
# Preview
# ---------------------------------------------------------------------------
@dataclass
class _CartItemLoaded:
    cart_item: CartItem
    sku: SKU | None
    spu: SPU | None
    shop: Shop | None
    valid: bool
    reason: str | None


async def _load_cart_items_for_checkout(
    session: AsyncSession, user: User, cart_item_ids: list[int]
) -> list[_CartItemLoaded]:
    if not cart_item_ids:
        raise AppException(ErrorCode.ORDER_CART_EMPTY, "cart_item_ids empty")
    stmt = select(CartItem).where(CartItem.user_id == user.id, CartItem.id.in_(cart_item_ids))
    rows = list((await session.execute(stmt)).scalars().all())
    found_ids = {r.id for r in rows}
    missing = set(cart_item_ids) - found_ids
    if missing:
        raise AppException(
            ErrorCode.CART_ITEM_NOT_FOUND,
            f"cart_item_ids not owned or missing: {sorted(missing)}",
        )
    sku_map, spu_map, shop_map = await cart_service._fetch_related(
        session, (r.sku_id for r in rows)
    )
    loaded: list[_CartItemLoaded] = []
    for r in rows:
        sku = sku_map.get(r.sku_id)
        spu = spu_map.get(sku.spu_id) if sku is not None else None
        shop = shop_map.get(spu.shop_id) if spu is not None else None
        status, reason = cart_service._judge_status(sku, spu)
        valid = status == "valid"
        if valid and sku is not None and sku.stock < r.quantity:
            valid = False
            reason = "stock_short"
        loaded.append(
            _CartItemLoaded(cart_item=r, sku=sku, spu=spu, shop=shop, valid=valid, reason=reason)
        )
    return loaded


def _group_by_shop(loaded: list[_CartItemLoaded]) -> dict[int, list[_CartItemLoaded]]:
    groups: dict[int, list[_CartItemLoaded]] = {}
    for cl in loaded:
        if cl.spu is None:
            continue
        groups.setdefault(cl.spu.shop_id, []).append(cl)
    return groups


async def preview(
    session: AsyncSession,
    user: User,
    cart_item_ids: list[int],
    address_id: int,
) -> OrderPreviewOut:
    address = await _load_owned_address(session, user, address_id)
    loaded = await _load_cart_items_for_checkout(session, user, cart_item_ids)

    warnings: list[OrderPreviewWarning] = []
    for cl in loaded:
        if cl.valid:
            continue
        msg = _reason_message(cl.reason)
        warnings.append(
            OrderPreviewWarning(
                type=cl.reason or "invalid",
                message=msg,
                cart_item_id=cl.cart_item.id,
            )
        )

    groups: list[OrderPreviewGroupOut] = []
    grand_total = 0
    grouped = _group_by_shop(loaded)
    for _shop_id, items in grouped.items():
        # Only include shops that have at least one valid line in the group.
        shop = items[0].shop
        if shop is None:
            continue
        item_outs = []
        subtotal = 0
        for cl in items:
            item_out = cart_service._build_item_out(cl.cart_item, cl.sku, cl.spu)
            if item_out is None:
                continue
            item_outs.append(item_out)
            if cl.valid and cl.sku is not None:
                subtotal += cl.sku.price_cents * cl.cart_item.quantity
        shipping_fee = 0
        total_group = subtotal + shipping_fee
        groups.append(
            OrderPreviewGroupOut(
                shop=CartShopBrief(id=shop.id, name=shop.name),
                items=item_outs,
                subtotal_cents=subtotal,
                shipping_fee_cents=shipping_fee,
                total_cents=total_group,
            )
        )
        grand_total += total_group

    return OrderPreviewOut(
        address=AddressOut.model_validate(address),
        groups_by_shop=groups,
        grand_total_cents=grand_total,
        warnings=warnings,
    )


def _reason_message(reason: str | None) -> str:
    mapping = {
        "sku_deleted": "商品已下架",
        "spu_deleted": "商品已下架",
        "spu_not_on_sale": "商品未上架销售",
        "sku_inactive": "该规格已停售",
        "out_of_stock": "库存不足",
        "stock_short": "库存不足",
    }
    return mapping.get(reason or "", "商品不可下单")


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------
async def create(
    session: AsyncSession,
    user: User,
    cart_item_ids: list[int],
    address_id: int,
    user_note: str | None,
    idempotency_key: str,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> OrderCreateOut:
    settings = get_settings()

    # Fast-path: if idempotency key already used, return prior orders.
    prior_stmt = select(Order).where(
        Order.user_id == user.id, Order.idempotency_key == idempotency_key
    )
    prior = list((await session.execute(prior_stmt)).scalars().all())
    if prior:
        return await _serialize_created_orders(session, prior)

    address = await _load_owned_address(session, user, address_id)
    loaded = await _load_cart_items_for_checkout(session, user, cart_item_ids)

    valid_items = [cl for cl in loaded if cl.valid]
    if not valid_items:
        raise AppException(ErrorCode.ORDER_NO_VALID_ITEMS, "no valid items to order")

    grouped = _group_by_shop(valid_items)

    receiver_address = f"{address.province}{address.city}{address.district}{address.detail}"
    payment_deadline = datetime.now(UTC) + timedelta(minutes=settings.PAYMENT_TIMEOUT_MINUTES)

    created_orders: list[Order] = []

    for shop_id, items in grouped.items():
        # Build the Order row.
        shop = items[0].shop
        if shop is None:
            continue
        subtotal = sum(cl.sku.price_cents * cl.cart_item.quantity for cl in items if cl.sku)
        order_no = await _insert_order_with_unique_no(
            session,
            user_id=user.id,
            shop_id=shop_id,
            subtotal=subtotal,
            receiver_name=address.receiver_name,
            receiver_phone=address.receiver_phone,
            receiver_address=receiver_address,
            user_note=user_note,
            payment_deadline_at=payment_deadline,
            idempotency_key=idempotency_key,
        )
        # Reload the freshly-inserted order (it now has an id).
        order = (
            await session.execute(select(Order).where(Order.order_no == order_no))
        ).scalar_one()

        # Build order_items.
        order_items: list[OrderItem] = []
        for cl in items:
            assert cl.sku is not None
            assert cl.spu is not None
            oi = OrderItem(
                order_id=order.id,
                sku_id=cl.sku.id,
                spu_id=cl.spu.id,
                shop_id=cl.spu.shop_id,
                spu_title=cl.spu.title,
                sku_specs=dict(cl.sku.specs or {}),
                sku_image=cl.sku.image or cl.spu.main_image,
                unit_price_cents=cl.sku.price_cents,
                quantity=cl.cart_item.quantity,
                subtotal_cents=cl.sku.price_cents * cl.cart_item.quantity,
            )
            session.add(oi)
            order_items.append(oi)
        await session.flush()

        # Lock stock (may raise 13004 → whole transaction rolls back).
        await _lock_stock(
            session,
            order,
            order_items,
            actor_type=InventoryOperatorType.SYSTEM,
            actor_id=None,
        )

        await _write_history(
            session,
            order,
            from_status=None,
            to_status=OrderStatus.PENDING_PAYMENT.value,
            actor_type=ActorType.USER,
            actor_id=user.id,
            note=None,
        )

        created_orders.append(order)

    # Remove the cart items we ordered from (only the ones we succeeded on).
    used_cart_ids = [cl.cart_item.id for cl in valid_items]
    if used_cart_ids:
        await session.execute(
            delete(CartItem).where(CartItem.user_id == user.id, CartItem.id.in_(used_cart_ids))
        )
        await session.flush()

    await write_audit(
        session,
        actor_type=AuditActorType.USER,
        actor_id=user.id,
        action="user.order.create",
        target_type="order",
        target_id=None,
        ip=ip,
        user_agent=user_agent,
        extra={
            "order_ids": [o.id for o in created_orders],
            "cart_item_ids": used_cart_ids,
        },
    )

    return await _serialize_created_orders(session, created_orders)


async def _insert_order_with_unique_no(
    session: AsyncSession,
    *,
    user_id: int,
    shop_id: int,
    subtotal: int,
    receiver_name: str,
    receiver_phone: str,
    receiver_address: str,
    user_note: str | None,
    payment_deadline_at: datetime,
    idempotency_key: str,
) -> str:
    """Insert an Order, retrying on ``order_no`` collisions. Returns the order_no.

    Wraps each attempt in a SAVEPOINT so a duplicate-key failure can be
    rolled back without discarding the whole outer transaction.
    """
    last_error: Exception | None = None
    for _ in range(5):
        order_no = _generate_order_no()
        order = Order(
            order_no=order_no,
            user_id=user_id,
            shop_id=shop_id,
            status=OrderStatus.PENDING_PAYMENT,
            subtotal_cents=subtotal,
            shipping_fee_cents=0,
            discount_cents=0,
            total_cents=subtotal,
            receiver_name=receiver_name,
            receiver_phone=receiver_phone,
            receiver_address=receiver_address,
            user_note=user_note,
            payment_deadline_at=payment_deadline_at,
            idempotency_key=idempotency_key,
        )
        try:
            async with session.begin_nested():
                session.add(order)
                await session.flush()
            return order_no
        except IntegrityError as exc:
            last_error = exc
            msg = str(exc).lower()
            # Idempotency conflict: raise the business error directly.
            if "idempotency" in msg or "uq_orders_user_idempotency" in msg:
                raise AppException(
                    ErrorCode.ORDER_IDEMPOTENCY_CONFLICT,
                    "idempotency key conflict",
                ) from exc
            # else — order_no collision, retry with a fresh number
            continue
    raise AppException(
        ErrorCode.INTERNAL_ERROR,
        f"failed to generate a unique order_no: {last_error}",
    )


async def _serialize_created_orders(session: AsyncSession, orders: list[Order]) -> OrderCreateOut:
    if not orders:
        return OrderCreateOut(orders=[])
    shop_ids = list({o.shop_id for o in orders})
    shops = list((await session.execute(select(Shop).where(Shop.id.in_(shop_ids)))).scalars().all())
    shop_map = {s.id: s for s in shops}
    items = [
        OrderCreatedItem(
            id=o.id,
            order_no=o.order_no,
            total_cents=o.total_cents,
            shop=CartShopBrief(
                id=o.shop_id,
                name=shop_map[o.shop_id].name if o.shop_id in shop_map else "",
            ),
            payment_deadline_at=o.payment_deadline_at,
        )
        for o in orders
    ]
    return OrderCreateOut(orders=items)


# ---------------------------------------------------------------------------
# Read (list / detail)
# ---------------------------------------------------------------------------
def _split_status_multi(value: str | None) -> list[OrderStatus] | None:
    if not value:
        return None
    out: list[OrderStatus] = []
    for raw_token in value.split(","):
        token = raw_token.strip()
        if not token:
            continue
        try:
            out.append(OrderStatus(token))
        except ValueError as exc:
            raise AppException(ErrorCode.VALIDATION_ERROR, f"unknown status '{token}'") from exc
    return out or None


async def _lazy_expire_pending_payments(session: AsyncSession, orders: list[Order]) -> None:
    """Flip any pending_payment orders past their deadline to cancelled."""
    now = datetime.now(UTC)
    expired = [
        o
        for o in orders
        if o.status == OrderStatus.PENDING_PAYMENT
        and o.payment_deadline_at is not None
        and (_as_aware(o.payment_deadline_at) or now) < now
    ]
    for o in expired:
        # Reuse the internal system-cancel path (releases stock + writes history).
        await _system_cancel(session, o, reason=CancelReason.PAYMENT_TIMEOUT)


async def _load_order_items(session: AsyncSession, order_id: int) -> list[OrderItem]:
    rows = (
        (
            await session.execute(
                select(OrderItem).where(OrderItem.order_id == order_id).order_by(OrderItem.id)
            )
        )
        .scalars()
        .all()
    )
    return list(rows)


async def _build_list_item(
    session: AsyncSession,
    order: Order,
    shop_map: dict[int, Shop],
) -> OrderListItemOut:
    # Refresh so onupdate columns (updated_at) load post-flush.
    await session.refresh(order)
    items = await _load_order_items(session, order.id)
    shop = shop_map.get(order.shop_id)
    return OrderListItemOut(
        id=order.id,
        order_no=order.order_no,
        user_id=order.user_id,
        shop_id=order.shop_id,
        shop=CartShopBrief(id=shop.id, name=shop.name) if shop else None,
        status=order.status,
        subtotal_cents=order.subtotal_cents,
        shipping_fee_cents=order.shipping_fee_cents,
        discount_cents=order.discount_cents,
        total_cents=order.total_cents,
        receiver_name=order.receiver_name,
        receiver_phone=order.receiver_phone,
        receiver_address=order.receiver_address,
        payment_deadline_at=order.payment_deadline_at,
        paid_at=order.paid_at,
        shipped_at=order.shipped_at,
        auto_complete_at=order.auto_complete_at,
        completed_at=order.completed_at,
        cancelled_at=order.cancelled_at,
        cancel_reason=order.cancel_reason,
        shipping_carrier=order.shipping_carrier,
        tracking_no=order.tracking_no,
        items=[OrderItemOut.model_validate(i) for i in items],
        created_at=order.created_at,
        updated_at=order.updated_at,
    )


async def _paginate(
    session: AsyncSession,
    stmt_base: Any,
    stmt_count: Any,
    *,
    page: int,
    size: int,
) -> tuple[list[Order], int]:
    total = int((await session.execute(stmt_count)).scalar_one())
    rows_stmt = (
        stmt_base.order_by(Order.created_at.desc(), Order.id.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    rows = list((await session.execute(rows_stmt)).scalars().all())
    return rows, total


async def _shops_for(session: AsyncSession, orders: list[Order]) -> dict[int, Shop]:
    if not orders:
        return {}
    ids = list({o.shop_id for o in orders})
    rows = list((await session.execute(select(Shop).where(Shop.id.in_(ids)))).scalars().all())
    return {s.id: s for s in rows}


async def list_by_user(
    session: AsyncSession,
    user: User,
    *,
    status_filter: str | None,
    keyword: str | None,
    page: int,
    size: int,
) -> tuple[list[OrderListItemOut], int]:
    statuses = _split_status_multi(status_filter)

    where_clauses = [Order.user_id == user.id]
    if statuses:
        where_clauses.append(Order.status.in_(statuses))
    if keyword:
        keyword_like = f"%{keyword.strip()}%"
        where_clauses.append(
            or_(
                Order.order_no.ilike(keyword_like),
                Order.id.in_(
                    select(OrderItem.order_id).where(OrderItem.spu_title.ilike(keyword_like))
                ),
            )
        )

    stmt_base = select(Order).where(and_(*where_clauses))
    stmt_count = select(func.count(Order.id)).where(and_(*where_clauses))
    orders, total = await _paginate(session, stmt_base, stmt_count, page=page, size=size)
    await _lazy_expire_pending_payments(session, orders)
    shop_map = await _shops_for(session, orders)
    items = [await _build_list_item(session, o, shop_map) for o in orders]
    return items, total


async def list_by_merchant(
    session: AsyncSession,
    account: MerchantAccount,
    *,
    status_filter: str | None,
    keyword: str | None,
    start_date: datetime | None,
    end_date: datetime | None,
    page: int,
    size: int,
) -> tuple[list[OrderListItemOut], int]:
    statuses = _split_status_multi(status_filter)
    where_clauses = [Order.shop_id == account.shop_id]
    if statuses:
        where_clauses.append(Order.status.in_(statuses))
    if keyword:
        kw = f"%{keyword.strip()}%"
        where_clauses.append(
            or_(
                Order.order_no.ilike(kw),
                Order.receiver_name.ilike(kw),
                Order.receiver_phone.ilike(kw),
            )
        )
    if start_date:
        where_clauses.append(Order.created_at >= start_date)
    if end_date:
        where_clauses.append(Order.created_at <= end_date)

    stmt_base = select(Order).where(and_(*where_clauses))
    stmt_count = select(func.count(Order.id)).where(and_(*where_clauses))
    orders, total = await _paginate(session, stmt_base, stmt_count, page=page, size=size)
    shop_map = await _shops_for(session, orders)
    items = [await _build_list_item(session, o, shop_map) for o in orders]
    return items, total


async def list_by_admin(
    session: AsyncSession,
    *,
    status_filter: str | None,
    shop_id: int | None,
    user_id: int | None,
    keyword: str | None,
    start_date: datetime | None,
    end_date: datetime | None,
    page: int,
    size: int,
) -> tuple[list[OrderListItemOut], int]:
    statuses = _split_status_multi(status_filter)
    where_clauses: list[Any] = []
    if statuses:
        where_clauses.append(Order.status.in_(statuses))
    if shop_id is not None:
        where_clauses.append(Order.shop_id == shop_id)
    if user_id is not None:
        where_clauses.append(Order.user_id == user_id)
    if keyword:
        kw = f"%{keyword.strip()}%"
        where_clauses.append(
            or_(
                Order.order_no.ilike(kw),
                Order.receiver_name.ilike(kw),
                Order.receiver_phone.ilike(kw),
                Order.user_id.in_(
                    select(User.id).where(or_(User.phone.ilike(kw), User.email.ilike(kw)))
                ),
            )
        )
    if start_date:
        where_clauses.append(Order.created_at >= start_date)
    if end_date:
        where_clauses.append(Order.created_at <= end_date)

    stmt_base = select(Order).where(and_(*where_clauses)) if where_clauses else select(Order)
    stmt_count = (
        select(func.count(Order.id)).where(and_(*where_clauses))
        if where_clauses
        else select(func.count(Order.id))
    )
    orders, total = await _paginate(session, stmt_base, stmt_count, page=page, size=size)
    shop_map = await _shops_for(session, orders)
    items = [await _build_list_item(session, o, shop_map) for o in orders]
    return items, total


async def get_detail(
    session: AsyncSession,
    order_id: int,
    role_scope: RoleScope,
    principal_id: int,
) -> OrderDetailOut:
    order = await _load_order(session, order_id)
    if role_scope == "user" and order.user_id != principal_id:
        raise AppException(ErrorCode.ORDER_PERMISSION_DENIED, "not owner")
    if role_scope == "merchant" and order.shop_id != principal_id:
        # principal_id here is the shop_id (looked up by the caller).
        raise AppException(ErrorCode.ORDER_PERMISSION_DENIED, "not this shop")
    # admin has global read.

    # lazy expire pending_payment past deadline
    await _lazy_expire_pending_payments(session, [order])
    # Refresh so onupdate columns (updated_at) are materialised before serialize.
    await session.refresh(order)

    items = await _load_order_items(session, order.id)
    history = list(
        (
            await session.execute(
                select(OrderStatusHistory)
                .where(OrderStatusHistory.order_id == order.id)
                .order_by(OrderStatusHistory.created_at, OrderStatusHistory.id)
            )
        )
        .scalars()
        .all()
    )
    shipments = list(
        (
            await session.execute(
                select(ShipmentEvent)
                .where(ShipmentEvent.order_id == order.id)
                .order_by(ShipmentEvent.event_time, ShipmentEvent.id)
            )
        )
        .scalars()
        .all()
    )
    payments = list(
        (
            await session.execute(
                select(PaymentSession)
                .where(PaymentSession.order_id == order.id)
                .order_by(PaymentSession.created_at, PaymentSession.id)
            )
        )
        .scalars()
        .all()
    )

    shop = await session.get(Shop, order.shop_id)

    payment_out: list[PaymentSessionBriefOut] = []
    for p in payments:
        d = PaymentSessionBriefOut.model_validate(p)
        payment_out.append(d)

    detail = OrderDetailOut(
        id=order.id,
        order_no=order.order_no,
        user_id=order.user_id,
        shop_id=order.shop_id,
        shop=CartShopBrief(id=shop.id, name=shop.name) if shop else None,
        status=order.status,
        subtotal_cents=order.subtotal_cents,
        shipping_fee_cents=order.shipping_fee_cents,
        discount_cents=order.discount_cents,
        total_cents=order.total_cents,
        receiver_name=order.receiver_name,
        receiver_phone=order.receiver_phone,
        receiver_address=order.receiver_address,
        payment_deadline_at=order.payment_deadline_at,
        paid_at=order.paid_at,
        shipped_at=order.shipped_at,
        auto_complete_at=order.auto_complete_at,
        completed_at=order.completed_at,
        cancelled_at=order.cancelled_at,
        cancel_reason=order.cancel_reason,
        shipping_carrier=order.shipping_carrier,
        tracking_no=order.tracking_no,
        items=[OrderItemOut.model_validate(i) for i in items],
        created_at=order.created_at,
        updated_at=order.updated_at,
        user_note=order.user_note,
        merchant_note=order.merchant_note,
        admin_note=order.admin_note if role_scope == "admin" else None,
        cancel_note=order.cancel_note,
        status_history=[OrderStatusHistoryOut.model_validate(h) for h in history],
        shipment_events=[ShipmentEventOut.model_validate(s) for s in shipments],
        payment_sessions=payment_out,
    )
    return detail


# ---------------------------------------------------------------------------
# Cancel paths
# ---------------------------------------------------------------------------
async def _cancel_common(
    session: AsyncSession,
    order: Order,
    *,
    actor_type: ActorType,
    actor_id: int | None,
    reason: CancelReason,
    note: str | None,
    allowed_from: Iterable[OrderStatus],
    operator_type: InventoryOperatorType,
) -> None:
    if order.status == OrderStatus.CANCELLED:
        raise AppException(ErrorCode.ORDER_ALREADY_CANCELLED, "order already cancelled")
    await _transition(
        session,
        order,
        OrderStatus.CANCELLED,
        actor_type=actor_type,
        actor_id=actor_id,
        note=note,
        allowed_from=allowed_from,
    )
    order.cancel_reason = reason
    order.cancel_note = note
    order.cancelled_at = datetime.now(UTC)
    # Release the idempotency key so retries can succeed for a fresh order.
    order.idempotency_key = None
    await session.flush()
    await _release_stock(session, order, actor_type=operator_type, actor_id=actor_id)


async def cancel_by_user(
    session: AsyncSession,
    user: User,
    order_id: int,
    note: str | None,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> OrderDetailOut:
    order = await _load_order_for_user(session, user, order_id)
    await _cancel_common(
        session,
        order,
        actor_type=ActorType.USER,
        actor_id=user.id,
        reason=CancelReason.USER_CANCEL,
        note=note,
        allowed_from=[OrderStatus.PENDING_PAYMENT],
        operator_type=InventoryOperatorType.SYSTEM,
    )
    await session.refresh(order)
    await write_audit(
        session,
        actor_type=AuditActorType.USER,
        actor_id=user.id,
        action="user.order.cancel",
        target_type="order",
        target_id=order.id,
        ip=ip,
        user_agent=user_agent,
    )
    return await get_detail(session, order.id, "user", user.id)


async def cancel_by_merchant(
    session: AsyncSession,
    account: MerchantAccount,
    order_id: int,
    note: str,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> OrderDetailOut:
    order = await _load_order_for_shop(session, account, order_id)
    await _cancel_common(
        session,
        order,
        actor_type=ActorType.MERCHANT,
        actor_id=account.id,
        reason=CancelReason.MERCHANT_CANCEL,
        note=note,
        allowed_from=[OrderStatus.PAID],
        operator_type=InventoryOperatorType.SYSTEM,
    )
    await session.refresh(order)
    await write_audit(
        session,
        actor_type=AuditActorType.MERCHANT,
        actor_id=account.id,
        action="merchant.order.cancel",
        target_type="order",
        target_id=order.id,
        ip=ip,
        user_agent=user_agent,
    )
    return await get_detail(session, order.id, "merchant", account.shop_id)


async def cancel_by_admin(
    session: AsyncSession,
    admin: AdminUser,
    order_id: int,
    note: str,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> OrderDetailOut:
    order = await _load_order(session, order_id)
    await _cancel_common(
        session,
        order,
        actor_type=ActorType.ADMIN,
        actor_id=admin.id,
        reason=CancelReason.ADMIN_INTERVENE,
        note=note,
        allowed_from=[OrderStatus.PENDING_PAYMENT, OrderStatus.PAID],
        operator_type=InventoryOperatorType.ADMIN,
    )
    await session.refresh(order)
    await write_audit(
        session,
        actor_type=AuditActorType.ADMIN,
        actor_id=admin.id,
        action="admin.order.cancel",
        target_type="order",
        target_id=order.id,
        ip=ip,
        user_agent=user_agent,
    )
    return await get_detail(session, order.id, "admin", admin.id)


async def _system_cancel(session: AsyncSession, order: Order, *, reason: CancelReason) -> None:
    """Cancel a pending_payment order server-side (timeout scan)."""
    if order.status != OrderStatus.PENDING_PAYMENT:
        return
    await _cancel_common(
        session,
        order,
        actor_type=ActorType.SYSTEM,
        actor_id=None,
        reason=reason,
        note="payment deadline passed",
        allowed_from=[OrderStatus.PENDING_PAYMENT],
        operator_type=InventoryOperatorType.SYSTEM,
    )


# ---------------------------------------------------------------------------
# Confirm receipt & complete
# ---------------------------------------------------------------------------
async def confirm_receipt(
    session: AsyncSession,
    user: User,
    order_id: int,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> OrderDetailOut:
    order = await _load_order_for_user(session, user, order_id)
    await _transition(
        session,
        order,
        OrderStatus.COMPLETED,
        actor_type=ActorType.USER,
        actor_id=user.id,
        note="confirmed by user",
        allowed_from=[OrderStatus.SHIPPED],
    )
    order.completed_at = datetime.now(UTC)
    await session.flush()
    await _finalize_sale(session, order)
    await session.refresh(order)
    await write_audit(
        session,
        actor_type=AuditActorType.USER,
        actor_id=user.id,
        action="user.order.confirm_receipt",
        target_type="order",
        target_id=order.id,
        ip=ip,
        user_agent=user_agent,
    )
    return await get_detail(session, order.id, "user", user.id)


async def _system_complete(session: AsyncSession, order: Order) -> None:
    if order.status != OrderStatus.SHIPPED:
        return
    await _transition(
        session,
        order,
        OrderStatus.COMPLETED,
        actor_type=ActorType.SYSTEM,
        actor_id=None,
        note="auto-completed after 15d",
        allowed_from=[OrderStatus.SHIPPED],
    )
    order.completed_at = datetime.now(UTC)
    await session.flush()
    await _finalize_sale(session, order)


# ---------------------------------------------------------------------------
# Ship
# ---------------------------------------------------------------------------
async def ship_by_merchant(
    session: AsyncSession,
    account: MerchantAccount,
    order_id: int,
    carrier: str,
    tracking_no: str,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> OrderDetailOut:
    settings = get_settings()
    order = await _load_order_for_shop(session, account, order_id)
    await _transition(
        session,
        order,
        OrderStatus.SHIPPED,
        actor_type=ActorType.MERCHANT,
        actor_id=account.id,
        note=f"carrier={carrier} tracking={tracking_no}",
        allowed_from=[OrderStatus.PAID],
    )
    now = datetime.now(UTC)
    order.shipping_carrier = carrier
    order.tracking_no = tracking_no
    order.shipped_at = now
    order.auto_complete_at = now + timedelta(days=settings.AUTO_COMPLETE_DAYS)
    await session.flush()

    # Generate 3 simulated shipment events.
    session.add_all(
        [
            ShipmentEvent(
                order_id=order.id,
                event_type=ShipmentEventType.PICKED_UP,
                description=f"包裹已被 {carrier} 揽收",
                event_time=now,
            ),
            ShipmentEvent(
                order_id=order.id,
                event_type=ShipmentEventType.IN_TRANSIT,
                description="包裹运输中",
                event_time=now + timedelta(hours=1),
            ),
            ShipmentEvent(
                order_id=order.id,
                event_type=ShipmentEventType.DELIVERED,
                description="包裹已送达",
                event_time=now + timedelta(hours=2),
            ),
        ]
    )
    await session.flush()

    await write_audit(
        session,
        actor_type=AuditActorType.MERCHANT,
        actor_id=account.id,
        action="merchant.order.ship",
        target_type="order",
        target_id=order.id,
        ip=ip,
        user_agent=user_agent,
        extra={"carrier": carrier, "tracking_no": tracking_no},
    )
    return await get_detail(session, order.id, "merchant", account.shop_id)


async def simulate_logistics(
    session: AsyncSession,
    admin: AdminUser,
    order_id: int,
    event_type: ShipmentEventType,
    description: str,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> OrderDetailOut:
    order = await _load_order(session, order_id)
    if order.status != OrderStatus.SHIPPED:
        raise AppException(
            ErrorCode.ORDER_STATUS_INVALID_FOR_ACTION,
            "simulate logistics requires shipped status",
        )
    session.add(
        ShipmentEvent(
            order_id=order.id,
            event_type=event_type,
            description=description,
            event_time=datetime.now(UTC),
        )
    )
    await session.flush()
    await write_audit(
        session,
        actor_type=AuditActorType.ADMIN,
        actor_id=admin.id,
        action="admin.order.logistics_simulate",
        target_type="order",
        target_id=order.id,
        ip=ip,
        user_agent=user_agent,
        extra={"event_type": event_type.value},
    )
    return await get_detail(session, order.id, "admin", admin.id)


# ---------------------------------------------------------------------------
# Notes
# ---------------------------------------------------------------------------
async def add_note_merchant(
    session: AsyncSession,
    account: MerchantAccount,
    order_id: int,
    note: str,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> OrderDetailOut:
    order = await _load_order_for_shop(session, account, order_id)
    order.merchant_note = note
    await session.flush()
    await write_audit(
        session,
        actor_type=AuditActorType.MERCHANT,
        actor_id=account.id,
        action="merchant.order.note",
        target_type="order",
        target_id=order.id,
        ip=ip,
        user_agent=user_agent,
    )
    return await get_detail(session, order.id, "merchant", account.shop_id)


async def add_note_admin(
    session: AsyncSession,
    admin: AdminUser,
    order_id: int,
    note: str,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> OrderDetailOut:
    order = await _load_order(session, order_id)
    order.admin_note = note
    await session.flush()
    await write_audit(
        session,
        actor_type=AuditActorType.ADMIN,
        actor_id=admin.id,
        action="admin.order.note",
        target_type="order",
        target_id=order.id,
        ip=ip,
        user_agent=user_agent,
    )
    return await get_detail(session, order.id, "admin", admin.id)


# ---------------------------------------------------------------------------
# Shipment view
# ---------------------------------------------------------------------------
async def get_shipment_for_user(session: AsyncSession, user: User, order_id: int) -> dict[str, Any]:
    order = await _load_order_for_user(session, user, order_id)
    rows = list(
        (
            await session.execute(
                select(ShipmentEvent)
                .where(ShipmentEvent.order_id == order.id)
                .order_by(ShipmentEvent.event_time, ShipmentEvent.id)
            )
        )
        .scalars()
        .all()
    )
    return {
        "order_id": order.id,
        "shipping_carrier": order.shipping_carrier,
        "tracking_no": order.tracking_no,
        "events": [ShipmentEventOut.model_validate(r).model_dump(mode="json") for r in rows],
    }


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------
def _today_range() -> tuple[datetime, datetime]:
    now = datetime.now(UTC)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    return start, end


async def merchant_summary(
    session: AsyncSession, account: MerchantAccount
) -> MerchantOrderStatsOut:
    start, end = _today_range()
    where_shop = Order.shop_id == account.shop_id

    async def _count(status: OrderStatus, extra: Any = None) -> int:
        stmt = select(func.count(Order.id)).where(where_shop, Order.status == status)
        if extra is not None:
            stmt = stmt.where(extra)
        return int((await session.execute(stmt)).scalar_one())

    pending = await _count(OrderStatus.PENDING_PAYMENT)
    paid_pending_ship = await _count(OrderStatus.PAID)
    shipped = await _count(OrderStatus.SHIPPED)
    completed_today = await _count(
        OrderStatus.COMPLETED, and_(Order.completed_at >= start, Order.completed_at < end)
    )
    revenue_stmt = select(func.coalesce(func.sum(Order.total_cents), 0)).where(
        where_shop,
        Order.paid_at >= start,
        Order.paid_at < end,
    )
    revenue = int((await session.execute(revenue_stmt)).scalar_one())
    return MerchantOrderStatsOut(
        pending_payment_count=pending,
        paid_pending_ship_count=paid_pending_ship,
        shipped_count=shipped,
        completed_today_count=completed_today,
        revenue_today_cents=revenue,
    )


async def admin_overview(session: AsyncSession) -> AdminOrderOverviewOut:
    start, end = _today_range()

    async def _c(*where: Any) -> int:
        stmt = select(func.count(Order.id)).where(*where)
        return int((await session.execute(stmt)).scalar_one())

    orders_today = await _c(Order.created_at >= start, Order.created_at < end)
    gmv_stmt = select(func.coalesce(func.sum(Order.total_cents), 0)).where(
        Order.paid_at >= start, Order.paid_at < end
    )
    gmv = int((await session.execute(gmv_stmt)).scalar_one())
    pending = await _c(Order.status == OrderStatus.PENDING_PAYMENT)
    pending_ship = await _c(Order.status == OrderStatus.PAID)
    shipped = await _c(Order.status == OrderStatus.SHIPPED)
    cancelled_today = await _c(
        Order.status == OrderStatus.CANCELLED,
        Order.cancelled_at >= start,
        Order.cancelled_at < end,
    )
    return AdminOrderOverviewOut(
        orders_today_count=orders_today,
        orders_today_gmv_cents=gmv,
        pending_payment_count=pending,
        pending_ship_count=pending_ship,
        shipped_count=shipped,
        cancelled_today_count=cancelled_today,
    )


# ---------------------------------------------------------------------------
# Timeout scan (used by scripts + admin trigger)
# ---------------------------------------------------------------------------
async def scan_and_expire_payments(session: AsyncSession, batch: int = 100) -> int:
    now = datetime.now(UTC)
    stmt = (
        select(Order)
        .where(
            Order.status == OrderStatus.PENDING_PAYMENT,
            Order.payment_deadline_at < now,
        )
        .limit(batch)
    )
    rows = list((await session.execute(stmt)).scalars().all())
    for o in rows:
        await _system_cancel(session, o, reason=CancelReason.PAYMENT_TIMEOUT)
    return len(rows)


async def scan_and_auto_complete(session: AsyncSession, batch: int = 100) -> int:
    now = datetime.now(UTC)
    stmt = (
        select(Order)
        .where(
            Order.status == OrderStatus.SHIPPED,
            Order.auto_complete_at.is_not(None),
            Order.auto_complete_at < now,
        )
        .limit(batch)
    )
    rows = list((await session.execute(stmt)).scalars().all())
    for o in rows:
        await _system_complete(session, o)
    return len(rows)


__all__ = [
    "_finalize_sale",
    "_generate_order_no",
    "_lock_stock",
    "_release_stock",
    "_system_cancel",
    "_system_complete",
    "add_note_admin",
    "add_note_merchant",
    "admin_overview",
    "cancel_by_admin",
    "cancel_by_merchant",
    "cancel_by_user",
    "confirm_receipt",
    "create",
    "get_detail",
    "get_shipment_for_user",
    "list_by_admin",
    "list_by_merchant",
    "list_by_user",
    "merchant_summary",
    "preview",
    "scan_and_auto_complete",
    "scan_and_expire_payments",
    "ship_by_merchant",
    "simulate_logistics",
]
