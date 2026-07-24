"""InventoryLog ORM model — append-only stock movement audit trail.

Contract §3.5 / §10. Rows are inserted whenever ``skus.stock`` changes;
this table is *only ever written to*, never updated or deleted.
"""

from __future__ import annotations

import enum

from sqlalchemy import Enum, ForeignKey, Index, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntId, IdMixin, TimestampMixin


class InventoryReason(enum.StrEnum):
    """Business reason for a stock movement."""

    PURCHASE = "purchase"
    SALE = "sale"
    REFUND_RETURN = "refund_return"
    ADJUST = "adjust"
    INITIAL = "initial"


class InventoryOperatorType(enum.StrEnum):
    """Kind of actor that produced the stock movement."""

    MERCHANT = "merchant"
    ADMIN = "admin"
    SYSTEM = "system"


class InventoryLog(IdMixin, TimestampMixin, Base):
    """Immutable stock-movement record."""

    __tablename__ = "inventory_logs"

    sku_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("skus.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    delta: Mapped[int] = mapped_column(Integer, nullable=False)
    balance_after: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[InventoryReason] = mapped_column(
        Enum(
            InventoryReason,
            name="inventory_reason",
            native_enum=True,
            validate_strings=True,
        ),
        nullable=False,
    )
    operator_type: Mapped[InventoryOperatorType] = mapped_column(
        Enum(
            InventoryOperatorType,
            name="inventory_operator_type",
            native_enum=True,
            validate_strings=True,
        ),
        nullable=False,
    )
    operator_id: Mapped[int | None] = mapped_column(BigIntId, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    related_order_id: Mapped[int | None] = mapped_column(BigIntId, nullable=True)

    __table_args__ = (Index("ix_inventory_logs_sku_created", "sku_id", "created_at"),)
