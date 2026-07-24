"""Public brand listing endpoint."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.errors import envelope
from app.services import catalog_service

router = APIRouter()


@router.get("", summary="List visible brands")
async def list_brands(
    session: AsyncSession = Depends(get_db),
    keyword: str | None = Query(default=None, max_length=120),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    items, total = await catalog_service.list_brands(session, keyword=keyword, page=page, size=size)
    return envelope(
        data={
            "items": [i.model_dump(mode="json") for i in items],
            "total": total,
            "page": page,
            "size": size,
        }
    )
