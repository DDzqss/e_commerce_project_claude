"""Category ORM model — hierarchical product taxonomy (max 3 levels).

Contract §3.1. Level and path are computed by the service layer on
create/update so query-time subtree lookups can use
``path LIKE 'parent_path/%'`` or an ID-set IN query.
"""

from __future__ import annotations

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntId, IdMixin, SoftDeleteMixin, TimestampMixin


class Category(IdMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Hierarchical product category (max 3 levels)."""

    __tablename__ = "categories"

    parent_id: Mapped[int | None] = mapped_column(
        BigIntId,
        ForeignKey("categories.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    slug: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    level: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    path: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    icon_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        CheckConstraint(
            "level BETWEEN 1 AND 3",
            name="ck_categories_level_range",
        ),
        CheckConstraint(
            "(parent_id IS NULL AND level = 1) OR (parent_id IS NOT NULL AND level > 1)",
            name="ck_categories_parent_level_consistent",
        ),
        Index("ix_categories_parent_sort", "parent_id", "sort_order"),
    )
