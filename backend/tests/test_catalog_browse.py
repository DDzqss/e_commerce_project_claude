"""User-facing catalog browse tests — contract §11."""

from __future__ import annotations

from typing import Any

import pytest
from httpx import AsyncClient

from app.models.admin_user import AdminUser
from app.models.merchant import MerchantAccount, Shop
from tests.conftest import (
    bearer,
    login_admin_get_tokens,
    login_merchant_get_tokens,
)


async def _seed_approved_spus(
    client: AsyncClient,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
    *,
    count: int = 2,
) -> list[dict[str, Any]]:
    _ = seed_admins
    account, _shop = seed_merchant_account
    m_tokens = await login_merchant_get_tokens(client, account.login_name, "Merch1234")
    m_headers = bearer(m_tokens["access_token"])
    a_tokens = await login_admin_get_tokens(client, "super", "super_pwd_change_me")
    a_headers = bearer(a_tokens["access_token"])

    created: list[dict[str, Any]] = []
    for i in range(count):
        spu = (
            await client.post(
                "/api/v1/merchant/spus",
                headers=m_headers,
                json={
                    "category_id": seed_catalog["leaf"].id,
                    "brand_id": seed_catalog["brand"].id,
                    "title": f"商品-{i}",
                    "subtitle": f"精选好物 #{i}",
                    "main_image": f"spu/x{i}.jpg",
                    "spec_axes": ["color"],
                },
            )
        ).json()["data"]
        await client.post(
            f"/api/v1/merchant/spus/{spu['id']}/skus",
            headers=m_headers,
            json={
                "sku_code": f"S{i}",
                "specs": {"color": "红"},
                "price_cents": 1000 + i * 500,
                "stock": 10,
            },
        )
        await client.post(f"/api/v1/merchant/spus/{spu['id']}/submit-review", headers=m_headers)
        await client.post(f"/api/v1/admin/spus/{spu['id']}/approve", headers=a_headers, json={})
        created.append(spu)
    return created


@pytest.mark.asyncio
async def test_public_list_only_returns_approved(
    client: AsyncClient,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    approved = await _seed_approved_spus(
        client, seed_admins, seed_merchant_account, seed_catalog, count=2
    )
    # Also create a draft SPU that should NOT appear.
    m_tokens = await login_merchant_get_tokens(
        client, seed_merchant_account[0].login_name, "Merch1234"
    )
    m_headers = bearer(m_tokens["access_token"])
    draft = (
        await client.post(
            "/api/v1/merchant/spus",
            headers=m_headers,
            json={
                "category_id": seed_catalog["leaf"].id,
                "brand_id": seed_catalog["brand"].id,
                "title": "隐藏草稿",
                "main_image": "spu/hidden.jpg",
                "spec_axes": [],
            },
        )
    ).json()["data"]

    resp = await client.get("/api/v1/catalog/spus")
    ids = [i["id"] for i in resp.json()["data"]["items"]]
    for spu in approved:
        assert spu["id"] in ids
    assert draft["id"] not in ids


@pytest.mark.asyncio
async def test_detail_bumps_view_count(
    client: AsyncClient,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    [spu] = await _seed_approved_spus(
        client, seed_admins, seed_merchant_account, seed_catalog, count=1
    )
    r1 = await client.get(f"/api/v1/catalog/spus/{spu['id']}")
    r2 = await client.get(f"/api/v1/catalog/spus/{spu['id']}")
    assert r1.json()["data"]["view_count"] == 1
    assert r2.json()["data"]["view_count"] == 2
    # breadcrumb & SKUs
    assert len(r2.json()["data"]["category_path"]) == 3
    assert len(r2.json()["data"]["skus"]) >= 1


@pytest.mark.asyncio
async def test_filter_by_category_subtree(
    client: AsyncClient,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    await _seed_approved_spus(client, seed_admins, seed_merchant_account, seed_catalog, count=2)
    # Filter by top-level "数码" root — subtree contains our leaf.
    root_id = seed_catalog["root"].id
    resp = await client.get(f"/api/v1/catalog/spus?category_id={root_id}")
    assert resp.json()["data"]["total"] == 2


@pytest.mark.asyncio
async def test_recommendations_and_related(
    client: AsyncClient,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    seeded = await _seed_approved_spus(
        client, seed_admins, seed_merchant_account, seed_catalog, count=3
    )
    recs = await client.get("/api/v1/catalog/recommendations?limit=2")
    assert len(recs.json()["data"]["items"]) == 2

    rel = await client.get(f"/api/v1/catalog/spus/{seeded[0]['id']}/related?limit=5")
    ids = {i["id"] for i in rel.json()["data"]["items"]}
    assert seeded[0]["id"] not in ids
    assert seeded[1]["id"] in ids
