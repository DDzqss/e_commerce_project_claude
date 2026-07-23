"""SPU (Standard Product Unit) schemas — contract §3.3 / §7 / §8 / §11."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.product import SPUStatus
from app.schemas.catalog import BrandBriefOut, CategoryBriefOut, CategoryPathNode
from app.schemas.sku import SKUOut


class SPUListItemOut(BaseModel):
    """Trimmed SPU projection for catalogue list responses."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    subtitle: str | None = None
    main_image: str
    min_price_cents: int
    max_price_cents: int
    sales_count: int
    brand: BrandBriefOut | None = None
    category: CategoryBriefOut | None = None


class ShopBriefOut(BaseModel):
    """Trimmed shop projection (for SPU detail)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class SPUOut(BaseModel):
    """Full SPU projection (merchant / admin view)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    shop_id: int
    category_id: int
    brand_id: int | None = None
    title: str
    subtitle: str | None = None
    description: str | None = None
    main_image: str
    images: list[str]
    spec_axes: list[str]
    status: SPUStatus
    reviewer_admin_id: int | None = None
    review_note: str | None = None
    reviewed_at: datetime | None = None
    sales_count: int
    view_count: int
    min_price_cents: int
    max_price_cents: int
    published_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class SPUDetailOut(SPUOut):
    """SPU + nested SKUs + brand + category breadcrumb + shop."""

    brand: BrandBriefOut | None = None
    category: CategoryBriefOut | None = None
    category_path: list[CategoryPathNode] = Field(default_factory=list)
    shop: ShopBriefOut | None = None
    skus: list[SKUOut] = Field(default_factory=list)


class SPUCreateIn(BaseModel):
    """Merchant create-SPU payload (contract §8.1)."""

    category_id: int
    brand_id: int | None = None
    title: str = Field(min_length=1, max_length=200)
    subtitle: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=20000)
    main_image: str = Field(min_length=1, max_length=255)
    images: list[str] = Field(default_factory=list, max_length=8)
    spec_axes: list[str] = Field(default_factory=list, max_length=5)


class SPUUpdateIn(BaseModel):
    """Merchant patch-SPU payload — all fields optional."""

    category_id: int | None = None
    brand_id: int | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    subtitle: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=20000)
    main_image: str | None = Field(default=None, min_length=1, max_length=255)
    images: list[str] | None = Field(default=None, max_length=8)
    spec_axes: list[str] | None = Field(default=None, max_length=5)


class SPUReviewIn(BaseModel):
    """Admin approve/reject/force-offshelf payload."""

    review_note: str | None = Field(default=None, max_length=500)


__all__ = [
    "SPUCreateIn",
    "SPUDetailOut",
    "SPUListItemOut",
    "SPUOut",
    "SPUReviewIn",
    "SPUUpdateIn",
    "ShopBriefOut",
]
