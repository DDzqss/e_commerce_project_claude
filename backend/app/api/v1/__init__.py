"""API v1 aggregate router.

Mounts scope-specific sub-routers (user / merchant / admin / catalog /
common) under the shared ``/api/v1`` prefix defined by
:attr:`app.core.config.Settings.API_V1_PREFIX`.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.admin import router as admin_router
from app.api.v1.catalog import router as catalog_router
from app.api.v1.common import router as common_router
from app.api.v1.merchant import router as merchant_router
from app.api.v1.user import router as user_router

api_router = APIRouter()

api_router.include_router(common_router, prefix="/common", tags=["common"])
api_router.include_router(catalog_router, prefix="/catalog", tags=["catalog"])
api_router.include_router(user_router, prefix="/user", tags=["user"])
api_router.include_router(merchant_router, prefix="/merchant", tags=["merchant"])
api_router.include_router(admin_router, prefix="/admin", tags=["admin"])

__all__ = ["api_router"]
