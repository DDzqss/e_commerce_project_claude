"""Merchant order endpoint tests — contract §10."""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from httpx import AsyncClient

from app.models.admin_user import AdminUser
from app.models.merchant import MerchantAccount, Shop
from app.models.user import User
from tests.conftest import (
    bearer,
    login_admin_get_tokens,
    login_merchant_get_tokens,
    login_user_get_tokens,
)


async def _paid_order(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
    *,
    quantity: int = 1,
    stock: int = 5,
) -> tuple[dict[str, Any], dict[str, str], dict[str, str]]:
    _ = seed_admins
    account, _shop = seed_merchant_account
    u_tokens = await login_user_get_tokens(client, seed_user.phone or "", "Test1234")
    u_headers = bearer(u_tokens["access_token"])
    m_tokens = await login_merchant_get_tokens(client, account.login_name, "Merch1234")
    m_headers = bearer(m_tokens["access_token"])
    a_tokens = await login_admin_get_tokens(client, "super", "super_pwd_change_me")
    a_headers = bearer(a_tokens["access_token"])

    spu = (
        await client.post(
            "/api/v1/merchant/spus",
            headers=m_headers,
            json={
                "category_id": seed_catalog["leaf"].id,
                "brand_id": seed_catalog["brand"].id,
                "title": "商家测试",
                "main_image": "spu/mo.jpg",
                "spec_axes": ["color"],
            },
        )
    ).json()["data"]
    sku = (
        await client.post(
            f"/api/v1/merchant/spus/{spu['id']}/skus",
            headers=m_headers,
            json={
                "sku_code": f"MO-{uuid.uuid4().hex[:6]}",
                "specs": {"color": "红"},
                "price_cents": 2000,
                "stock": stock,
            },
        )
    ).json()["data"]
    await client.post(f"/api/v1/merchant/spus/{spu['id']}/submit-review", headers=m_headers)
    await client.post(f"/api/v1/admin/spus/{spu['id']}/approve", headers=a_headers, json={})
    ci = (
        await client.post(
            "/api/v1/user/cart/items",
            headers=u_headers,
            json={"sku_id": sku["id"], "quantity": quantity},
        )
    ).json()["data"]
    addr = (
        await client.post(
            "/api/v1/user/addresses",
            headers=u_headers,
            json={
                "receiver_name": "王五",
                "receiver_phone": "13800000009",
                "province": "北京市",
                "city": "北京市",
                "district": "海淀区",
                "detail": "中关村 1 号",
                "is_default": True,
            },
        )
    ).json()["data"]
    order = (
        await client.post(
            "/api/v1/user/orders",
            headers={**u_headers, "Idempotency-Key": str(uuid.uuid4())},
            json={"cart_item_ids": [ci["id"]], "address_id": addr["id"]},
        )
    ).json()["data"]["orders"][0]
    pay = await client.post(
        f"/api/v1/user/orders/{order['id']}/pay",
        headers={**u_headers, "Idempotency-Key": str(uuid.uuid4())},
        json={"channel": "mock_alipay"},
    )
    await client.post(
        f"/api/v1/user/payment-sessions/{pay.json()['data']['session_id']}/mock-succeed",
        headers=u_headers,
    )
    return order, u_headers, m_headers


@pytest.mark.asyncio
async def test_merchant_list_only_own_shop(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    order, _u, m_headers = await _paid_order(
        client, seed_user, seed_admins, seed_merchant_account, seed_catalog
    )
    resp = await client.get("/api/v1/merchant/orders?status=paid", headers=m_headers)
    ids = [x["id"] for x in resp.json()["data"]["items"]]
    assert order["id"] in ids


@pytest.mark.asyncio
async def test_merchant_ship_bad_tracking_no(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    order, _u, m_headers = await _paid_order(
        client, seed_user, seed_admins, seed_merchant_account, seed_catalog
    )
    resp = await client.post(
        f"/api/v1/merchant/orders/{order['id']}/ship",
        headers=m_headers,
        json={"carrier": "SF", "tracking_no": "bad!!"},
    )
    assert resp.json()["code"] == 5001  # validation


@pytest.mark.asyncio
async def test_merchant_cancel_paid_releases_stock(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    order, _u, m_headers = await _paid_order(
        client, seed_user, seed_admins, seed_merchant_account, seed_catalog
    )
    resp = await client.post(
        f"/api/v1/merchant/orders/{order['id']}/cancel",
        headers=m_headers,
        json={"cancel_note": "缺货抱歉"},
    )
    assert resp.json()["data"]["status"] == "cancelled"


@pytest.mark.asyncio
async def test_merchant_note_and_stats(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    order, _u, m_headers = await _paid_order(
        client, seed_user, seed_admins, seed_merchant_account, seed_catalog
    )
    note = await client.post(
        f"/api/v1/merchant/orders/{order['id']}/note",
        headers=m_headers,
        json={"note": "感谢下单"},
    )
    assert note.json()["data"]["merchant_note"] == "感谢下单"

    stats = await client.get("/api/v1/merchant/orders/stats/summary", headers=m_headers)
    body = stats.json()["data"]
    assert body["paid_pending_ship_count"] >= 1
