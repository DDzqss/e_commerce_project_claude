"""Aftersales ORM model — contract §4.1.

Represents an after-sales case attached to an order: refund-only, return-refund,
or exchange. Owns the 12-state lifecycle in contract §5.

Notes:
- Every id/FK uses ``BigIntId`` so tests on SQLite (Integer PK) still
  autoincrement while production Postgres keeps BIGSERIAL.
- The partial UNIQUE index enforcing "one active aftersales per order"
  is declared in the Alembic migration only (not on the model) — see
  AGENTS.md §11.3.
"""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntId, IdMixin, SoftDeleteMixin, TimestampMixin


class AftersalesType(enum.StrEnum):
    """Kind of aftersales case (contract §2)."""

    REFUND_ONLY = "refund_only"
    RETURN_REFUND = "return_refund"
    EXCHANGE = "exchange"


class AftersalesStatus(enum.StrEnum):
    """12-state aftersales lifecycle (contract §5)."""

    PENDING_MERCHANT_REVIEW = "pending_merchant_review"
    MERCHANT_REJECTED = "merchant_rejected"
    MERCHANT_AGREED_WAITING_RETURN = "merchant_agreed_waiting_return"
    RETURN_SHIPPED_WAITING_RECEIVE = "return_shipped_waiting_receive"
    MERCHANT_AGREED_WAITING_SHIP = "merchant_agreed_waiting_ship"
    EXCHANGE_SHIPPED_WAITING_RECEIVE = "exchange_shipped_waiting_receive"
    REFUNDING = "refunding"
    ADMIN_ARBITRATING = "admin_arbitrating"
    COMPLETED_REFUNDED = "completed_refunded"
    COMPLETED_EXCHANGED = "completed_exchanged"
    USER_CANCELLED = "user_cancelled"
    SYSTEM_CLOSED = "system_closed"


class AftersalesReasonCategory(enum.StrEnum):
    """Why the user is requesting after-sales (contract §4.1)."""

    QUALITY_ISSUE = "quality_issue"
    WRONG_ITEM = "wrong_item"
    DAMAGE_IN_TRANSIT = "damage_in_transit"
    NOT_AS_DESCRIBED = "not_as_described"
    NO_LONGER_NEEDED = "no_longer_needed"
    DUPLICATE_PURCHASE = "duplicate_purchase"
    OTHER = "other"


class AftersalesCloseReason(enum.StrEnum):
    """Why an aftersales case ended (contract §4.1)."""

    USER_CANCELLED = "user_cancelled"
    COMPLETED = "completed"
    USER_SHIP_TIMEOUT = "user_ship_timeout"
    ARBITRATION_CLOSED = "arbitration_closed"
    AUTO_CONFIRMED = "auto_confirmed"
    SYSTEM_CLOSED = "system_closed"


class AftersalesEscalationReason(enum.StrEnum):
    """Why a case was escalated to platform arbitration (contract §4.1 + §8.3 note)."""

    MERCHANT_TIMEOUT = "merchant_timeout"
    USER_APPEAL = "user_appeal"
    RISK_FLAGGED = "risk_flagged"
    MANUAL = "manual"
    MERCHANT_REFUSE_RECEIVE = "merchant_refuse_receive"


class AftersalesArbitrationOutcome(enum.StrEnum):
    """Customer-service arbitration verdict (contract §9.3)."""

    SIDE_WITH_USER = "side_with_user"
    SIDE_WITH_MERCHANT = "side_with_merchant"
    PARTIAL_REFUND = "partial_refund"
    OTHER = "other"


