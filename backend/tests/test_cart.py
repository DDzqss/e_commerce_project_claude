"""User cart tests — contract §7."""

from __future__ import annotations

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


async def _merchant_headers(
    client: AsyncClient, seed_merchant_account: tuple[MerchantAccount, Shop]
) -> dict[str, str]:
    account, _ = seed_merchant_account
    tokens = await login_merchant_get_tokens(client, account.login_name, "Merch1234")
    return bearer(tokens["access_token"])


async def _seed_approved_sku(
    client: AsyncClient,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
    *,
    title: str = "购物测试商品",
    sku_code: str = "C-1",
    price_cents: int = 5000,
    stock: int = 30,
) -> dict[str, Any]:
    """Create one approved SPU + SKU and return the SKU row."""
    m_headers = await _merchant_headers(client, seed_merchant_account)
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
                "title": title,
                "main_image": "spu/cart.jpg",
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
    return sku


@pytest.mark.asyncio
async def test_add_and_get_cart_grouped(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    u_headers = await _user_headers(client, seed_user)
    sku = await _seed_approved_sku(client, seed_admins, seed_merchant_account, seed_catalog)
    add_resp = await client.post(
        "/api/v1/user/cart/items",
        headers=u_headers,
        json={"sku_id": sku["id"], "quantity": 2},
    )
    assert add_resp.json()["code"] == 0
    assert add_resp.json()["data"]["quantity"] == 2

    # Add again — quantity should accumulate.
    add_again = await client.post(
        "/api/v1/user/cart/items",
        headers=u_headers,
        json={"sku_id": sku["id"], "quantity": 3},
    )
    assert add_again.json()["data"]["quantity"] == 5

    cart = (await client.get("/api/v1/user/cart", headers=u_headers)).json()["data"]
    assert len(cart["groups"]) == 1
    grp = cart["groups"][0]
    assert grp["items"][0]["status"] == "valid"
    assert cart["total_cents_selected"] == 5 * sku["price_cents"]
    assert cart["total_selected_count"] == 5


@pytest.mark.asyncio
async def test_cart_add_exceeds_stock(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    u_headers = await _user_headers(client, seed_user)
    sku = await _seed_approved_sku(
        client, seed_admins, seed_merchant_account, seed_catalog, stock=3
    )
    resp = await client.post(
        "/api/v1/user/cart/items",
        headers=u_headers,
        json={"sku_id": sku["id"], "quantity": 5},
    )
    assert resp.json()["code"] == 12003


@pytest.mark.asyncio
async def test_cart_update_batch_delete_and_select_all(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    u_headers = await _user_headers(client, seed_user)
    sku_a = await _seed_approved_sku(
        client, seed_admins, seed_merchant_account, seed_catalog, title="A", sku_code="CT-A"
    )
    sku_b = await _seed_approved_sku(
        client, seed_admins, seed_merchant_account, seed_catalog, title="B", sku_code="CT-B"
    )
    item_a = (
        await client.post(
            "/api/v1/user/cart/items",
            headers=u_headers,
            json={"sku_id": sku_a["id"], "quantity": 1},
        )
    ).json()["data"]
    item_b = (
        await client.post(
            "/api/v1/user/cart/items",
            headers=u_headers,
            json={"sku_id": sku_b["id"], "quantity": 2},
        )
    ).json()["data"]

    upd = await client.patch(
        f"/api/v1/user/cart/items/{item_a['id']}",
        headers=u_headers,
        json={"quantity": 4, "selected": False},
    )
    assert upd.json()["data"]["quantity"] == 4
    assert upd.json()["data"]["selected"] is False

    sa = await client.post(
        "/api/v1/user/cart/select-all", headers=u_headers, json={"selected": True}
    )
    assert sa.json()["data"]["changed"] == 2

    bd = await client.post(
        "/api/v1/user/cart/items/batch-delete",
        headers=u_headers,
        json={"ids": [item_a["id"], item_b["id"]]},
    )
    assert bd.json()["data"]["removed"] == 2
    empty = (await client.get("/api/v1/user/cart", headers=u_headers)).json()["data"]
    assert empty["groups"] == []


@pytest.mark.asyncio
async def test_cart_clear_invalid_after_offshelf(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
    db_session: object,
) -> None:
    from app.models.product import SPU, SPUStatus

    u_headers = await _user_headers(client, seed_user)
    sku = await _seed_approved_sku(client, seed_admins, seed_merchant_account, seed_catalog)
    await client.post(
        "/api/v1/user/cart/items",
        headers=u_headers,
        json={"sku_id": sku["id"], "quantity": 1},
    )

    # Force the SPU off shelf by direct DB write (simplest path in this test).
    from sqlalchemy import update

    session = db_session  # type: ignore[assignment]
    await session.execute(  # type: ignore[attr-defined]
        update(SPU).where(SPU.id == sku["spu_id"]).values(status=SPUStatus.OFF_SHELF)
    )
    await session.commit()  # type: ignore[attr-defined]

    cart = (await client.get("/api/v1/user/cart", headers=u_headers)).json()["data"]
    assert cart["invalid_count"] == 1

    removed = await client.delete("/api/v1/user/cart/invalid", headers=u_headers)
    assert removed.json()["data"]["removed"] == 1
    empty = (await client.get("/api/v1/user/cart", headers=u_headers)).json()["data"]
    assert empty["invalid_count"] == 0
