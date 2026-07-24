"""Product review ORM model — Phase 5 contract §3.1.

A ``Review`` is attached to one ``order_item``. Because the partial
``UNIQUE (order_item_id) WHERE deleted_at IS NULL`` index is only
supported natively on Postgres, we declare it exclusively in the
Alembic migration (see AGENTS.md §11.3). SQLite tests rely on the
service layer to enforce the "one review per order-item" invariant.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    JSON,
    SmallInteger,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntId, IdMixin, SoftDeleteMixin, TimestampMixin


class Review(IdMixin, TimestampMixin, SoftDeleteMixin, Base):
    """A user review for one order line."""

    __tablename__ = "reviews"

    order_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("orders.id", ondelete="RESTRICT"),
        nullable=False,
    )
    order_item_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("order_items.id", ondelete="RESTRICT"),
        nullable=False,
    )
    user_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    spu_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("spus.id", ondelete="RESTRICT"),
        nullable=False,
    )
    sku_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("skus.id", ondelete="RESTRICT"),
        nullable=False,
    )
    shop_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("shops.id", ondelete="RESTRICT"),
        nullable=False,
    )

    rating: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    content: Mapped[str] = mapped_column(String(2000), nullable=False)
    images: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    is_anonymous: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    hidden_by_admin_id: Mapped[int | None] = mapped_column(
        BigIntId,
        ForeignKey("admin_users.id", ondelete="SET NULL"),
        nullable=True,
    )
    hidden_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    hidden_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    edit_count: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    edit_deadline_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_reviews_rating_range"),
        Index("ix_reviews_spu_visible_created", "spu_id", "visible", "created_at"),
        Index("ix_reviews_shop_visible_created", "shop_id", "visible", "created_at"),
        Index("ix_reviews_user_created", "user_id", "created_at"),
        # Note: partial UNIQUE(order_item_id) WHERE deleted_at IS NULL
        # is declared only in Alembic 0005.
    )
