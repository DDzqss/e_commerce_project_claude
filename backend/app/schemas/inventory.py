"""Inventory adjust + log schemas — contract §10."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.inventory_log import InventoryOperatorType, InventoryReason


class InventoryAdjustIn(BaseModel):
    """Merchant stock-adjust payload."""

    delta: int = Field(description="Positive to add stock, negative to deduct.")
    reason: InventoryReason
    note: str | None = Field(default=None, max_length=1000)


class InventoryLogOut(BaseModel):
    """InventoryLog projection."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    sku_id: int
    delta: int
    balance_after: int
    reason: InventoryReason
    operator_type: InventoryOperatorType
    operator_id: int | None = None
    note: str | None = None
    related_order_id: int | None = None
    created_at: datetime


__all__ = ["InventoryAdjustIn", "InventoryLogOut"]
