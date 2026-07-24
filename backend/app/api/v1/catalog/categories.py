"""Public category tree endpoint."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.errors import envelope
from app.services import catalog_service

router = APIRouter()


@router.get("", summary="Full visible category tree")
async def list_categories(
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    tree = await catalog_service.list_categories(session)
    return envelope(data={"items": [t.model_dump(mode="json") for t in tree]})
