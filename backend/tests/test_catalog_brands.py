"""Admin brand CRUD tests — contract §6.2."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.models.admin_user import AdminUser
from tests.conftest import bearer, login_admin_get_tokens


async def _admin_headers(client: AsyncClient) -> dict[str, str]:
    tokens = await login_admin_get_tokens(client, "super", "super_pwd_change_me")
    return bearer(tokens["access_token"])


@pytest.mark.asyncio
async def test_brand_crud_flow(client: AsyncClient, seed_admins: dict[str, AdminUser]) -> None:
    _ = seed_admins
    headers = await _admin_headers(client)

    create = await client.post(
        "/api/v1/admin/brands",
        headers=headers,
        json={"name": "Apple", "slug": "apple", "sort_order": 10},
    )
    assert create.status_code == 201
    brand = create.json()["data"]
    assert brand["name"] == "Apple"

    # duplicate slug → 6012
    dup = await client.post(
        "/api/v1/admin/brands", headers=headers, json={"name": "Apple 2", "slug": "apple"}
    )
    assert dup.json()["code"] == 6012

    # list
    lst = await client.get("/api/v1/admin/brands?keyword=app", headers=headers)
    assert lst.json()["data"]["total"] >= 1

    # update
    upd = await client.patch(
        f"/api/v1/admin/brands/{brand['id']}",
        headers=headers,
        json={"description": "The Apple brand"},
    )
    assert upd.json()["data"]["description"] == "The Apple brand"

    # delete
    dele = await client.delete(f"/api/v1/admin/brands/{brand['id']}", headers=headers)
    assert dele.json()["code"] == 0

    # missing → 6011
    missing = await client.get(f"/api/v1/admin/brands/{brand['id']}", headers=headers)
    assert missing.json()["code"] == 6011


@pytest.mark.asyncio
async def test_public_brand_listing_only_visible(
    client: AsyncClient, seed_admins: dict[str, AdminUser]
) -> None:
    _ = seed_admins
    headers = await _admin_headers(client)
    hidden = (
        await client.post(
            "/api/v1/admin/brands",
            headers=headers,
            json={"name": "Hidden", "slug": "hidden", "is_visible": False},
        )
    ).json()["data"]
    (
        await client.post(
            "/api/v1/admin/brands",
            headers=headers,
            json={"name": "Visible", "slug": "visible"},
        )
    ).json()["data"]

    pub = await client.get("/api/v1/catalog/brands")
    slugs = {b["slug"] for b in pub.json()["data"]["items"]}
    assert "visible" in slugs
    assert "hidden" not in slugs
    _ = hidden
