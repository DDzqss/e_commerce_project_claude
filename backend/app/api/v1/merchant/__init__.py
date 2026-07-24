"""Merchant-facing (seller back-office) API routes."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.merchant import (
    aftersales,
    auth,
    inventory,
    me,
    notifications,
    orders,
    reviews,
    skus,
    spus,
    uploads,
)

router = APIRouter()

router.include_router(auth.router, prefix="/auth", tags=["merchant.auth"])
router.include_router(me.router, prefix="/me", tags=["merchant.me"])
router.include_router(spus.router, prefix="/spus", tags=["merchant.spus"])
# SKU routes live nested under /merchant/spus/{spu_id}/skus (contract §8.2).
router.include_router(skus.router, prefix="/spus", tags=["merchant.skus"])
router.include_router(uploads.router, prefix="/uploads", tags=["merchant.uploads"])
router.include_router(inventory.router, prefix="", tags=["merchant.inventory"])
router.include_router(orders.router, prefix="/orders", tags=["merchant.orders"])
router.include_router(aftersales.router, prefix="/aftersales", tags=["merchant.aftersales"])
# Phase 5 — reviews / notifications.
router.include_router(reviews.router, prefix="/reviews", tags=["merchant.reviews"])
router.include_router(
    notifications.router, prefix="/notifications", tags=["merchant.notifications"]
)

__all__ = ["router"]
