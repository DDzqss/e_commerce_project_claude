"""Aftersales status-history ORM model — contract §4.3.

Append-only trail rendered as the aftersales timeline on user / merchant
/ admin detail pages. First row for a case has ``from_status = NULL``.
"""

from __future__ import annotations

import enum

from sqlalchemy import Enum, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntId, IdMixin, TimestampMixin


class AftersalesActorType(enum.StrEnum):
    """Actor that produced an aftersales status transition."""

    USER = "user"
    MERCHANT = "merchant"
    ADMIN = "admin"
    SYSTEM = "system"


class AftersalesStatusHistory(IdMixin, TimestampMixin, Base):
    """One recorded aftersales-status transition."""

    __tablename__ = "aftersales_status_history"

    aftersales_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("aftersales.id", ondelete="CASCADE"),
        nullable=False,
    )
    from_status: Mapped[str | None] = mapped_column(String(48), nullable=True)
    to_status: Mapped[str] = mapped_column(String(48), nullable=False)
    actor_type: Mapped[AftersalesActorType] = mapped_column(
        Enum(
            AftersalesActorType,
            name="aftersales_actor_type",
            native_enum=True,
            validate_strings=True,
        ),
        nullable=False,
    )
    actor_id: Mapped[int | None] = mapped_column(BigIntId, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index(
            "ix_aftersales_status_history_case_created",
            "aftersales_id",
            "created_at",
        ),
    )
