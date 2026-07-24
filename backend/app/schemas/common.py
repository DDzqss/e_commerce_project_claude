"""Shared / cross-cutting Pydantic schemas."""

from __future__ import annotations

from typing import TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class OkModel(BaseModel):
    """Marker base with ``from_attributes=True`` for ORM conversion."""

    model_config = ConfigDict(from_attributes=True)


class PaginatedOut[T](BaseModel):
    """Standard paginated list envelope (contract §1)."""

    items: list[T]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    size: int = Field(ge=1)


class PaginationIn(BaseModel):
    """Common ``?page=&size=`` query parameters."""

    page: int = Field(default=1, ge=1)
    size: int = Field(default=20, ge=1, le=100)


__all__ = ["OkModel", "PaginatedOut", "PaginationIn"]
