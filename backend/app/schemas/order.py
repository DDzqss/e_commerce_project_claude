"""Order schemas — contract §8 / §10 / §11."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.order import CancelReason, OrderStatus
from app.schemas.address import AddressOut
from app.schemas.cart import CartItemOut, CartShopBrief


# ---------------------------------------------------------------------------
# Preview
# ---------------------------------------------------------------------------
class OrderPreviewIn(BaseModel):
    """Order-preview request payload."""

    cart_item_ids: list[int] = Field(min_length=1)
    address_id: int = Field(ge=1)


class OrderPreviewWarning(BaseModel):
    """One preview-time warning (invalid SKU / low stock)."""

    type: str
    message: str
    cart_item_id: int


class OrderPreviewGroupOut(BaseModel):
    """Per-shop grouping in the preview response."""

    shop: CartShopBrief
    items: list[CartItemOut]
    subtotal_cents: int
    shipping_fee_cents: int
    total_cents: int


class OrderPreviewOut(BaseModel):
    """Preview response body."""

    address: AddressOut
    groups_by_shop: list[OrderPreviewGroupOut]
    grand_total_cents: int
    warnings: list[OrderPreviewWarning]


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------
class OrderCreateIn(BaseModel):
    """Create-orders payload."""

    cart_item_ids: list[int] = Field(min_length=1)
    address_id: int = Field(ge=1)
    user_note: str | None = Field(default=None, max_length=500)


class OrderCreatedItem(BaseModel):
    """One created order in the create response."""

    id: int
    order_no: str
    total_cents: int
    shop: CartShopBrief
    payment_deadline_at: datetime


class OrderCreateOut(BaseModel):
    """Create-orders response body."""

    orders: list[OrderCreatedItem]


# ---------------------------------------------------------------------------
# Item / list / detail projections
# ---------------------------------------------------------------------------
class OrderItemOut(BaseModel):
    """Order-line projection."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: int
    sku_id: int
    spu_id: int
    shop_id: int
    spu_title: str
    sku_specs: dict[str, str]
    sku_image: str | None = None
    unit_price_cents: int
    quantity: int
    subtotal_cents: int


class OrderStatusHistoryOut(BaseModel):
    """Order status-history projection."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    from_status: str | None = None
    to_status: str
    actor_type: str
    actor_id: int | None = None
    note: str | None = None
    created_at: datetime


class ShipmentEventOut(BaseModel):
    """Shipment-event projection."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    event_type: str
    description: str
    event_time: datetime


class PaymentSessionBriefOut(BaseModel):
    """Trimmed payment-session projection (no external_txn_no)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    channel: str
    amount_cents: int
    status: str
    failure_reason: str | None = None
    created_at: datetime
    completed_at: datetime | None = None


class OrderListItemOut(BaseModel):
    """Order projection for list responses (no nested items detail)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    order_no: str
    user_id: int
    shop_id: int
    shop: CartShopBrief | None = None
    status: OrderStatus
    subtotal_cents: int
    shipping_fee_cents: int
    discount_cents: int
    total_cents: int
    receiver_name: str
    receiver_phone: str
    receiver_address: str
    payment_deadline_at: datetime
    paid_at: datetime | None = None
    shipped_at: datetime | None = None
    auto_complete_at: datetime | None = None
    completed_at: datetime | None = None
    cancelled_at: datetime | None = None
    cancel_reason: CancelReason | None = None
    shipping_carrier: str | None = None
    tracking_no: str | None = None
    items: list[OrderItemOut] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class OrderDetailOut(OrderListItemOut):
    """Full order detail including timeline + shipments + payment history."""

    user_note: str | None = None
    merchant_note: str | None = None
    admin_note: str | None = None
    cancel_note: str | None = None
    status_history: list[OrderStatusHistoryOut] = Field(default_factory=list)
    shipment_events: list[ShipmentEventOut] = Field(default_factory=list)
    payment_sessions: list[PaymentSessionBriefOut] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Actions
# ---------------------------------------------------------------------------
class OrderCancelIn(BaseModel):
    """Cancel-order payload."""

    cancel_note: str | None = Field(default=None, max_length=500)


class OrderNoteIn(BaseModel):
    """Add/update note payload (merchant or admin)."""

    note: str = Field(min_length=1, max_length=500)


__all__ = [
    "OrderCancelIn",
    "OrderCreateIn",
    "OrderCreateOut",
    "OrderCreatedItem",
    "OrderDetailOut",
    "OrderItemOut",
    "OrderListItemOut",
    "OrderNoteIn",
    "OrderPreviewGroupOut",
    "OrderPreviewIn",
    "OrderPreviewOut",
    "OrderPreviewWarning",
    "OrderStatusHistoryOut",
    "PaymentSessionBriefOut",
    "ShipmentEventOut",
]
