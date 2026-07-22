"""Merchant-facing (seller back-office) API routes."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()

# Merchant feature routers land here (product, order, shop, ...).

__all__ = ["router"]
