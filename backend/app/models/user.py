"""User (consumer) ORM model.

Represents an end consumer of the platform. Login credential is
phone-or-email (at least one required, enforced via CHECK constraint).
Password is stored bcrypt-hashed.
"""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, SoftDeleteMixin, TimestampMixin


class UserStatus(enum.StrEnum):
    """Lifecycle status for a User account."""

    ACTIVE = "active"
    DISABLED = "disabled"


class User(IdMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Consumer-side end-user account."""

    __tablename__ = "users"

    phone: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)
    email: Mapped[str | None] = mapped_column(String(120), unique=True, nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    nickname: Mapped[str] = mapped_column(String(60), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus, name="user_status", native_enum=True, validate_strings=True),
        nullable=False,
        default=UserStatus.ACTIVE,
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "(phone IS NOT NULL) OR (email IS NOT NULL)",
            name="ck_users_phone_or_email_required",
        ),
    )
