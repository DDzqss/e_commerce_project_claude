"""Admin-facing (platform ops) API routes."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()

# Admin feature routers land here (rbac, merchant-review, refund-arbitration, ...).

__all__ = ["router"]
