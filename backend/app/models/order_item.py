"""Order-item ORM model — contract §3.4.

Every commerce-critical field is *snapshotted* at order time (title,
image, spec map, unit price) so post-hoc SKU edits do not rewrite
history. ``ondelete="CASCADE"`` on ``order_id`` mirrors the contract
requirement to purge items when an order is hard-deleted.
"""

from __future__ import annotations

from sqlalchemy import JSON, ForeignKey, Index, Integer, String
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntId, IdMixin, TimestampMixin


class OrderItem(IdMixin, TimestampMixin, Base):
    """One line of an order — a SKU snapshotted at checkout time."""

    __tablename__ = "order_items"

    order_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
    )
    sku_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("skus.id", ondelete="RESTRICT"),
        nullable=False,
    )
    spu_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("spus.id", ondelete="RESTRICT"),
        nullable=False,
    )
    shop_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("shops.id", ondelete="RESTRICT"),
        nullable=False,
    )
    spu_title: Mapped[str] = mapped_column(String(200), nullable=False)
    sku_specs: Mapped[dict[str, str]] = mapped_column(
        JSON().with_variant(postgresql.JSONB(), "postgresql"),
        nullable=False,
        default=dict,
    )
    sku_image: Mapped[str | None] = mapped_column(String(255), nullable=True)
    unit_price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    subtotal_cents: Mapped[int] = mapped_column(Integer, nullable=False)

    __table_args__ = (
        Index("ix_order_items_order", "order_id"),
        Index("ix_order_items_sku", "sku_id"),
        Index("ix_order_items_spu", "spu_id"),
    )
