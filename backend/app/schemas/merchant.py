"""Merchant-domain request/response schemas."""

from __future__ import annotations

import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.merchant import MerchantAccountStatus, MerchantRole, ShopStatus

_PASSWORD_RE_ALPHA = re.compile(r"[A-Za-z]")
_PASSWORD_RE_DIGIT = re.compile(r"\d")


def _validate_password_strength(value: str) -> str:
    if not (8 <= len(value) <= 64):
        raise ValueError("password must be 8-64 characters")
    if not _PASSWORD_RE_ALPHA.search(value):
        raise ValueError("password must contain at least one letter")
    if not _PASSWORD_RE_DIGIT.search(value):
        raise ValueError("password must contain at least one digit")
    return value


class MerchantLoginIn(BaseModel):
    """Merchant login: uses ``login_name`` (not phone/email)."""

    login_name: str = Field(min_length=1, max_length=60)
    password: str = Field(min_length=1, max_length=64)


class MerchantChangePasswordIn(BaseModel):
    """Merchant change-password payload."""

    old_password: str = Field(min_length=1, max_length=64)
    new_password: str = Field(min_length=8, max_length=64)

    @field_validator("new_password")
    @classmethod
    def _check_password(cls, v: str) -> str:
        return _validate_password_strength(v)


class ShopOut(BaseModel):
    """Shop projection."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    contact_name: str
    contact_phone: str
    status: ShopStatus
    # Phase 5 additions
    logo_url: str | None = None
    banner_url: str | None = None
    announcement: str | None = None
    opened_at: datetime | None = None
    rating_avg: float = 5.0
    rating_count: int = 0
    sales_count: int = 0

    @field_validator("rating_avg", mode="before")
    @classmethod
    def _rating_to_float(cls, v: object) -> float:
        # Numeric(3,2) comes back as Decimal — coerce to float for JSON.
        if v is None:
            return 5.0
        return float(v)  # type: ignore[arg-type]


class ShopUpdateIn(BaseModel):
    """``PATCH /merchant/me/shop`` payload — SHOP_OWNER only."""

    description: str | None = Field(default=None, max_length=2000)
    contact_name: str | None = Field(default=None, min_length=1, max_length=60)
    contact_phone: str | None = Field(default=None, min_length=1, max_length=20)
    # Phase 5 profile fields
    logo_url: str | None = Field(default=None, max_length=255)
    banner_url: str | None = Field(default=None, max_length=255)
    announcement: str | None = Field(default=None, max_length=2000)


class ShopPublicOut(BaseModel):
    """Public storefront projection (contract §9.1)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    logo_url: str | None = None
    banner_url: str | None = None
    announcement: str | None = None
    opened_at: datetime | None = None
    rating_avg: float = 5.0
    rating_count: int = 0
    sales_count: int = 0
    contact_name: str
    contact_phone: str  # already masked by the service layer
    status: ShopStatus

    @field_validator("rating_avg", mode="before")
    @classmethod
    def _rating_to_float(cls, v: object) -> float:
        if v is None:
            return 5.0
        return float(v)  # type: ignore[arg-type]


class MerchantAccountOut(BaseModel):
    """Merchant account projection."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    login_name: str
    shop_id: int
    role: MerchantRole
    status: MerchantAccountStatus


class MerchantMeOut(BaseModel):
    """``GET /merchant/me`` response — merchant account + shop + perms."""

    model_config = ConfigDict(populate_by_name=True)

    merchant_account: MerchantAccountOut = Field(alias="account")
    shop: ShopOut
    permissions: list[str]

    @property
    def account(self) -> MerchantAccountOut:
        """Backward-compatible Python attribute for existing service code."""
        return self.merchant_account


class MerchantAccountWithPasswordOut(MerchantAccountOut):
    """Special projection returned once on approval — carries the
    system-generated initial password so the reviewing admin can pass
    it to the applicant (Phase 1 simplification, contract §8.1).
    """

    initial_password: str


__all__ = [
    "MerchantAccountOut",
    "MerchantAccountWithPasswordOut",
    "MerchantChangePasswordIn",
    "MerchantLoginIn",
    "MerchantMeOut",
    "ShopOut",
    "ShopPublicOut",
    "ShopUpdateIn",
]
