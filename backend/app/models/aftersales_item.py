"""Aftersales item ORM model — contract §4.2.

Line items covered by an aftersales case. Enables partial refunds
against specific order lines within the same order.
"""

from __future__ import annotations

from sqlalchemy import ForeignKey, Index, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntId, IdMixin, TimestampMixin


class AftersalesItem(IdMixin, TimestampMixin, Base):
    """One order-item covered by an aftersales case."""

    __tablename__ = "aftersales_items"

    aftersales_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("aftersales.id", ondelete="CASCADE"),
        nullable=False,
    )
    order_item_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("order_items.id", ondelete="RESTRICT"),
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    refund_amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)

    __table_args__ = (
        UniqueConstraint("aftersales_id", "order_item_id", name="uq_aftersales_items_row"),
        Index("ix_aftersales_items_aftersales", "aftersales_id"),
    )
