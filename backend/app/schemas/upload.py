"""Upload presign schemas — contract §9."""

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


class PresignIn(BaseModel):
    """``POST /merchant/uploads/presign`` payload."""

    purpose: UploadPurpose
    content_type: str = Field(min_length=1, max_length=80)
    file_size: int = Field(gt=0, description="File size in bytes.")


class PresignOut(BaseModel):
    """Presign response — client then PUTs to ``upload_url``."""

    object_key: str
    upload_url: str
    public_url: str
    expires_at: datetime


__all__ = ["PresignIn", "PresignOut", "UploadPurpose"]
