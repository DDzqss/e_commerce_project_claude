"""Merchant-domain request/response schemas."""

from __future__ import annotations

import re

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


class ShopUpdateIn(BaseModel):
    """``PATCH /merchant/me/shop`` payload — SHOP_OWNER only."""

    description: str | None = Field(default=None, max_length=2000)
    contact_name: str | None = Field(default=None, min_length=1, max_length=60)
    contact_phone: str | None = Field(default=None, min_length=1, max_length=20)


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
    """``GET /merchant/me`` response — account + shop + perms."""

    account: MerchantAccountOut
    shop: ShopOut
    permissions: list[str]


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
    "ShopUpdateIn",
]
