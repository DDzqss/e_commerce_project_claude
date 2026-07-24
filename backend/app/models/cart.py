"""Cart item ORM model — contract §3.2.

Single-table cart: one row per (user_id, sku_id) pair. Adding the same
SKU again increments ``quantity`` rather than creating a new row.
"""

from __future__ import annotations

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntId, IdMixin, TimestampMixin


class CartItem(IdMixin, TimestampMixin, Base):
    """One cart line = one user's cart entry for one SKU."""

    __tablename__ = "cart_items"

    user_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    sku_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("skus.id", ondelete="RESTRICT"),
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    selected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        UniqueConstraint("user_id", "sku_id", name="uq_cart_items_user_sku"),
        CheckConstraint(
            "quantity >= 1 AND quantity <= 999",
            name="ck_cart_items_quantity_range",
        ),
        Index("ix_cart_items_user", "user_id"),
    )
