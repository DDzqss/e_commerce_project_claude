"""SPU (Standard Product Unit) ORM model — contract §3.3.

Aggregates one or more concrete SKUs and holds all catalogue-visible
merchandising data (title, images, description, spec axes). The status
lifecycle is defined in contract §4.
"""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import (
    JSON,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntId, IdMixin, SoftDeleteMixin, TimestampMixin


class SPUStatus(enum.StrEnum):
    """SPU lifecycle status (contract §4)."""

    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    OFF_SHELF = "off_shelf"


class SPU(IdMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Standard Product Unit — an item at the merchandising level."""

    __tablename__ = "spus"

    shop_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("shops.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    category_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("categories.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    brand_id: Mapped[int | None] = mapped_column(
        BigIntId,
        ForeignKey("brands.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    subtitle: Mapped[str | None] = mapped_column(String(200), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    main_image: Mapped[str] = mapped_column(String(255), nullable=False)
    # Portable JSON so SQLite tests work (Postgres migration uses JSONB).
    images: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    spec_axes: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    status: Mapped[SPUStatus] = mapped_column(
        Enum(SPUStatus, name="spu_status", native_enum=True, validate_strings=True),
        nullable=False,
        default=SPUStatus.DRAFT,
    )
    reviewer_admin_id: Mapped[int | None] = mapped_column(
        BigIntId,
        ForeignKey("admin_users.id", ondelete="SET NULL"),
        nullable=True,
    )
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sales_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    view_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    min_price_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_price_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_spus_shop_status", "shop_id", "status"),
        Index("ix_spus_category_status", "category_id", "status"),
        Index("ix_spus_brand_status", "brand_id", "status"),
        Index("ix_spus_status_published", "status", "published_at"),
    )
