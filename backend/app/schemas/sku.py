"""SKU (Stock Keeping Unit) schemas — contract §3.4 / §8.2."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SKUOut(BaseModel):
    """SKU projection."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    spu_id: int
    sku_code: str
    specs: dict[str, str]
    price_cents: int
    original_price_cents: int | None = None
    stock: int
    locked_stock: int
    sold_count: int
    image: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class SKUCreateIn(BaseModel):
    """Merchant create-SKU payload."""

    sku_code: str = Field(min_length=1, max_length=60)
    specs: dict[str, str] = Field(default_factory=dict)
    price_cents: int = Field(gt=0)
    original_price_cents: int | None = Field(default=None, gt=0)
    stock: int = Field(default=0, ge=0)
    image: str | None = Field(default=None, max_length=255)
    is_active: bool = True

    @model_validator(mode="after")
    def _check_original_price(self) -> SKUCreateIn:
        if self.original_price_cents is not None and self.original_price_cents < self.price_cents:
            raise ValueError("original_price_cents must be >= price_cents")
        return self


class SKUUpdateIn(BaseModel):
    """Merchant patch-SKU payload.

    Contract §8.2 disallows changing ``specs`` or ``sku_code`` — delete
    and recreate is the only supported flow for those.
    """

    price_cents: int | None = Field(default=None, gt=0)
    original_price_cents: int | None = Field(default=None, gt=0)
    image: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None

    @model_validator(mode="after")
    def _check_original_price(self) -> SKUUpdateIn:
        if (
            self.original_price_cents is not None
            and self.price_cents is not None
            and self.original_price_cents < self.price_cents
        ):
            raise ValueError("original_price_cents must be >= price_cents")
        return self


__all__ = ["SKUCreateIn", "SKUOut", "SKUUpdateIn"]
