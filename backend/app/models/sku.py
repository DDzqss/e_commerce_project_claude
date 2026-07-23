"""SKU (Stock Keeping Unit) ORM model — contract §3.4.

Each SKU is a concrete purchasable variant of a SPU (e.g. specific
color + size combination). Price and stock live at the SKU level.
"""

from __future__ import annotations

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntId, IdMixin, SoftDeleteMixin, TimestampMixin


class SKU(IdMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Concrete purchasable variant of a SPU."""

    __tablename__ = "skus"

    spu_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("spus.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    sku_code: Mapped[str] = mapped_column(String(60), nullable=False)
    specs: Mapped[dict[str, str]] = mapped_column(JSON, nullable=False, default=dict)
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    original_price_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stock: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    locked_stock: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sold_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    image: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        UniqueConstraint("spu_id", "sku_code", name="uq_skus_spu_code"),
        CheckConstraint("price_cents > 0", name="ck_skus_price_positive"),
        CheckConstraint("stock >= 0", name="ck_skus_stock_non_negative"),
        CheckConstraint(
            "locked_stock >= 0",
            name="ck_skus_locked_stock_non_negative",
        ),
        Index("ix_skus_spu_active", "spu_id", "is_active"),
    )
