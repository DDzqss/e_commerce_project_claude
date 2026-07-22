"""User-facing (consumer) API routes."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()

# Feature routers (auth, cart, order, ...) will be included here as they land.
# Example:
#   from app.api.v1.user import auth
#   router.include_router(auth.router, prefix="/auth", tags=["user.auth"])

__all__ = ["router"]
