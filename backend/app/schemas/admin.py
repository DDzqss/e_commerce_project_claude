"""Admin-domain request/response schemas."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.models.admin_user import AdminRole, AdminStatus


class AdminLoginIn(BaseModel):
    """Admin login payload."""

    username: str = Field(min_length=1, max_length=60)
    password: str = Field(min_length=1, max_length=64)


class AdminOut(BaseModel):
    """Admin projection."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    display_name: str
    role: AdminRole
    status: AdminStatus


class AdminMeOut(BaseModel):
    """``GET /admin/me`` response — admin + perms."""

    admin: AdminOut
    permissions: list[str]


__all__ = ["AdminLoginIn", "AdminMeOut", "AdminOut"]
