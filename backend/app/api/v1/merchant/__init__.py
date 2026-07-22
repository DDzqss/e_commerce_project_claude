"""Merchant-facing (seller back-office) API routes."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.merchant import auth, me

router = APIRouter()

router.include_router(auth.router, prefix="/auth", tags=["merchant.auth"])
router.include_router(me.router, prefix="/me", tags=["merchant.me"])

__all__ = ["router"]
