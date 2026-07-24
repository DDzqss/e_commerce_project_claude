"""Region schemas — Phase 5 contract §7."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class RegionOut(BaseModel):
    """A single administrative-division row."""

    model_config = ConfigDict(from_attributes=True)

    code: str
    parent_code: str | None = None
    name: str
    short_name: str | None = None
    level: int
    sort_order: int


class RegionTreeNode(BaseModel):
    """Tree-shaped Region node used by ``GET /regions/tree``."""

    code: str
    parent_code: str | None = None
    name: str
    short_name: str | None = None
    level: int
    sort_order: int
    children: list[RegionTreeNode] = []


RegionTreeNode.model_rebuild()

__all__ = ["RegionOut", "RegionTreeNode"]
