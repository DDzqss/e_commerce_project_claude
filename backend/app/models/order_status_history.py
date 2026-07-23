"""Order status-history ORM model — contract §3.5.

Append-only. Rendered as the "order timeline" on user/merchant/admin
detail pages. First row for an order has ``from_status = NULL``.
"""

from __future__ import annotations

import enum

from sqlalchemy import Enum, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntId, IdMixin, TimestampMixin


class ActorType(enum.StrEnum):
    """Kind of actor that produced a status transition."""

    USER = "user"
    MERCHANT = "merchant"
    ADMIN = "admin"
    SYSTEM = "system"


class OrderStatusHistory(IdMixin, TimestampMixin, Base):
    """One recorded order-status transition."""

    __tablename__ = "order_status_history"

    order_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
    )
    from_status: Mapped[str | None] = mapped_column(String(24), nullable=True)
    to_status: Mapped[str] = mapped_column(String(24), nullable=False)
    actor_type: Mapped[ActorType] = mapped_column(
        Enum(ActorType, name="order_status_actor_type", native_enum=True, validate_strings=True),
        nullable=False,
    )
    actor_id: Mapped[int | None] = mapped_column(BigIntId, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (Index("ix_order_status_history_order_created", "order_id", "created_at"),)
