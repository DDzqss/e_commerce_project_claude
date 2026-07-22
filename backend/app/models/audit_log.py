"""AuditLog ORM model.

Append-only audit trail for security-sensitive events (logins, password
changes, merchant application submissions/reviews). Phase 1 only writes
records — no query UI is exposed yet.
"""

from __future__ import annotations

import enum

from sqlalchemy import JSON, BigInteger, Enum, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin


class AuditActorType(enum.StrEnum):
    """Kind of actor that produced an audit event."""

    USER = "user"
    MERCHANT = "merchant"
    ADMIN = "admin"
    SYSTEM = "system"
    ANONYMOUS = "anonymous"


class AuditLog(IdMixin, TimestampMixin, Base):
    """Append-only record of a security-relevant event."""

    __tablename__ = "audit_logs"

    actor_type: Mapped[AuditActorType] = mapped_column(
        Enum(
            AuditActorType,
            name="audit_actor_type",
            native_enum=True,
            validate_strings=True,
        ),
        nullable=False,
    )
    actor_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    target_type: Mapped[str | None] = mapped_column(String(60), nullable=True)
    target_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Portable JSON column — Postgres will materialize as JSONB via
    # dialect defaults if the operator prefers; JSON is chosen so that
    # SQLite (used in tests) works identically.
    extra: Mapped[dict[str, object] | None] = mapped_column(JSON, nullable=True)

    __table_args__ = (
        Index("ix_audit_logs_actor", "actor_type", "actor_id"),
        Index("ix_audit_logs_action", "action"),
    )
