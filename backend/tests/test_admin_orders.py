"""Admin order endpoint tests — contract §11."""

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


async def _login_admin(client: AsyncClient) -> dict[str, str]:
    return bearer(
        (await login_admin_get_tokens(client, "super", "super_pwd_change_me"))["access_token"]
    )


async def _seed_order_paid(
    client: AsyncClient,
    seed_user: User,
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
    a_headers: dict[str, str],
    *,
    sku_suffix: str = "A",
) -> dict[str, Any]:
    account, _ = seed_merchant_account
    u_headers = bearer(
        (await login_user_get_tokens(client, seed_user.phone or "", "Test1234"))["access_token"]
    )
    m_headers = bearer(
        (await login_merchant_get_tokens(client, account.login_name, "Merch1234"))["access_token"]
    )
    spu = (
        await client.post(
            "/api/v1/merchant/spus",
            headers=m_headers,
            json={
                "category_id": seed_catalog["leaf"].id,
                "brand_id": seed_catalog["brand"].id,
                "title": f"管理员测试-{sku_suffix}",
                "main_image": "spu/ad.jpg",
                "spec_axes": ["color"],
            },
        )
    ).json()["data"]
    sku = (
        await client.post(
            f"/api/v1/merchant/spus/{spu['id']}/skus",
            headers=m_headers,
            json={
                "sku_code": f"AD-{sku_suffix}",
                "specs": {"color": "红"},
                "price_cents": 1000,
                "stock": 10,
            },
        )
    ).json()["data"]
    await client.post(f"/api/v1/merchant/spus/{spu['id']}/submit-review", headers=m_headers)
    await client.post(f"/api/v1/admin/spus/{spu['id']}/approve", headers=a_headers, json={})
    ci = (
        await client.post(
            "/api/v1/user/cart/items",
            headers=u_headers,
            json={"sku_id": sku["id"], "quantity": 1},
        )
    ).json()["data"]
    addr = (
        await client.post(
            "/api/v1/user/addresses",
            headers=u_headers,
            json={
                "receiver_name": "李四",
                "receiver_phone": "13800000002",
                "province": "上海市",
                "city": "上海市",
                "district": "浦东新区",
                "detail": "东方路 1000 号",
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
    return order


@pytest.mark.asyncio
async def test_admin_list_and_overview(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    _ = seed_admins
    a_headers = await _login_admin(client)
    order = await _seed_order_paid(
        client, seed_user, seed_merchant_account, seed_catalog, a_headers
    )
    lst = await client.get("/api/v1/admin/orders", headers=a_headers)
    ids = [x["id"] for x in lst.json()["data"]["items"]]
    assert order["id"] in ids

    ov = await client.get("/api/v1/admin/orders/stats/overview", headers=a_headers)
    body = ov.json()["data"]
    assert body["pending_ship_count"] >= 1
    assert body["orders_today_gmv_cents"] >= 1000


@pytest.mark.asyncio
async def test_admin_intervene_cancel_and_note(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    _ = seed_admins
    a_headers = await _login_admin(client)
    order = await _seed_order_paid(
        client, seed_user, seed_merchant_account, seed_catalog, a_headers
    )
    note = await client.post(
        f"/api/v1/admin/orders/{order['id']}/note",
        headers=a_headers,
        json={"note": "内部备注"},
    )
    assert note.json()["data"]["admin_note"] == "内部备注"

    canc = await client.post(
        f"/api/v1/admin/orders/{order['id']}/cancel",
        headers=a_headers,
        json={"cancel_note": "违规订单"},
    )
    assert canc.json()["data"]["status"] == "cancelled"
    assert canc.json()["data"]["cancel_reason"] == "admin_intervene"


@pytest.mark.asyncio
async def test_admin_logistics_simulate(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    _ = seed_admins
    a_headers = await _login_admin(client)
    order = await _seed_order_paid(
        client, seed_user, seed_merchant_account, seed_catalog, a_headers
    )
    account, _ = seed_merchant_account
    m_headers = bearer(
        (await login_merchant_get_tokens(client, account.login_name, "Merch1234"))["access_token"]
    )
    await client.post(
        f"/api/v1/merchant/orders/{order['id']}/ship",
        headers=m_headers,
        json={"carrier": "SF", "tracking_no": "SF1234567890"},
    )

    resp = await client.post(
        f"/api/v1/admin/orders/{order['id']}/logistics/simulate",
        headers=a_headers,
        json={"event_type": "arrived_city", "description": "已到达上海分拨中心"},
    )
    events = resp.json()["data"]["shipment_events"]
    types = [e["event_type"] for e in events]
    assert "arrived_city" in types
