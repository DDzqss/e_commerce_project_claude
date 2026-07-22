"""Admin-facing (platform ops) API routes."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.admin import auth, me, merchant_applications

router = APIRouter()

router.include_router(auth.router, prefix="/auth", tags=["admin.auth"])
router.include_router(me.router, prefix="/me", tags=["admin.me"])
router.include_router(
    merchant_applications.router,
    prefix="/merchant-applications",
    tags=["admin.merchant-applications"],
)

__all__ = ["router"]
