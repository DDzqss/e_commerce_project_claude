"""Order preview + create tests — contract §8."""

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


async def _user_headers(client: AsyncClient, seed_user: User) -> dict[str, str]:
    tokens = await login_user_get_tokens(client, seed_user.phone or "", "Test1234")
    return bearer(tokens["access_token"])


async def _seed_sku_and_cart(
    client: AsyncClient,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
    u_headers: dict[str, str],
    *,
    price_cents: int = 5000,
    stock: int = 20,
    quantity: int = 2,
    sku_code: str = "OP-1",
    title: str = "订单测试",
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    """Create an approved SPU/SKU, add it to cart, return (spu, sku, cart_item)."""
    _ = seed_admins
    account, _shop = seed_merchant_account
    m_headers = bearer(
        (await login_merchant_get_tokens(client, account.login_name, "Merch1234"))["access_token"]
    )
    a_headers = bearer(
        (await login_admin_get_tokens(client, "super", "super_pwd_change_me"))["access_token"]
    )
    spu = (
        await client.post(
            "/api/v1/merchant/spus",
            headers=m_headers,
            json={
                "category_id": seed_catalog["leaf"].id,
                "brand_id": seed_catalog["brand"].id,
                "title": title,
                "main_image": "spu/order.jpg",
                "spec_axes": ["color"],
            },
        )
    ).json()["data"]
    sku = (
        await client.post(
            f"/api/v1/merchant/spus/{spu['id']}/skus",
            headers=m_headers,
            json={
                "sku_code": sku_code,
                "specs": {"color": "红"},
                "price_cents": price_cents,
                "stock": stock,
            },
        )
    ).json()["data"]
    await client.post(f"/api/v1/merchant/spus/{spu['id']}/submit-review", headers=m_headers)
    await client.post(f"/api/v1/admin/spus/{spu['id']}/approve", headers=a_headers, json={})
    cart_item = (
        await client.post(
            "/api/v1/user/cart/items",
            headers=u_headers,
            json={"sku_id": sku["id"], "quantity": quantity},
        )
    ).json()["data"]
    return spu, sku, cart_item


async def _make_address(client: AsyncClient, u_headers: dict[str, str]) -> int:
    resp = await client.post(
        "/api/v1/user/addresses",
        headers=u_headers,
        json={
            "receiver_name": "张三",
            "receiver_phone": "13800000001",
            "province": "浙江省",
            "city": "杭州市",
            "district": "西湖区",
            "detail": "文三路 100 号",
            "is_default": True,
        },
    )
    return int(resp.json()["data"]["id"])


@pytest.mark.asyncio
async def test_preview_and_create_happy_path(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    u_headers = await _user_headers(client, seed_user)
    _spu, sku, cart_item = await _seed_sku_and_cart(
        client, seed_admins, seed_merchant_account, seed_catalog, u_headers
    )
    addr_id = await _make_address(client, u_headers)

    prev = await client.post(
        "/api/v1/user/orders/preview",
        headers=u_headers,
        json={"cart_item_ids": [cart_item["id"]], "address_id": addr_id},
    )
    body = prev.json()["data"]
    assert len(body["groups_by_shop"]) == 1
    assert body["grand_total_cents"] == sku["price_cents"] * 2
    assert body["warnings"] == []

    idem = str(uuid.uuid4())
    cr = await client.post(
        "/api/v1/user/orders",
        headers={**u_headers, "Idempotency-Key": idem},
        json={
            "cart_item_ids": [cart_item["id"]],
            "address_id": addr_id,
            "user_note": "工作日送达",
        },
    )
    assert cr.status_code == 201
    orders = cr.json()["data"]["orders"]
    assert len(orders) == 1
    order = orders[0]
    assert order["total_cents"] == sku["price_cents"] * 2

    # Second call with same idempotency-key: returns same orders, no new insert.
    cr_again = await client.post(
        "/api/v1/user/orders",
        headers={**u_headers, "Idempotency-Key": idem},
        json={
            "cart_item_ids": [cart_item["id"]],
            "address_id": addr_id,
        },
    )
    orders2 = cr_again.json()["data"]["orders"]
    assert [o["id"] for o in orders2] == [order["id"]]

    # Cart should be empty afterwards.
    cart = (await client.get("/api/v1/user/cart", headers=u_headers)).json()["data"]
    assert cart["groups"] == []


@pytest.mark.asyncio
async def test_create_missing_idempotency_key(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    u_headers = await _user_headers(client, seed_user)
    _spu, _sku, cart_item = await _seed_sku_and_cart(
        client, seed_admins, seed_merchant_account, seed_catalog, u_headers
    )
    addr_id = await _make_address(client, u_headers)
    resp = await client.post(
        "/api/v1/user/orders",
        headers=u_headers,  # no Idempotency-Key
        json={"cart_item_ids": [cart_item["id"]], "address_id": addr_id},
    )
    assert resp.json()["code"] == 15001


@pytest.mark.asyncio
async def test_create_out_of_stock_rolls_back(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    u_headers = await _user_headers(client, seed_user)
    _spu, sku, _ci = await _seed_sku_and_cart(
        client,
        seed_admins,
        seed_merchant_account,
        seed_catalog,
        u_headers,
        stock=2,
        quantity=2,
    )
    # Consume the stock via a direct catalogue-side write.
    from sqlalchemy import update

    from app.core import database as core_db
    from app.models.sku import SKU

    async with core_db.async_session_factory() as s:
        await s.execute(update(SKU).where(SKU.id == sku["id"]).values(stock=1))
        await s.commit()

    addr_id = await _make_address(client, u_headers)
    # Re-fetch our cart-item id
    cart = (await client.get("/api/v1/user/cart", headers=u_headers)).json()["data"]
    ci_id = cart["groups"][0]["items"][0]["id"]
    idem = str(uuid.uuid4())
    resp = await client.post(
        "/api/v1/user/orders",
        headers={**u_headers, "Idempotency-Key": idem},
        json={"cart_item_ids": [ci_id], "address_id": addr_id},
    )
    # Preview would flag stock_short → create sees "no valid items" (13006).
    assert resp.json()["code"] == 13006


@pytest.mark.asyncio
async def test_create_wrong_address_returns_13007(
    client: AsyncClient,
    seed_user: User,
    seed_second_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    u_headers = await _user_headers(client, seed_user)
    other_headers = bearer(
        (await login_user_get_tokens(client, seed_second_user.phone or "", "Test1234"))[
            "access_token"
        ]
    )
    _spu, _sku, ci = await _seed_sku_and_cart(
        client, seed_admins, seed_merchant_account, seed_catalog, u_headers
    )
    other_addr_id = await _make_address(client, other_headers)
    idem = str(uuid.uuid4())
    resp = await client.post(
        "/api/v1/user/orders",
        headers={**u_headers, "Idempotency-Key": idem},
        json={"cart_item_ids": [ci["id"]], "address_id": other_addr_id},
    )
    assert resp.json()["code"] == 13007
