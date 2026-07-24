"""Region service — Phase 5 contract §7.

Owns tree read + seed-from-JSON helper. Region rows are immutable
reference data, so the API is read-only (no CRUD).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppException, ErrorCode
from app.models.region import Region
from app.schemas.region import RegionOut, RegionTreeNode


async def get_children(session: AsyncSession, parent_code: str | None) -> list[RegionOut]:
    """Return direct children of ``parent_code`` (None → top-level)."""
    stmt = select(Region)
    if parent_code is None or parent_code in {"", "root"}:
        stmt = stmt.where(Region.parent_code.is_(None))
    else:
        parent = await session.get(Region, parent_code)
        if parent is None:
            raise AppException(ErrorCode.REGION_CODE_INVALID, "parent_code not found")
        stmt = stmt.where(Region.parent_code == parent_code)
    stmt = stmt.order_by(Region.sort_order.asc(), Region.code.asc())
    rows = list((await session.execute(stmt)).scalars().all())
    return [RegionOut.model_validate(r) for r in rows]


async def get_tree(session: AsyncSession) -> list[RegionTreeNode]:
    """Return the full 3-level tree ordered by ``(sort_order, code)``."""
    stmt = select(Region).order_by(Region.sort_order.asc(), Region.code.asc())
    rows = list((await session.execute(stmt)).scalars().all())
    by_code: dict[str, RegionTreeNode] = {}
    roots: list[RegionTreeNode] = []
    for r in rows:
        node = RegionTreeNode(
            code=r.code,
            parent_code=r.parent_code,
            name=r.name,
            short_name=r.short_name,
            level=r.level,
            sort_order=r.sort_order,
            children=[],
        )
        by_code[r.code] = node
    for r in rows:
        node = by_code[r.code]
        if r.parent_code is None:
            roots.append(node)
        else:
            parent = by_code.get(r.parent_code)
            if parent is not None:
                parent.children.append(node)
            else:
                # Orphan: promote to root so callers still see it.
                roots.append(node)
    return roots


async def validate_codes(
    session: AsyncSession,
    *,
    province_code: str | None,
    city_code: str | None,
    district_code: str | None,
) -> None:
    """Ensure the codes (any subset) form a coherent parent-child chain."""
    codes = [c for c in (province_code, city_code, district_code) if c]
    if not codes:
        return
    rows = list(
        (
            await session.execute(select(Region).where(Region.code.in_(codes)))
        )
        .scalars()
        .all()
    )
    by_code = {r.code: r for r in rows}
    for c in codes:
        if c not in by_code:
            raise AppException(ErrorCode.REGION_CODE_INVALID, f"region code {c} not found")
    if province_code and by_code[province_code].level != 1:
        raise AppException(ErrorCode.REGION_CODE_INVALID, "province_code is not a province")
    if city_code:
        city = by_code[city_code]
        if city.level != 2:
            raise AppException(ErrorCode.REGION_CODE_INVALID, "city_code is not a city")
        if province_code and city.parent_code != province_code:
            raise AppException(
                ErrorCode.REGION_CODE_MISMATCH,
                "city_code does not belong to province_code",
            )
    if district_code:
        d = by_code[district_code]
        if d.level != 3:
            raise AppException(ErrorCode.REGION_CODE_INVALID, "district_code is not a district")
        if city_code and d.parent_code != city_code:
            raise AppException(
                ErrorCode.REGION_CODE_MISMATCH,
                "district_code does not belong to city_code",
            )


async def seed_from_json(session: AsyncSession, path: Path) -> int:
    """Read the JSON file at ``path`` and upsert Region rows.

    JSON schema (list): ``[{code, parent_code, name, short_name?, level,
    sort_order}]``. Existing rows are left alone.
    """
    if not path.exists():
        return 0
    data: list[dict[str, Any]] = json.loads(path.read_text(encoding="utf-8"))
    existing = set(
        (await session.execute(select(Region.code))).scalars().all()
    )
    added = 0
    # Insert level 1 first, then 2, then 3 to satisfy the self-FK.
    data_sorted = sorted(data, key=lambda d: (int(d.get("level", 1)), str(d.get("code", ""))))
    for entry in data_sorted:
        code = str(entry["code"])
        if code in existing:
            continue
        session.add(
            Region(
                code=code,
                parent_code=entry.get("parent_code"),
                name=entry["name"],
                short_name=entry.get("short_name"),
                level=int(entry["level"]),
                sort_order=int(entry.get("sort_order", 0)),
            )
        )
        existing.add(code)
        added += 1
    await session.flush()
    return added


__all__ = ["get_children", "get_tree", "seed_from_json", "validate_codes"]
