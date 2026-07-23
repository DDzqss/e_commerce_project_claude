"""Address-book schemas — contract §6."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

_PHONE_LEN_MIN = 6
_PHONE_LEN_MAX = 20


class AddressOut(BaseModel):
    """Address projection."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    receiver_name: str
    receiver_phone: str
    province: str
    city: str
    district: str
    detail: str
    postal_code: str | None = None
    is_default: bool
    created_at: datetime
    updated_at: datetime


class AddressCreateIn(BaseModel):
    """User create-address payload."""

    receiver_name: str = Field(min_length=1, max_length=60)
    receiver_phone: str = Field(min_length=_PHONE_LEN_MIN, max_length=_PHONE_LEN_MAX)
    province: str = Field(min_length=1, max_length=40)
    city: str = Field(min_length=1, max_length=40)
    district: str = Field(min_length=1, max_length=40)
    detail: str = Field(min_length=1, max_length=200)
    postal_code: str | None = Field(default=None, max_length=10)
    is_default: bool = False

    @field_validator("receiver_phone")
    @classmethod
    def _check_phone(cls, v: str) -> str:
        # Loose validation: digits + optional leading +. Frontend has stricter
        # regex; backend just guards against garbage.
        stripped = v.strip()
        if not stripped or any(c not in "+0123456789 -" for c in stripped):
            raise ValueError("receiver_phone must contain only digits, spaces, +, -")
        return stripped


class AddressUpdateIn(BaseModel):
    """User patch-address payload. Every field optional; at least one required."""

    receiver_name: str | None = Field(default=None, min_length=1, max_length=60)
    receiver_phone: str | None = Field(
        default=None, min_length=_PHONE_LEN_MIN, max_length=_PHONE_LEN_MAX
    )
    province: str | None = Field(default=None, min_length=1, max_length=40)
    city: str | None = Field(default=None, min_length=1, max_length=40)
    district: str | None = Field(default=None, min_length=1, max_length=40)
    detail: str | None = Field(default=None, min_length=1, max_length=200)
    postal_code: str | None = Field(default=None, max_length=10)
    is_default: bool | None = None

    @model_validator(mode="after")
    def _at_least_one(self) -> AddressUpdateIn:
        if not any(v is not None for v in self.model_dump().values()):
            raise ValueError("at least one field must be provided")
        return self


__all__ = ["AddressCreateIn", "AddressOut", "AddressUpdateIn"]
