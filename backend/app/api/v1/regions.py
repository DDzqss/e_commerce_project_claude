"""Public region-data endpoints — Phase 5 contract §7."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.errors import envelope
from app.services import region_service

router = APIRouter()


@router.get("/tree", summary="Full 3-level region tree")
async def get_tree(session: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    tree = await region_service.get_tree(session)
    return envelope(data={"items": [t.model_dump(mode="json") for t in tree]})


@router.get("/children/{parent_code}", summary="Direct children of a region")
async def get_children(
    parent_code: str,
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    # Support the caller passing "root" or "" for the top-level query.
    code = None if parent_code in ("", "root") else parent_code
    items = await region_service.get_children(session, code)
    return envelope(data={"items": [i.model_dump(mode="json") for i in items]})


@router.get("/children", summary="Top-level regions (provinces)")
async def get_children_root(session: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    items = await region_service.get_children(session, None)
    return envelope(data={"items": [i.model_dump(mode="json") for i in items]})
