"""SKU management tests — contract §8.2."""

from __future__ import annotations

from typing import Any

import pytest
from httpx import AsyncClient

from app.models.admin_user import AdminUser
from app.models.merchant import MerchantAccount, Shop
from tests.conftest import bearer, login_merchant_get_tokens


async def _merchant_headers(
    client: AsyncClient, seed_merchant_account: tuple[MerchantAccount, Shop]
) -> dict[str, str]:
    account, _ = seed_merchant_account
    tokens = await login_merchant_get_tokens(client, account.login_name, "Merch1234")
    return bearer(tokens["access_token"])


async def _mk_spu(
    client: AsyncClient,
    m_headers: dict[str, str],
    seed_catalog: dict[str, Any],
) -> dict[str, Any]:
    resp = await client.post(
        "/api/v1/merchant/spus",
        headers=m_headers,
        json={
            "category_id": seed_catalog["leaf"].id,
            "brand_id": seed_catalog["brand"].id,
            "title": "测试商品",
            "main_image": "spu/x.jpg",
            "spec_axes": ["color", "size"],
        },
    )
    return resp.json()["data"]


@pytest.mark.asyncio
async def test_sku_crud_updates_spu_price_range(
    client: AsyncClient,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    _ = seed_admins
    m_headers = await _merchant_headers(client, seed_merchant_account)
    spu = await _mk_spu(client, m_headers, seed_catalog)

    # add two SKUs
    a = await client.post(
        f"/api/v1/merchant/spus/{spu['id']}/skus",
        headers=m_headers,
        json={
            "sku_code": "A-1",
            "specs": {"color": "红", "size": "L"},
            "price_cents": 9900,
            "stock": 10,
        },
    )
    assert a.status_code == 201
    b = await client.post(
        f"/api/v1/merchant/spus/{spu['id']}/skus",
        headers=m_headers,
        json={
            "sku_code": "A-2",
            "specs": {"color": "蓝", "size": "M"},
            "price_cents": 12900,
            "stock": 5,
        },
    )
    assert b.status_code == 201

    detail = await client.get(f"/api/v1/merchant/spus/{spu['id']}", headers=m_headers)
    d = detail.json()["data"]
    assert d["min_price_cents"] == 9900
    assert d["max_price_cents"] == 12900

    # update SKU B price → range updates
    b_id = b.json()["data"]["id"]
    upd = await client.patch(
        f"/api/v1/merchant/spus/{spu['id']}/skus/{b_id}",
        headers=m_headers,
        json={"price_cents": 15900, "original_price_cents": 19900},
    )
    assert upd.json()["data"]["price_cents"] == 15900

    detail2 = await client.get(f"/api/v1/merchant/spus/{spu['id']}", headers=m_headers)
    assert detail2.json()["data"]["max_price_cents"] == 15900

    # delete SKU A → min becomes 15900
    a_id = a.json()["data"]["id"]
    await client.delete(f"/api/v1/merchant/spus/{spu['id']}/skus/{a_id}", headers=m_headers)
    detail3 = await client.get(f"/api/v1/merchant/spus/{spu['id']}", headers=m_headers)
    assert detail3.json()["data"]["min_price_cents"] == 15900


@pytest.mark.asyncio
async def test_sku_specs_must_be_subset(
    client: AsyncClient,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    _ = seed_admins
    m_headers = await _merchant_headers(client, seed_merchant_account)
    spu = await _mk_spu(client, m_headers, seed_catalog)

    bad = await client.post(
        f"/api/v1/merchant/spus/{spu['id']}/skus",
        headers=m_headers,
        json={
            "sku_code": "BAD",
            "specs": {"weight": "1kg"},  # not in spec_axes
            "price_cents": 1000,
            "stock": 1,
        },
    )
    assert bad.json()["code"] == 5001


@pytest.mark.asyncio
async def test_sku_code_unique_per_spu(
    client: AsyncClient,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    _ = seed_admins
    m_headers = await _merchant_headers(client, seed_merchant_account)
    spu = await _mk_spu(client, m_headers, seed_catalog)

    ok = await client.post(
        f"/api/v1/merchant/spus/{spu['id']}/skus",
        headers=m_headers,
        json={
            "sku_code": "SAME",
            "specs": {"color": "红"},
            "price_cents": 1000,
            "stock": 1,
        },
    )
    assert ok.status_code == 201

    dup = await client.post(
        f"/api/v1/merchant/spus/{spu['id']}/skus",
        headers=m_headers,
        json={
            "sku_code": "SAME",
            "specs": {"color": "蓝"},
            "price_cents": 2000,
            "stock": 1,
        },
    )
    assert dup.json()["code"] == 8002
