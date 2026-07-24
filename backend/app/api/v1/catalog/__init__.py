"""Public catalog routes (no auth required)."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.catalog import brands, categories, reviews, shops, spus

router = APIRouter()

router.include_router(categories.router, prefix="/categories", tags=["catalog.categories"])
router.include_router(brands.router, prefix="/brands", tags=["catalog.brands"])
router.include_router(spus.router, prefix="", tags=["catalog.spus"])
# Phase 5 — public storefront and review browse.
router.include_router(shops.router, prefix="/shops", tags=["catalog.shops"])
router.include_router(reviews.router, prefix="", tags=["catalog.reviews"])

__all__ = ["router"]
