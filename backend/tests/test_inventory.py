"""Inventory adjust / log tests — contract §10."""

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


async def _mk_spu_and_sku(
    client: AsyncClient,
    m_headers: dict[str, str],
    seed_catalog: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    spu = (
        await client.post(
            "/api/v1/merchant/spus",
            headers=m_headers,
            json={
                "category_id": seed_catalog["leaf"].id,
                "brand_id": seed_catalog["brand"].id,
                "title": "库存测试",
                "main_image": "spu/x.jpg",
                "spec_axes": ["color"],
            },
        )
    ).json()["data"]
    sku = (
        await client.post(
            f"/api/v1/merchant/spus/{spu['id']}/skus",
            headers=m_headers,
            json={
                "sku_code": "INV-1",
                "specs": {"color": "红"},
                "price_cents": 1000,
                "stock": 20,
            },
        )
    ).json()["data"]
    return spu, sku


@pytest.mark.asyncio
async def test_adjust_writes_log_and_updates_stock(
    client: AsyncClient,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    _ = seed_admins
    m_headers = await _merchant_headers(client, seed_merchant_account)
    _spu, sku = await _mk_spu_and_sku(client, m_headers, seed_catalog)

    up = await client.post(
        f"/api/v1/merchant/skus/{sku['id']}/inventory/adjust",
        headers=m_headers,
        json={"delta": 30, "reason": "purchase", "note": "补货"},
    )
    log = up.json()["data"]
    assert log["delta"] == 30
    assert log["balance_after"] == 50
    assert log["reason"] == "purchase"
    assert log["operator_type"] == "merchant"

    logs = (
        await client.get(f"/api/v1/merchant/skus/{sku['id']}/inventory-logs", headers=m_headers)
    ).json()["data"]
    # There should be initial log (20) + adjust log (30) = 2 rows total.
    assert logs["total"] == 2


@pytest.mark.asyncio
async def test_negative_adjust_cannot_go_below_zero(
    client: AsyncClient,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    _ = seed_admins
    m_headers = await _merchant_headers(client, seed_merchant_account)
    _spu, sku = await _mk_spu_and_sku(client, m_headers, seed_catalog)

    resp = await client.post(
        f"/api/v1/merchant/skus/{sku['id']}/inventory/adjust",
        headers=m_headers,
        json={"delta": -100, "reason": "adjust"},
    )
    assert resp.json()["code"] == 9504


@pytest.mark.asyncio
async def test_zero_delta_rejected(
    client: AsyncClient,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    _ = seed_admins
    m_headers = await _merchant_headers(client, seed_merchant_account)
    _spu, sku = await _mk_spu_and_sku(client, m_headers, seed_catalog)

    resp = await client.post(
        f"/api/v1/merchant/skus/{sku['id']}/inventory/adjust",
        headers=m_headers,
        json={"delta": 0, "reason": "adjust"},
    )
    assert resp.json()["code"] == 9502
