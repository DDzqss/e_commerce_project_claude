"""Order ORM model — contract §3.3.

Each order belongs to exactly one shop; multi-shop carts fan out into
one ``Order`` per shop at checkout time. The state machine and status
transition rules are defined in contract §4.
"""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntId, IdMixin, TimestampMixin


class OrderStatus(enum.StrEnum):
    """Order lifecycle status (contract §4)."""

    PENDING_PAYMENT = "pending_payment"
    PAID = "paid"
    SHIPPED = "shipped"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    CLOSED = "closed"


class CancelReason(enum.StrEnum):
    """Why an order was cancelled (contract §3.3)."""

    USER_CANCEL = "user_cancel"
    PAYMENT_TIMEOUT = "payment_timeout"
    MERCHANT_CANCEL = "merchant_cancel"
    ADMIN_INTERVENE = "admin_intervene"
    OUT_OF_STOCK = "out_of_stock"


class Order(IdMixin, TimestampMixin, Base):
    """A single-shop order created at checkout."""

    __tablename__ = "orders"

    order_no: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    user_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    shop_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("shops.id", ondelete="RESTRICT"),
        nullable=False,
    )
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, name="order_status", native_enum=True, validate_strings=True),
        nullable=False,
        default=OrderStatus.PENDING_PAYMENT,
    )

    # money — everything stored in cents
    subtotal_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    shipping_fee_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    discount_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_cents: Mapped[int] = mapped_column(Integer, nullable=False)

    # receiver snapshot (defensive against later address edits)
    receiver_name: Mapped[str] = mapped_column(String(60), nullable=False)
    receiver_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    receiver_address: Mapped[str] = mapped_column(String(400), nullable=False)

    # notes (three separate visibility layers)
    user_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    merchant_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    admin_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # lifecycle timestamps + deadlines
    payment_deadline_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    shipped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    auto_complete_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # cancel context
    cancel_reason: Mapped[CancelReason | None] = mapped_column(
        Enum(CancelReason, name="cancel_reason", native_enum=True, validate_strings=True),
        nullable=True,
    )
    cancel_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # shipping (filled by merchant at ship time)
    shipping_carrier: Mapped[str | None] = mapped_column(String(60), nullable=True)
    tracking_no: Mapped[str | None] = mapped_column(String(60), nullable=True)

    # idempotency for POST /user/orders — UNIQUE(user_id, key)
    idempotency_key: Mapped[str | None] = mapped_column(String(120), nullable=True)

    # Phase 4 · aftersales side-links. Set from the aftersales service
    # when a refund completes.
    has_partial_refund: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    total_refunded_cents: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )

    __table_args__ = (
        Index("ix_orders_user_created", "user_id", "created_at"),
        Index("ix_orders_shop_status_created", "shop_id", "status", "created_at"),
        Index("ix_orders_status_payment_deadline", "status", "payment_deadline_at"),
        Index("ix_orders_status_auto_complete", "status", "auto_complete_at"),
        # Phase 7 · covers list_by_user with status filter (very common in UI).
        Index("ix_orders_user_status_created", "user_id", "status", "created_at"),
        UniqueConstraint(
            "user_id",
            "idempotency_key",
            name="uq_orders_user_idempotency",
        ),
    )
