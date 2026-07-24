"""Cart schemas — contract §7."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

_MAX_QTY = 999


class CartSkuBrief(BaseModel):
    """Nested SKU snapshot inside a cart item response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    spu_id: int
    sku_code: str
    specs: dict[str, str]
    price_cents: int
    original_price_cents: int | None = None
    stock: int
    image: str | None = None
    is_active: bool


class CartSpuBrief(BaseModel):
    """Nested SPU snapshot inside a cart item response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    main_image: str
    status: str


class CartShopBrief(BaseModel):
    """Nested Shop snapshot inside cart groups."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class CartItemOut(BaseModel):
    """Cart line projection (with validity flag + snapshot bundles)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    sku_id: int
    quantity: int
    selected: bool
    status: Literal["valid", "invalid"]
    invalid_reason: str | None = None
    sku: CartSkuBrief
    spu: CartSpuBrief
    created_at: datetime
    updated_at: datetime


class CartGroupOut(BaseModel):
    """Per-shop grouping in the cart response."""

    shop: CartShopBrief
    items: list[CartItemOut]
    subtotal_cents_selected: int


class CartResponseOut(BaseModel):
    """Full cart response body."""

    groups: list[CartGroupOut]
    total_cents_selected: int
    total_selected_count: int
    invalid_count: int


class CartAddIn(BaseModel):
    """Add-to-cart payload."""

    sku_id: int = Field(ge=1)
    quantity: int = Field(default=1, ge=1, le=_MAX_QTY)


class CartUpdateIn(BaseModel):
    """Patch cart-item payload."""

    quantity: int | None = Field(default=None, ge=1, le=_MAX_QTY)
    selected: bool | None = None

    @model_validator(mode="after")
    def _at_least_one(self) -> CartUpdateIn:
        if self.quantity is None and self.selected is None:
            raise ValueError("at least one of quantity/selected must be provided")
        return self


class CartBatchDeleteIn(BaseModel):
    """Bulk-delete payload."""

    ids: list[int] = Field(min_length=1, max_length=500)


class CartSelectAllIn(BaseModel):
    """Select-all / unselect-all payload."""

    selected: bool


__all__ = [
    "CartAddIn",
    "CartBatchDeleteIn",
    "CartGroupOut",
    "CartItemOut",
    "CartResponseOut",
    "CartSelectAllIn",
    "CartShopBrief",
    "CartSkuBrief",
    "CartSpuBrief",
    "CartUpdateIn",
]
