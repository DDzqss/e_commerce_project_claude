"""Merchant application (onboarding) request/response schemas."""

from __future__ import annotations

import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.merchant_application import MerchantApplicationStatus

_PHONE_RE = re.compile(r"^1[3-9]\d{9}$")


class MerchantApplicationCreateIn(BaseModel):
    """``POST /user/merchant-applications`` payload."""

    shop_name: str = Field(min_length=1, max_length=120)
    contact_name: str = Field(min_length=1, max_length=60)
    contact_phone: str = Field(min_length=1, max_length=20)
    business_license_no: str = Field(min_length=1, max_length=50)
    description: str | None = Field(default=None, max_length=2000)

    @field_validator("contact_phone")
    @classmethod
    def _check_phone(cls, v: str) -> str:
        if not _PHONE_RE.match(v):
            raise ValueError("contact_phone must be a valid Chinese 11-digit mobile")
        return v


class MerchantApplicationReviewIn(BaseModel):
    """``POST /admin/merchant-applications/{id}/approve|reject`` payload.

    For ``reject`` the note is required (5-500 chars, contract §9). We
    treat it as optional here and enforce in the service layer so the
    same schema can service both endpoints.
    """

    review_note: str | None = Field(default=None, max_length=500)


class MerchantApplicationOut(BaseModel):
    """Merchant application projection."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    applicant_user_id: int
    shop_name: str
    contact_name: str
    contact_phone: str
    business_license_no: str
    business_license_url: str | None = None
    description: str | None = None
    status: MerchantApplicationStatus
    reviewer_admin_id: int | None = None
    review_note: str | None = None
    reviewed_at: datetime | None = None
    approved_merchant_account_id: int | None = None
    created_at: datetime
    updated_at: datetime


class MerchantApplicationListQuery(BaseModel):
    """Query params for admin listing."""

    status: MerchantApplicationStatus | None = None
    keyword: str | None = Field(default=None, max_length=120)
    page: int = Field(default=1, ge=1)
    size: int = Field(default=20, ge=1, le=100)


__all__ = [
    "MerchantApplicationCreateIn",
    "MerchantApplicationListQuery",
    "MerchantApplicationOut",
    "MerchantApplicationReviewIn",
]
