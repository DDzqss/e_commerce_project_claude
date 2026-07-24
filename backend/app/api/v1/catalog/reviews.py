"""Public review browse endpoints — Phase 5 contract §4.5 / §4.6."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.errors import envelope
from app.services import review_service

router = APIRouter()


@router.get("/spus/{spu_id}/reviews", summary="Public reviews for an SPU")
async def list_spu_reviews(
    spu_id: int,
    session: AsyncSession = Depends(get_db),
    rating: int | None = Query(default=None, ge=1, le=5),
    with_images: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=60),
) -> dict[str, Any]:
    out = await review_service.list_by_spu(
        session,
        spu_id,
        rating=rating,
        with_images=with_images,
        page=page,
        size=size,
    )
    return envelope(data=out.model_dump(mode="json"))


@router.get("/shops/{shop_id}/reviews", summary="Public reviews for a shop")
async def list_shop_reviews(
    shop_id: int,
    session: AsyncSession = Depends(get_db),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=60),
) -> dict[str, Any]:
    out = await review_service.list_by_shop(session, shop_id, page=page, size=size)
    return envelope(data=out.model_dump(mode="json"))
