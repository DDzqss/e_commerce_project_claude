"""Payment session ORM model — contract §3.6.

Phase 3 does not integrate a real payment gateway; sessions are opened
when a user clicks "pay" and closed when the user manually presses
"mock-succeed" / "mock-fail" on the simulated payment page.

The ``UNIQUE(order_id) WHERE status = 'pending'`` partial index enforces
"an order can only have one open payment session at a time" — declared
via ``postgresql_where``; the service layer enforces it on SQLite.
"""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntId, IdMixin, TimestampMixin


class PaymentChannel(enum.StrEnum):
    """Simulated payment channels (contract §3.6)."""

    MOCK_ALIPAY = "mock_alipay"
    MOCK_WECHAT = "mock_wechat"
    MOCK_BANK = "mock_bank"


class PaymentStatus(enum.StrEnum):
    """Payment session lifecycle."""

    PENDING = "pending"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    EXPIRED = "expired"


class PaymentSession(IdMixin, TimestampMixin, Base):
    """A single (potentially unsuccessful) payment attempt."""

    __tablename__ = "payment_sessions"

    order_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
    )
    channel: Mapped[PaymentChannel] = mapped_column(
        Enum(PaymentChannel, name="payment_channel", native_enum=True, validate_strings=True),
        nullable=False,
    )
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="payment_status", native_enum=True, validate_strings=True),
        nullable=False,
        default=PaymentStatus.PENDING,
    )
    external_txn_no: Mapped[str | None] = mapped_column(String(64), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(String(200), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_payment_sessions_order", "order_id"),
        # Partial UNIQUE(order_id) WHERE status='pending' is applied by
        # the Alembic migration only — see docs on ``addresses`` for
        # why it isn't declared here.
    )
