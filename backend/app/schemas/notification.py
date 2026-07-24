"""Notification schemas — Phase 5 contract §6."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.notification import NotificationCategory, NotificationRecipientType


class NotificationOut(BaseModel):
    """A single in-app notification projection."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    recipient_type: NotificationRecipientType
    recipient_id: int
    category: NotificationCategory
    title: str
    body: str
    action_url: str | None = None
    related_type: str | None = None
    related_id: int | None = None
    is_read: bool
    read_at: datetime | None = None
    created_at: datetime


class NotificationListOut(BaseModel):
    items: list[NotificationOut]
    total: int
    page: int
    size: int
    unread_total: int


class UnreadCountOut(BaseModel):
    count: int


__all__ = [
    "NotificationListOut",
    "NotificationOut",
    "UnreadCountOut",
]
