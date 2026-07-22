"""Merchant application ORM model.

Tracks a user's request to become a merchant. Goes through the state
machine ``pending -> approved / rejected / withdrawn`` (see contract
§8.1). On approval the system creates a Shop + MerchantAccount and
back-fills ``approved_merchant_account_id`` in the same transaction.
"""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin


class MerchantApplicationStatus(enum.StrEnum):
    """Lifecycle status for a MerchantApplication."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class MerchantApplication(IdMixin, TimestampMixin, Base):
    """A user's application to open a merchant shop."""

    __tablename__ = "merchant_applications"

    applicant_user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    shop_name: Mapped[str] = mapped_column(String(120), nullable=False)
    contact_name: Mapped[str] = mapped_column(String(60), nullable=False)
    contact_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    business_license_no: Mapped[str] = mapped_column(String(50), nullable=False)
    business_license_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[MerchantApplicationStatus] = mapped_column(
        Enum(
            MerchantApplicationStatus,
            name="merchant_application_status",
            native_enum=True,
            validate_strings=True,
        ),
        nullable=False,
        default=MerchantApplicationStatus.PENDING,
        index=True,
    )
    reviewer_admin_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("admin_users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_merchant_account_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("merchant_accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
