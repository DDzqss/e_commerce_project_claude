"""Upload presigning service — contract §9.

Generates a per-upload UUID-based object key + presigned PUT URL.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from app.core.config import get_settings
from app.core.errors import AppException, ErrorCode
from app.core.storage import build_public_url, presign_put
from app.schemas.upload import PresignIn, PresignOut, UploadPurpose

_PREFIX_BY_PURPOSE: dict[UploadPurpose, str] = {
    UploadPurpose.SPU_MAIN: "spu",
    UploadPurpose.SPU_GALLERY: "spu",
    UploadPurpose.BRAND_LOGO: "brand",
    UploadPurpose.CATEGORY_ICON: "category",
}

_EXT_BY_CONTENT_TYPE: dict[str, str] = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


def _build_object_key(purpose: UploadPurpose, content_type: str) -> str:
    now = datetime.now(UTC)
    prefix = _PREFIX_BY_PURPOSE[purpose]
    ext = _EXT_BY_CONTENT_TYPE.get(content_type.lower(), "bin")
    return f"{prefix}/{now:%Y/%m/%d}/{uuid.uuid4().hex}.{ext}"


async def presign(payload: PresignIn) -> PresignOut:
    """Validate the payload and return an upload_url + object_key."""
    settings = get_settings()
    ct = payload.content_type.strip().lower()
    if ct not in settings.upload_allowed_content_types_list:
        raise AppException(
            ErrorCode.UPLOAD_CONTENT_TYPE_NOT_ALLOWED,
            f"content_type '{payload.content_type}' is not allowed",
        )
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if payload.file_size > max_bytes:
        raise AppException(
            ErrorCode.UPLOAD_FILE_TOO_LARGE,
            f"file exceeds {settings.MAX_UPLOAD_SIZE_MB} MB limit",
        )

    key = _build_object_key(payload.purpose, ct)
    try:
        upload_url = await presign_put(key, content_type=ct)
    except Exception as exc:  # pragma: no cover — MinIO down
        raise AppException(
            ErrorCode.UPLOAD_PRESIGN_FAILED,
            f"failed to sign upload URL: {exc}",
        ) from exc

    expires_at = datetime.now(UTC) + timedelta(seconds=settings.UPLOAD_PRESIGN_EXPIRE_SECONDS)
    return PresignOut(
        object_key=key,
        upload_url=upload_url,
        public_url=build_public_url(key),
        expires_at=expires_at,
    )


__all__ = ["presign"]
