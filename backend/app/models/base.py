"""SQLAlchemy declarative base and reusable column mixins.

Per DEVELOPMENT_PLAN §9, every table must carry ``id``, ``created_at``,
``updated_at``, and ``deleted_at`` (soft delete). Compose the mixins
below to enforce that convention consistently.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Integer, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# BigInteger auto-increments natively in Postgres (via BIGSERIAL/IDENTITY) but
# NOT in SQLite (which only auto-increments INTEGER PRIMARY KEY). To keep prod
# on BIGINT while allowing SQLite-based tests, use a variant.
BigIntId = BigInteger().with_variant(Integer, "sqlite")


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


class IdMixin:
    """Auto-increment ``BIGINT`` primary key named ``id``."""

    id: Mapped[int] = mapped_column(
        BigIntId,
        primary_key=True,
        autoincrement=True,
        sort_order=-100,
    )


class TimestampMixin:
    """``created_at`` / ``updated_at`` maintained by the DB."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        sort_order=100,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        sort_order=101,
    )


class SoftDeleteMixin:
    """Nullable ``deleted_at`` timestamp for soft-delete pattern.

    Repositories are expected to filter ``deleted_at IS NULL`` by
    default and only include soft-deleted rows on explicit request.
    """

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
        sort_order=102,
    )
