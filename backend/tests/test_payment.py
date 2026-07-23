"""Payment-session tests — contract §9."""

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


async def _u_headers(client: AsyncClient, seed_user: User) -> dict[str, str]:
    tokens = await login_user_get_tokens(client, seed_user.phone or "", "Test1234")
    return bearer(tokens["access_token"])


async def _seed_order(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, str]]:
    u_headers = await _u_headers(client, seed_user)
    account, _ = seed_merchant_account
    m_headers = bearer(
        (await login_merchant_get_tokens(client, account.login_name, "Merch1234"))["access_token"]
    )
    a_headers = bearer(
        (await login_admin_get_tokens(client, "super", "super_pwd_change_me"))["access_token"]
    )
    _ = seed_admins

    spu = (
        await client.post(
            "/api/v1/merchant/spus",
            headers=m_headers,
            json={
                "category_id": seed_catalog["leaf"].id,
                "brand_id": seed_catalog["brand"].id,
                "title": "支付测试",
                "main_image": "spu/p.jpg",
                "spec_axes": ["color"],
            },
        )
    ).json()["data"]
    sku = (
        await client.post(
            f"/api/v1/merchant/spus/{spu['id']}/skus",
            headers=m_headers,
            json={
                "sku_code": "P-1",
                "specs": {"color": "红"},
                "price_cents": 3000,
                "stock": 5,
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
    return order, u_headers


@pytest.mark.asyncio
async def test_create_session_idempotent(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    order, u_headers = await _seed_order(
        client, seed_user, seed_admins, seed_merchant_account, seed_catalog
    )
    r1 = await client.post(
        f"/api/v1/user/orders/{order['id']}/pay",
        headers={**u_headers, "Idempotency-Key": str(uuid.uuid4())},
        json={"channel": "mock_wechat"},
    )
    r2 = await client.post(
        f"/api/v1/user/orders/{order['id']}/pay",
        headers={**u_headers, "Idempotency-Key": str(uuid.uuid4())},
        json={"channel": "mock_wechat"},
    )
    assert r1.json()["data"]["session_id"] == r2.json()["data"]["session_id"]
    assert r1.json()["data"]["mock_pay_url"] is not None


@pytest.mark.asyncio
async def test_mock_succeed_transitions_order_to_paid(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    order, u_headers = await _seed_order(
        client, seed_user, seed_admins, seed_merchant_account, seed_catalog
    )
    pay = await client.post(
        f"/api/v1/user/orders/{order['id']}/pay",
        headers={**u_headers, "Idempotency-Key": str(uuid.uuid4())},
        json={"channel": "mock_alipay"},
    )
    session_id = pay.json()["data"]["session_id"]
    ms = await client.post(
        f"/api/v1/user/payment-sessions/{session_id}/mock-succeed", headers=u_headers
    )
    assert ms.json()["data"]["order_status"] == "paid"
    # Fetch order detail confirms status.
    det = await client.get(f"/api/v1/user/orders/{order['id']}", headers=u_headers)
    assert det.json()["data"]["status"] == "paid"


@pytest.mark.asyncio
async def test_mock_fail_keeps_order_pending(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    order, u_headers = await _seed_order(
        client, seed_user, seed_admins, seed_merchant_account, seed_catalog
    )
    pay = await client.post(
        f"/api/v1/user/orders/{order['id']}/pay",
        headers={**u_headers, "Idempotency-Key": str(uuid.uuid4())},
        json={"channel": "mock_alipay"},
    )
    sid = pay.json()["data"]["session_id"]
    mf = await client.post(f"/api/v1/user/payment-sessions/{sid}/mock-fail", headers=u_headers)
    assert mf.json()["data"]["session_status"] == "failed"
    # order still pending_payment
    det = await client.get(f"/api/v1/user/orders/{order['id']}", headers=u_headers)
    assert det.json()["data"]["status"] == "pending_payment"
