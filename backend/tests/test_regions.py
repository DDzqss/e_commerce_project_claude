"""Public region-data endpoint tests — Phase 5 contract §7."""

from __future__ import annotations

from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.services import region_service

_REGIONS_JSON = Path(__file__).resolve().parent.parent / "app" / "scripts" / "regions_data.json"


@pytest.fixture
async def seeded_regions(db_session: AsyncSession) -> int:
    """Seed the packaged region tree once for the current test's DB."""
    added = await region_service.seed_from_json(db_session, _REGIONS_JSON)
    await db_session.commit()
    return added


@pytest.mark.asyncio
async def test_list_provinces(client: AsyncClient, seeded_regions: int) -> None:
    assert seeded_regions >= 34
    resp = await client.get("/api/v1/regions/children/root")
    body = resp.json()
    assert body["code"] == 0
    items = body["data"]["items"]
    assert len(items) == 34
    # All top-level entries must be level=1 provinces.
    assert all(row["level"] == 1 for row in items)
    codes = {row["code"] for row in items}
    assert "110000" in codes  # 北京
    assert "310000" in codes  # 上海


@pytest.mark.asyncio
async def test_list_cities_by_province(client: AsyncClient, seeded_regions: int) -> None:
    _ = seeded_regions
    # Beijing (110000) has exactly one child city (110100 市辖区).
    resp = await client.get("/api/v1/regions/children/110000")
    body = resp.json()
    assert body["code"] == 0
    cities = body["data"]["items"]
    assert cities, "expected at least one city under 110000"
    assert all(row["level"] == 2 for row in cities)
    assert all(row["parent_code"] == "110000" for row in cities)


@pytest.mark.asyncio
async def test_list_districts_by_city(client: AsyncClient, seeded_regions: int) -> None:
    _ = seeded_regions
    # 110100 (Beijing municipal district) has multiple 3rd-level districts.
    resp = await client.get("/api/v1/regions/children/110100")
    body = resp.json()
    assert body["code"] == 0
    districts = body["data"]["items"]
    assert len(districts) >= 3
    assert all(row["level"] == 3 for row in districts)
    assert all(row["parent_code"] == "110100" for row in districts)

    # Unknown parent_code → 23001.
    miss = await client.get("/api/v1/regions/children/999999")
    assert miss.json()["code"] == 23001
