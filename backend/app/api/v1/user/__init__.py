"""User-facing (consumer) API routes."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.user import addresses, auth, cart, me, merchant_applications, orders, payments

router = APIRouter()

router.include_router(auth.router, prefix="/auth", tags=["user.auth"])
router.include_router(me.router, prefix="/me", tags=["user.me"])
router.include_router(
    merchant_applications.router,
    prefix="/merchant-applications",
    tags=["user.merchant-applications"],
)
router.include_router(addresses.router, prefix="/addresses", tags=["user.addresses"])
router.include_router(cart.router, prefix="/cart", tags=["user.cart"])
router.include_router(orders.router, prefix="/orders", tags=["user.orders"])
# Payments mount at the user root so both /orders/{id}/pay and
# /payment-sessions/{id}/... live in one router.
router.include_router(payments.router, prefix="", tags=["user.payments"])

__all__ = ["router"]
