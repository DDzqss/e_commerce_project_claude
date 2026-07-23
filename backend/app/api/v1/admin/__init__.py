"""Admin-facing (platform ops) API routes."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.admin import (
    auth,
    brands,
    categories,
    me,
    merchant_applications,
    orders,
    spus,
    tasks,
)

router = APIRouter()

router.include_router(auth.router, prefix="/auth", tags=["admin.auth"])
router.include_router(me.router, prefix="/me", tags=["admin.me"])
router.include_router(
    merchant_applications.router,
    prefix="/merchant-applications",
    tags=["admin.merchant-applications"],
)
router.include_router(categories.router, prefix="/categories", tags=["admin.categories"])
router.include_router(brands.router, prefix="/brands", tags=["admin.brands"])
router.include_router(spus.router, prefix="/spus", tags=["admin.spus"])
router.include_router(orders.router, prefix="/orders", tags=["admin.orders"])
router.include_router(tasks.router, prefix="/tasks", tags=["admin.tasks"])

__all__ = ["router"]
