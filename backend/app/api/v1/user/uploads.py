"""User-side upload presign endpoint — Phase 4 §10.1."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app.api.deps import require_user_permission
from app.core.errors import envelope
from app.core.rbac import Permission
from app.models.user import User
from app.schemas.upload import PresignIn, UserPresignIn
from app.services import upload_service

router = APIRouter()


@router.post("/presign", summary="Presigned MinIO PUT URL (user side)")
async def presign_user_upload(
    payload: UserPresignIn,
    _: User = Depends(require_user_permission(Permission.USER_UPLOAD_PRESIGN)),
) -> dict[str, Any]:
    # Reuse the shared presign path (same input shape).
    merchant_shape = PresignIn(
        purpose=payload.purpose,
        content_type=payload.content_type,
        file_size=payload.file_size,
    )
    result = await upload_service.presign(merchant_shape)
    return envelope(data=result.model_dump(mode="json"))