class Aftersales(IdMixin, TimestampMixin, SoftDeleteMixin, Base):
    """A single aftersales case bound to one order."""

    __tablename__ = "aftersales"

    # ---- identifiers -------------------------------------------------------
    aftersales_no: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    order_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("orders.id", ondelete="RESTRICT"),
        nullable=False,
    )
    user_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    shop_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("shops.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # ---- core intent -------------------------------------------------------
    type: Mapped[AftersalesType] = mapped_column(
        Enum(AftersalesType, name="aftersales_type", native_enum=True, validate_strings=True),
        nullable=False,
    )
    status: Mapped[AftersalesStatus] = mapped_column(
        Enum(
            AftersalesStatus,
            name="aftersales_status",
            native_enum=True,
            validate_strings=True,
        ),
        nullable=False,
        default=AftersalesStatus.PENDING_MERCHANT_REVIEW,
    )
    reason_category: Mapped[AftersalesReasonCategory] = mapped_column(
        Enum(
            AftersalesReasonCategory,
            name="aftersales_reason_category",
            native_enum=True,
            validate_strings=True,
        ),
        nullable=False,
    )
    reason_note: Mapped[str] = mapped_column(Text, nullable=False)

    # ---- money — refund side ----------------------------------------------
    refund_amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    actual_refund_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # ---- merchant review --------------------------------------------------
    merchant_reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    merchant_review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    merchant_review_deadline: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # ---- return logistics (RETURN_REFUND / EXCHANGE) ----------------------
    return_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    return_carrier: Mapped[str | None] = mapped_column(String(60), nullable=True)
    return_tracking_no: Mapped[str | None] = mapped_column(String(60), nullable=True)
    return_shipped_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    return_ship_deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ---- merchant receive -------------------------------------------------
    merchant_received_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    merchant_receive_deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    merchant_refuse_receive: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    merchant_refuse_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ---- exchange re-ship (EXCHANGE tail) ---------------------------------
    exchange_carrier: Mapped[str | None] = mapped_column(String(60), nullable=True)
    exchange_tracking_no: Mapped[str | None] = mapped_column(String(60), nullable=True)
    exchange_shipped_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    exchange_confirm_deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    exchange_confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ---- platform arbitration --------------------------------------------
    escalated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    escalation_reason: Mapped[AftersalesEscalationReason | None] = mapped_column(
        Enum(
            AftersalesEscalationReason,
            name="aftersales_escalation_reason",
            native_enum=True,
            validate_strings=True,
        ),
        nullable=True,
    )
    arbitrator_admin_id: Mapped[int | None] = mapped_column(
        BigIntId,
        ForeignKey("admin_users.id", ondelete="SET NULL"),
        nullable=True,
    )
    arbitrated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    arbitration_conclusion: Mapped[str | None] = mapped_column(Text, nullable=True)
    arbitration_outcome: Mapped[AftersalesArbitrationOutcome | None] = mapped_column(
        Enum(
            AftersalesArbitrationOutcome,
            name="aftersales_arbitration_outcome",
            native_enum=True,
            validate_strings=True,
        ),
        nullable=True,
    )

    # ---- refund exec ------------------------------------------------------
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    refund_txn_no: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # ---- end --------------------------------------------------------------
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    close_reason: Mapped[AftersalesCloseReason | None] = mapped_column(
        Enum(
            AftersalesCloseReason,
            name="aftersales_close_reason",
            native_enum=True,
            validate_strings=True,
        ),
        nullable=True,
    )

    # ---- nudge / appeal counters -----------------------------------------
    nudge_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_nudged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    appeal_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # NOTE: partial UNIQUE(order_id) WHERE deleted_at IS NULL AND status NOT IN
    # (<final states>) is declared only in the Alembic migration; see
    # AGENTS.md §11.3.
    __table_args__ = (
        Index("ix_aftersales_order_deleted", "order_id", "deleted_at"),
        Index("ix_aftersales_user_status_created", "user_id", "status", "created_at"),
        Index("ix_aftersales_shop_status_created", "shop_id", "status", "created_at"),
        Index("ix_aftersales_status_merchant_deadline", "status", "merchant_review_deadline"),
        Index("ix_aftersales_status_return_deadline", "status", "return_ship_deadline"),
        Index("ix_aftersales_status_receive_deadline", "status", "merchant_receive_deadline"),
        Index("ix_aftersales_status_exchange_deadline", "status", "exchange_confirm_deadline"),
        Index("ix_aftersales_status_escalated", "status", "escalated_at"),
    )
