"""User-facing (consumer) API routes."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.user import auth, me, merchant_applications

router = APIRouter()

router.include_router(auth.router, prefix="/auth", tags=["user.auth"])
router.include_router(me.router, prefix="/me", tags=["user.me"])
router.include_router(
    merchant_applications.router,
    prefix="/merchant-applications",
    tags=["user.merchant-applications"],
)

__all__ = ["router"]
