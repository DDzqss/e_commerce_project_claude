"""Upload presign schemas — contract §9 + Phase 4 §10."""

from __future__ import annotations

import enum
from datetime import datetime

from pydantic import BaseModel, Field


class UploadPurpose(enum.StrEnum):
    """Kind of upload — determines bucket / prefix / max size."""

    SPU_MAIN = "spu_main"
    SPU_GALLERY = "spu_gallery"
    BRAND_LOGO = "brand_logo"
    CATEGORY_ICON = "category_icon"
    # Phase 4 · aftersales purposes
    AFTERSALES_APPLY = "aftersales_apply"
    AFTERSALES_USER_RETURN = "aftersales_user_return"
    AFTERSALES_MERCHANT_RECEIVE = "aftersales_merchant_receive"
    AFTERSALES_EXCHANGE_SHIP = "aftersales_exchange_ship"
    AFTERSALES_APPEAL = "aftersales_appeal"
    AFTERSALES_ARBITRATION = "aftersales_arbitration"


class PresignIn(BaseModel):
    """``POST /merchant/uploads/presign`` payload."""

    purpose: UploadPurpose
    content_type: str = Field(min_length=1, max_length=80)
    file_size: int = Field(gt=0, description="File size in bytes.")


class UserPresignIn(BaseModel):
    """``POST /user/uploads/presign`` payload (Phase 4).

    Users can only presign aftersales-scope uploads.
    """

    purpose: UploadPurpose
    content_type: str = Field(min_length=1, max_length=80)
    file_size: int = Field(gt=0, description="File size in bytes.")


class PresignOut(BaseModel):
    """Presign response — client then PUTs to ``upload_url``."""

    object_key: str
    upload_url: str
    public_url: str
    expires_at: datetime


__all__ = ["PresignIn", "PresignOut", "UploadPurpose", "UserPresignIn"]
