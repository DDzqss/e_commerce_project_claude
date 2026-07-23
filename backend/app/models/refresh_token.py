"""RefreshToken ORM model.

Refresh tokens are opaque random strings; we persist the SHA-256 hash
(never the plaintext) so a database leak cannot be used to hijack
sessions. Each row supports all three identity domains via
``subject_type`` + ``subject_id``.
"""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntId, IdMixin


class SubjectType(enum.StrEnum):
    """Identity domain a refresh token belongs to."""

    USER = "user"
    MERCHANT = "merchant"
    ADMIN = "admin"


class RefreshToken(IdMixin, Base):
    """Opaque refresh-token record (stored as SHA-256 hash)."""

    __tablename__ = "refresh_tokens"

    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    subject_type: Mapped[SubjectType] = mapped_column(
        Enum(
            SubjectType, name="refresh_token_subject_type", native_enum=True, validate_strings=True
        ),
        nullable=False,
    )
    subject_id: Mapped[int] = mapped_column(BigIntId, nullable=False)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # NOTE: Store IP as text for portability across SQLite (tests) and Postgres.
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)

    __table_args__ = (Index("ix_refresh_tokens_subject", "subject_type", "subject_id"),)
