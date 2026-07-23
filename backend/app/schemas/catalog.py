"""Catalog schemas: Category (tree) and Brand."""

from __future__ import annotations

import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9\-]*$")


def _validate_slug(v: str) -> str:
    if not _SLUG_RE.match(v):
        raise ValueError("slug must be lowercase letters/digits and hyphens")
    return v


# ---------------------------------------------------------------------------
# Category
# ---------------------------------------------------------------------------
class CategoryOut(BaseModel):
    """Flat Category projection."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    parent_id: int | None
    name: str
    slug: str
    level: int
    path: str
    icon_url: str | None = None
    sort_order: int
    is_visible: bool
    created_at: datetime
    updated_at: datetime


class CategoryTreeOut(CategoryOut):
    """Category with recursive ``children`` list."""

    children: list[CategoryTreeOut] = Field(default_factory=list)


class CategoryCreateIn(BaseModel):
    """Admin create-category payload."""

    parent_id: int | None = None
    name: str = Field(min_length=1, max_length=60)
    slug: str = Field(min_length=1, max_length=60)
    icon_url: str | None = Field(default=None, max_length=255)
    sort_order: int = Field(default=0, ge=0)
    is_visible: bool = True

    @field_validator("slug")
    @classmethod
    def _slug(cls, v: str) -> str:
        return _validate_slug(v)


class CategoryUpdateIn(BaseModel):
    """Admin patch-category payload.

    ``parent_id`` is intentionally NOT updatable; to move a category
    the admin should delete + recreate (contract §6.1).
    """

    name: str | None = Field(default=None, min_length=1, max_length=60)
    slug: str | None = Field(default=None, min_length=1, max_length=60)
    icon_url: str | None = Field(default=None, max_length=255)
    sort_order: int | None = Field(default=None, ge=0)
    is_visible: bool | None = None

    @field_validator("slug")
    @classmethod
    def _slug(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return _validate_slug(v)


# ---------------------------------------------------------------------------
# Brand
# ---------------------------------------------------------------------------
class BrandOut(BaseModel):
    """Brand projection."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    logo_url: str | None = None
    description: str | None = None
    sort_order: int
    is_visible: bool
    created_at: datetime
    updated_at: datetime


class BrandBriefOut(BaseModel):
    """Trimmed brand projection (used in SPU list/detail)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    logo_url: str | None = None


class BrandCreateIn(BaseModel):
    """Admin create-brand payload."""

    name: str = Field(min_length=1, max_length=80)
    slug: str = Field(min_length=1, max_length=80)
    logo_url: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    sort_order: int = Field(default=0, ge=0)
    is_visible: bool = True

    @field_validator("slug")
    @classmethod
    def _slug(cls, v: str) -> str:
        return _validate_slug(v)


class BrandUpdateIn(BaseModel):
    """Admin patch-brand payload."""

    name: str | None = Field(default=None, min_length=1, max_length=80)
    slug: str | None = Field(default=None, min_length=1, max_length=80)
    logo_url: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    sort_order: int | None = Field(default=None, ge=0)
    is_visible: bool | None = None

    @field_validator("slug")
    @classmethod
    def _slug(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return _validate_slug(v)


class CategoryBriefOut(BaseModel):
    """Trimmed category projection (used in SPU list/detail)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str


class CategoryPathNode(BaseModel):
    """A single ancestor node used to render a breadcrumb path."""

    id: int
    name: str
    slug: str


__all__ = [
    "BrandBriefOut",
    "BrandCreateIn",
    "BrandOut",
    "BrandUpdateIn",
    "CategoryBriefOut",
    "CategoryCreateIn",
    "CategoryOut",
    "CategoryPathNode",
    "CategoryTreeOut",
    "CategoryUpdateIn",
]
