"""Order-stats schemas — contract §10.3 / §11."""

from __future__ import annotations

from pydantic import BaseModel


class MerchantOrderStatsOut(BaseModel):
    """Merchant shop-summary dashboard payload."""

    pending_payment_count: int
    paid_pending_ship_count: int
    shipped_count: int
    completed_today_count: int
    revenue_today_cents: int


class AdminOrderOverviewOut(BaseModel):
    """Admin platform-overview dashboard payload."""

    orders_today_count: int
    orders_today_gmv_cents: int
    pending_payment_count: int
    pending_ship_count: int
    shipped_count: int
    cancelled_today_count: int


__all__ = ["AdminOrderOverviewOut", "MerchantOrderStatsOut"]
