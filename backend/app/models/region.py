"""Region (省 / 市 / 区) ORM model — Phase 5 contract §3.5.

Natural key: GB/T 2260 行政区划码 (VARCHAR(12) to leave room for
future 12-digit codes; standard codes are 6 digits with trailing zeros).
No auto-id — the code IS the primary key.
"""

from __future__ import annotations

from sqlalchemy import ForeignKey, Index, Integer, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Region(Base):
    """A single administrative-division row."""

    __tablename__ = "regions"

    code: Mapped[str] = mapped_column(String(12), primary_key=True)
    parent_code: Mapped[str | None] = mapped_column(
        String(12),
        ForeignKey("regions.code", ondelete="RESTRICT"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    short_name: Mapped[str | None] = mapped_column(String(20), nullable=True)
    level: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (
        Index("ix_regions_parent", "parent_code"),
        Index("ix_regions_level", "level"),
    )
