"""Merchant-side upload presign endpoint — contract §9."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app.api.deps import require_merchant_permission
from app.core.errors import envelope
from app.core.rbac import Permission
from app.models.merchant import MerchantAccount
from app.schemas.upload import PresignIn
from app.services import upload_service

router = APIRouter()


@router.post("/presign", summary="Generate a presigned MinIO PUT URL")
async def presign_upload(
    payload: PresignIn,
    _: MerchantAccount = Depends(require_merchant_permission(Permission.MERCHANT_UPLOAD_PRESIGN)),
) -> dict[str, Any]:
    result = await upload_service.presign(payload)
    return envelope(data=result.model_dump(mode="json"))
