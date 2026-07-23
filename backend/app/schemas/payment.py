"""Payment-session schemas — contract §9."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.payment_session import PaymentChannel, PaymentStatus


class PayCreateIn(BaseModel):
    """Create-payment-session payload."""

    channel: PaymentChannel


class PaymentSessionOut(BaseModel):
    """Full payment-session projection returned to user."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    session_id: int = Field(alias="id")
    order_id: int
    channel: PaymentChannel
    amount_cents: int
    status: PaymentStatus
    external_txn_no: str | None = None
    failure_reason: str | None = None
    mock_pay_url: str | None = None
    expires_at: datetime | None = None
    created_at: datetime
    completed_at: datetime | None = None


class PaymentAmountOnlyOut(BaseModel):
    """Minimal outcome payload — used by mock-succeed / mock-fail routes."""

    session_id: int
    order_id: int
    order_status: str
    session_status: PaymentStatus


__all__ = ["PayCreateIn", "PaymentAmountOnlyOut", "PaymentSessionOut"]
