"""Admin self endpoints (contract §6.3)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app.api.deps import get_current_admin
from app.core.errors import envelope
from app.core.rbac import permissions_for_admin
from app.models.admin_user import AdminUser
from app.schemas.admin import AdminMeOut, AdminOut

router = APIRouter()


@router.get("", summary="Get current admin + permissions")
async def me(admin: AdminUser = Depends(get_current_admin)) -> dict[str, Any]:
    perms = sorted(p.value for p in permissions_for_admin(admin.role))
    body = AdminMeOut(admin=AdminOut.model_validate(admin), permissions=perms)
    return envelope(data=body.model_dump())
