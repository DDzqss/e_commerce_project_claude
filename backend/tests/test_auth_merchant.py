"""Merchant login/refresh/logout/change-password tests."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.models.merchant import MerchantAccount, Shop
from tests.conftest import bearer, login_merchant_get_tokens


@pytest.mark.asyncio
async def test_merchant_can_login_and_read_me(
    client: AsyncClient,
    seed_merchant_account: tuple[MerchantAccount, Shop],
) -> None:
    account, shop = seed_merchant_account
    tokens = await login_merchant_get_tokens(client, account.login_name, "Merch1234")

    resp = await client.get("/api/v1/merchant/me", headers=bearer(tokens["access_token"]))
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["account"]["login_name"] == account.login_name
    assert body["data"]["shop"]["id"] == shop.id
    assert "merchant:shop:update" in body["data"]["permissions"]


@pytest.mark.asyncio
async def test_merchant_can_change_password(
    client: AsyncClient,
    seed_merchant_account: tuple[MerchantAccount, Shop],
) -> None:
    account, _ = seed_merchant_account
    tokens = await login_merchant_get_tokens(client, account.login_name, "Merch1234")

    r = await client.post(
        "/api/v1/merchant/auth/change-password",
        headers=bearer(tokens["access_token"]),
        json={"old_password": "Merch1234", "new_password": "NewMerch9"},
    )
    assert r.json()["code"] == 0

    # old password no longer works
    fail = await client.post(
        "/api/v1/merchant/auth/login",
        json={"login_name": account.login_name, "password": "Merch1234"},
    )
    assert fail.json()["code"] == 1003


@pytest.mark.asyncio
async def test_merchant_shop_owner_can_update_shop(
    client: AsyncClient,
    seed_merchant_account: tuple[MerchantAccount, Shop],
) -> None:
    account, shop = seed_merchant_account
    tokens = await login_merchant_get_tokens(client, account.login_name, "Merch1234")

    r = await client.patch(
        "/api/v1/merchant/me/shop",
        headers=bearer(tokens["access_token"]),
        json={"description": "更新后的描述"},
    )
    body = r.json()
    assert body["code"] == 0
    assert body["data"]["description"] == "更新后的描述"
    assert body["data"]["id"] == shop.id


@pytest.mark.asyncio
async def test_merchant_bad_credentials(
    client: AsyncClient,
    seed_merchant_account: tuple[MerchantAccount, Shop],
) -> None:
    account, _ = seed_merchant_account
    resp = await client.post(
        "/api/v1/merchant/auth/login",
        json={"login_name": account.login_name, "password": "wrong"},
    )
    assert resp.json()["code"] == 1003
