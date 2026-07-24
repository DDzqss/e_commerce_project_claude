"""Notification ORM model — Phase 5 contract §3.4.

Cross-role in-app notifications for user / merchant / admin. Delivery
is best-effort HTTP polling (WebSocket deferred). No soft-delete —
"clear read" is a hard DELETE.
"""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntId, IdMixin, TimestampMixin


class NotificationRecipientType(enum.StrEnum):
    """Who receives the notification."""

    USER = "user"
    MERCHANT = "merchant"
    ADMIN = "admin"


class NotificationCategory(enum.StrEnum):
    """High-level bucket for filtering in the inbox UI."""

    SYSTEM = "system"
    ORDER = "order"
    AFTERSALES = "aftersales"
    REVIEW = "review"
    SHOP = "shop"
    PROMO = "promo"


class Notification(IdMixin, TimestampMixin, Base):
    """A single in-app notification row."""

    __tablename__ = "notifications"

    recipient_type: Mapped[NotificationRecipientType] = mapped_column(
        Enum(
            NotificationRecipientType,
            name="notification_recipient_type",
            native_enum=True,
            validate_strings=True,
        ),
        nullable=False,
    )
    recipient_id: Mapped[int] = mapped_column(BigIntId, nullable=False)
    category: Mapped[NotificationCategory] = mapped_column(
        Enum(
            NotificationCategory,
            name="notification_category",
            native_enum=True,
            validate_strings=True,
        ),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    action_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    related_type: Mapped[str | None] = mapped_column(String(60), nullable=True)
    related_id: Mapped[int | None] = mapped_column(BigIntId, nullable=True)

    is_read: Mapped[bool] = mapped_column(nullable=False, default=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index(
            "ix_notifications_inbox",
            "recipient_type",
            "recipient_id",
            "is_read",
            "created_at",
        ),
    )
