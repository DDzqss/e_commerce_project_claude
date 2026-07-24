"""User address-book ORM model — contract §3.1.

Each user may have up to 20 addresses (application-layer cap) and at most
one default. The default constraint is enforced by a *partial* unique
index on ``(user_id) WHERE is_default = TRUE AND deleted_at IS NULL`` —
declared as ``postgresql_where``; the SQLite test DB relies on the
service layer to enforce the same invariant.
"""

from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntId, IdMixin, SoftDeleteMixin, TimestampMixin


class Address(IdMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Consumer shipping address."""

    __tablename__ = "addresses"

    user_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    receiver_name: Mapped[str] = mapped_column(String(60), nullable=False)
    receiver_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    province: Mapped[str] = mapped_column(String(40), nullable=False)
    city: Mapped[str] = mapped_column(String(40), nullable=False)
    district: Mapped[str] = mapped_column(String(40), nullable=False)
    detail: Mapped[str] = mapped_column(String(200), nullable=False)
    postal_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Phase 5 — optional region-code linkage (province/city/district).
    # Old rows keep NULL; new writes populate the codes for FE cascade UI.
    province_code: Mapped[str | None] = mapped_column(String(12), nullable=True)
    city_code: Mapped[str | None] = mapped_column(String(12), nullable=True)
    district_code: Mapped[str | None] = mapped_column(String(12), nullable=True)

    __table_args__ = (
        Index("ix_addresses_user_deleted", "user_id", "deleted_at"),
        # Note: partial UNIQUE(user_id) WHERE is_default AND deleted_at IS NULL
        # is created directly by the Alembic migration via ``op.execute``.
        # We do NOT declare it at the model level because
        # ``Base.metadata.create_all`` used by SQLite tests would render it
        # as a *full* unique index, breaking the "one default at a time"
        # semantics. The service layer enforces the invariant too.
    )
