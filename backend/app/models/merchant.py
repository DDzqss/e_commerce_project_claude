"""Merchant-side ORM models: Shop and MerchantAccount.

A Shop is created when an Admin approves a merchant application.
A MerchantAccount is a login-capable identity bound to exactly one Shop
(Phase 1 simplification — later phases may add multiple accounts per
shop with distinct roles).
"""

from __future__ import annotations

import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntId, IdMixin, SoftDeleteMixin, TimestampMixin


class ShopStatus(enum.StrEnum):
    """Lifecycle status for a Shop."""

    ACTIVE = "active"
    FROZEN = "frozen"


class MerchantAccountStatus(enum.StrEnum):
    """Lifecycle status for a MerchantAccount login."""

    ACTIVE = "active"
    FROZEN = "frozen"


class MerchantRole(enum.StrEnum):
    """Role of a MerchantAccount within its Shop."""

    SHOP_OWNER = "SHOP_OWNER"
    SHOP_OPERATOR = "SHOP_OPERATOR"
    SHOP_SUPPORT = "SHOP_SUPPORT"


class Shop(IdMixin, TimestampMixin, SoftDeleteMixin, Base):
    """A merchant storefront (created upon application approval)."""

    __tablename__ = "shops"

    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    contact_name: Mapped[str] = mapped_column(String(60), nullable=False)
    contact_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[ShopStatus] = mapped_column(
        Enum(ShopStatus, name="shop_status", native_enum=True, validate_strings=True),
        nullable=False,
        default=ShopStatus.ACTIVE,
    )

    # Phase 5 — storefront profile enhancements.
    logo_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    banner_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    announcement: Mapped[str | None] = mapped_column(Text, nullable=True)
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rating_avg: Mapped[Decimal] = mapped_column(
        Numeric(3, 2),
        nullable=False,
        default=Decimal("5.00"),
        server_default="5.00",
    )
    rating_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    sales_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")


class MerchantAccount(IdMixin, TimestampMixin, SoftDeleteMixin, Base):
    """A login-capable merchant identity bound to a Shop."""

    __tablename__ = "merchant_accounts"

    user_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    login_name: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    shop_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("shops.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    role: Mapped[MerchantRole] = mapped_column(
        Enum(MerchantRole, name="merchant_role", native_enum=True, validate_strings=True),
        nullable=False,
    )
    status: Mapped[MerchantAccountStatus] = mapped_column(
        Enum(
            MerchantAccountStatus,
            name="merchant_account_status",
            native_enum=True,
            validate_strings=True,
        ),
        nullable=False,
        default=MerchantAccountStatus.ACTIVE,
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "shop_id", name="uq_merchant_accounts_user_shop"),
    )
