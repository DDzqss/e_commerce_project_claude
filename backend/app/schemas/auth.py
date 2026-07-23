"""Auth-domain request/response schemas (user + shared)."""

from __future__ import annotations

import re
from typing import Self

from pydantic import BaseModel, Field, field_validator, model_validator

_PHONE_RE = re.compile(r"^1[3-9]\d{9}$")  # China mobile
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_PASSWORD_RE_ALPHA = re.compile(r"[A-Za-z]")
_PASSWORD_RE_DIGIT = re.compile(r"\d")


def _validate_password_strength(value: str) -> str:
    """Contract policy: 8-64 chars, at least 1 letter + 1 digit."""
    if not (8 <= len(value) <= 64):
        raise ValueError("password must be 8-64 characters")
    if not _PASSWORD_RE_ALPHA.search(value):
        raise ValueError("password must contain at least one letter")
    if not _PASSWORD_RE_DIGIT.search(value):
        raise ValueError("password must contain at least one digit")
    return value


class UserRegisterIn(BaseModel):
    """User registration payload — phone OR email required."""

    phone: str | None = Field(default=None, description="Chinese 11-digit mobile")
    email: str | None = Field(default=None, max_length=120)
    password: str = Field(min_length=8, max_length=64)
    nickname: str | None = Field(default=None, max_length=60)

    @field_validator("phone")
    @classmethod
    def _check_phone(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not _PHONE_RE.match(v):
            raise ValueError("phone must be a valid Chinese 11-digit mobile")
        return v

    @field_validator("email")
    @classmethod
    def _check_email(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not _EMAIL_RE.match(v):
            raise ValueError("email is not a valid address")
        return v.lower()

    @field_validator("password")
    @classmethod
    def _check_password(cls, v: str) -> str:
        return _validate_password_strength(v)

    @model_validator(mode="after")
    def _phone_or_email_required(self) -> Self:
        if self.phone is None and self.email is None:
            raise ValueError("phone or email is required")
        return self


class UserLoginIn(BaseModel):
    """User login payload — identifier is either phone or email."""

    identifier: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=64)


class RefreshIn(BaseModel):
    """Refresh-token exchange payload."""

    refresh_token: str = Field(min_length=1, max_length=128)


class LogoutIn(BaseModel):
    """Optional logout payload — if refresh token supplied it is revoked."""

    refresh_token: str | None = Field(default=None, max_length=128)


class ForgotPasswordIn(BaseModel):
    """Kick off the forgot-password flow via phone/email identifier."""

    identifier: str = Field(min_length=1, max_length=120)


class ResetPasswordIn(BaseModel):
    """Complete the forgot-password flow with the verification code."""

    identifier: str = Field(min_length=1, max_length=120)
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    new_password: str = Field(min_length=8, max_length=64)

    @field_validator("new_password")
    @classmethod
    def _check_password(cls, v: str) -> str:
        return _validate_password_strength(v)


class UserBrief(BaseModel):
    """Compact user projection embedded in token responses."""

    id: int
    phone: str | None = None
    email: str | None = None
    nickname: str
    avatar_url: str | None = None


class TokenPairOut(BaseModel):
    """Access + refresh token pair returned by login / register / refresh."""

    access_token: str
    refresh_token: str
    expires_in: int = Field(description="Access token TTL in seconds")


class UserAuthOut(TokenPairOut):
    """Response body for user register/login: token pair + user brief."""

    user: UserBrief


__all__ = [
    "ForgotPasswordIn",
    "LogoutIn",
    "RefreshIn",
    "ResetPasswordIn",
    "TokenPairOut",
    "UserAuthOut",
    "UserBrief",
    "UserLoginIn",
    "UserRegisterIn",
]
