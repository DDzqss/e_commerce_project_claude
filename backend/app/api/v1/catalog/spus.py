"""Public SPU browse endpoints — contract §11."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.errors import envelope
from app.services import catalog_service

router = APIRouter()

SortValue = Literal["default", "newest", "price_asc", "price_desc", "sales"]


@router.get("/spus", summary="List / search SPUs")
async def list_spus(
    session: AsyncSession = Depends(get_db),
    category_id: int | None = Query(default=None, ge=1),
    brand_id: int | None = Query(default=None, ge=1),
    keyword: str | None = Query(default=None, max_length=200),
    min_price_cents: int | None = Query(default=None, ge=0),
    max_price_cents: int | None = Query(default=None, ge=0),
    sort: SortValue = Query(default="default"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=60),
) -> dict[str, Any]:
    items, total = await catalog_service.list_spus(
        session,
        category_id=category_id,
        brand_id=brand_id,
        keyword=keyword,
        min_price_cents=min_price_cents,
        max_price_cents=max_price_cents,
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


@router.get("/spus/{spu_id}", summary="Get a SPU (approved only)")
async def get_spu(
    spu_id: int,
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    row = await catalog_service.get_spu_detail(session, spu_id)
    return envelope(data=row.model_dump(mode="json"))


@router.get("/spus/{spu_id}/related", summary="Related SPUs (same category)")
async def related_spus(
    spu_id: int,
    session: AsyncSession = Depends(get_db),
    limit: int = Query(default=8, ge=1, le=30),
) -> dict[str, Any]:
    items = await catalog_service.list_related(session, spu_id, limit=limit)
    return envelope(data={"items": [i.model_dump(mode="json") for i in items]})


@router.get("/recommendations", summary="Landing-page recommendations")
async def recommendations(
    session: AsyncSession = Depends(get_db),
    limit: int = Query(default=10, ge=1, le=30),
) -> dict[str, Any]:
    items = await catalog_service.list_recommendations(session, limit=limit)
    return envelope(data={"items": [i.model_dump(mode="json") for i in items]})
