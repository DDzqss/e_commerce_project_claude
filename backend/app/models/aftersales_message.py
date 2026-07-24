"""Aftersales message ORM model — contract §4.5.

Phase 4 keeps this deliberately narrow: nudge notes, appeal notes,
system notices, and admin replies. Full-fledged real-time chat is
deferred to a later phase.
"""

from __future__ import annotations

import enum

from sqlalchemy import Enum, ForeignKey, Index, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntId, IdMixin, TimestampMixin


class AftersalesMessageSenderType(enum.StrEnum):
    """Who sent the message."""

    USER = "user"
    MERCHANT = "merchant"
    ADMIN = "admin"
    SYSTEM = "system"


class AftersalesMessageKind(enum.StrEnum):
    """What sort of message this is (contract §4.5)."""

    NUDGE = "nudge"
    APPEAL = "appeal"
    REPLY = "reply"
    SYSTEM_NOTICE = "system_notice"


class AftersalesMessage(IdMixin, TimestampMixin, Base):
    """A single message row on an aftersales case."""

    __tablename__ = "aftersales_messages"

    aftersales_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("aftersales.id", ondelete="CASCADE"),
        nullable=False,
    )
    sender_type: Mapped[AftersalesMessageSenderType] = mapped_column(
        Enum(
            AftersalesMessageSenderType,
            name="aftersales_message_sender_type",
            native_enum=True,
            validate_strings=True,
        ),
        nullable=False,
    )
    sender_id: Mapped[int | None] = mapped_column(BigIntId, nullable=True)
    kind: Mapped[AftersalesMessageKind] = mapped_column(
        Enum(
            AftersalesMessageKind,
            name="aftersales_message_kind",
            native_enum=True,
            validate_strings=True,
        ),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (Index("ix_aftersales_messages_case_created", "aftersales_id", "created_at"),)
