"""Shared / cross-cutting API routes (health, meta, uploads)."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.common import health

router = APIRouter()
router.include_router(health.router, tags=["common.health"])

__all__ = ["router"]
