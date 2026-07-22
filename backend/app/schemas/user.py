"""User-facing schemas (profile / self-service)."""

from __future__ import annotations

import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.user import UserStatus

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


class UserOut(BaseModel):
    """Full user profile projection."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    phone: str | None = None
    email: str | None = None
    nickname: str
    avatar_url: str | None = None
    status: UserStatus


class UserMeOut(BaseModel):
    """``GET /user/me`` response body (user + merchant/apply context)."""

    user: UserOut
    merchant_account_ids: list[int] = Field(default_factory=list)
    pending_application_id: int | None = None


class UserUpdateIn(BaseModel):
    """``PATCH /user/me`` — updatable profile fields."""

    nickname: str | None = Field(default=None, min_length=1, max_length=60)
    avatar_url: str | None = Field(default=None, max_length=255)


class ChangePasswordIn(BaseModel):
    """``POST /user/me/change-password`` payload."""

    old_password: str = Field(min_length=1, max_length=64)
    new_password: str = Field(min_length=8, max_length=64)

    @field_validator("new_password")
    @classmethod
    def _check_password(cls, v: str) -> str:
        return _validate_password_strength(v)


__all__ = [
    "ChangePasswordIn",
    "UserMeOut",
    "UserOut",
    "UserUpdateIn",
]
