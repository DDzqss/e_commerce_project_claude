"""Public storefront endpoints — Phase 5 contract §9."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.errors import envelope
from app.services import catalog_service

router = APIRouter()


@router.get("/{shop_id}", summary="Public shop profile")
async def get_shop(
    shop_id: int,
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    row = await catalog_service.get_shop_public(session, shop_id)
    return envelope(data=row.model_dump(mode="json"))


@router.get("/{shop_id}/spus", summary="SPUs of a shop")
async def list_shop_spus(
    shop_id: int,
    session: AsyncSession = Depends(get_db),
    category_id: int | None = Query(default=None, ge=1),
    sort: str | None = Query(default=None, max_length=20),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=60),
) -> dict[str, Any]:
    items, total = await catalog_service.list_shop_spus(
        session,
        shop_id,
        category_id=category_id,
        sort=sort,
        page=page,
        size=size,
    )
    return envelope(
        data={
            "items": [i.model_dump(mode="json") for i in items],
            "total": total,
            "page": page,
            "size": size,
        }
    )
