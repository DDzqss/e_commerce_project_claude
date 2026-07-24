"""End-to-end tests for the User auth flow."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import bearer, login_user_get_tokens


@pytest.mark.asyncio
async def test_register_login_refresh_logout(client: AsyncClient) -> None:
    # register
    resp = await client.post(
        "/api/v1/user/auth/register",
        json={"phone": "13911112222", "password": "GoodPass1"},
    )
    body = resp.json()
    assert resp.status_code == 201
    assert body["code"] == 0
    data = body["data"]
    assert data["user"]["phone"] == "13911112222"
    assert data["access_token"]
    assert data["refresh_token"]
    old_refresh = data["refresh_token"]

    # login
    tokens = await login_user_get_tokens(client, "13911112222", "GoodPass1")
    assert tokens["access_token"]

    # refresh (rotates the refresh)
    r = await client.post(
        "/api/v1/user/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    r_body = r.json()
    assert r_body["code"] == 0
    new_tokens = r_body["data"]
    assert new_tokens["refresh_token"] != tokens["refresh_token"]

    # old refresh no longer works
    r_old = await client.post(
        "/api/v1/user/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert r_old.json()["code"] == 1005

    # the very first refresh from register is likewise no longer valid
    # after we've used login to generate a new pair (register/login are
    # independent; both work).
    r_first = await client.post("/api/v1/user/auth/refresh", json={"refresh_token": old_refresh})
    assert r_first.json()["code"] == 0

    # logout revokes the current refresh
    logout_resp = await client.post(
        "/api/v1/user/auth/logout",
        headers=bearer(new_tokens["access_token"]),
        json={"refresh_token": new_tokens["refresh_token"]},
    )
    assert logout_resp.json()["code"] == 0

    r_after_logout = await client.post(
        "/api/v1/user/auth/refresh", json={"refresh_token": new_tokens["refresh_token"]}
    )
    assert r_after_logout.json()["code"] == 1005


@pytest.mark.asyncio
async def test_register_rejects_duplicate_phone(client: AsyncClient) -> None:
    await client.post(
        "/api/v1/user/auth/register",
        json={"phone": "13912345678", "password": "GoodPass1"},
    )
    resp = await client.post(
        "/api/v1/user/auth/register",
        json={"phone": "13912345678", "password": "OtherPass2"},
    )
    body = resp.json()
    assert body["code"] == 2002


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient) -> None:
    await client.post(
        "/api/v1/user/auth/register",
        json={"phone": "13900001111", "password": "GoodPass1"},
    )
    resp = await client.post(
        "/api/v1/user/auth/login",
        json={"identifier": "13900001111", "password": "BadPass9"},
    )
    body = resp.json()
    assert body["code"] == 1003


@pytest.mark.asyncio
async def test_login_unknown_identifier_uses_same_code(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/user/auth/login",
        json={"identifier": "13800009999", "password": "AnyPass1"},
    )
    body = resp.json()
    # Contract §5.1 merges account-not-found and wrong-password into 1003.
    assert body["code"] == 1003


@pytest.mark.asyncio
async def test_register_requires_phone_or_email(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/user/auth/register",
        json={"password": "GoodPass1"},
    )
    body = resp.json()
    assert body["code"] == 5001


@pytest.mark.asyncio
async def test_me_endpoint(client: AsyncClient) -> None:
    reg = await client.post(
        "/api/v1/user/auth/register",
        json={"phone": "13900002222", "password": "GoodPass1"},
    )
    access = reg.json()["data"]["access_token"]
    resp = await client.get("/api/v1/user/me", headers=bearer(access))
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["user"]["phone"] == "13900002222"
    assert body["data"]["merchant_account_ids"] == []
    assert body["data"]["pending_application_id"] is None


@pytest.mark.asyncio
async def test_change_password_then_old_password_fails(client: AsyncClient) -> None:
    reg = await client.post(
        "/api/v1/user/auth/register",
        json={"phone": "13900003333", "password": "GoodPass1"},
    )
    access = reg.json()["data"]["access_token"]

    r = await client.post(
        "/api/v1/user/me/change-password",
        headers=bearer(access),
        json={"old_password": "GoodPass1", "new_password": "NewPass9"},
    )
    assert r.json()["code"] == 0

    fail = await client.post(
        "/api/v1/user/auth/login",
        json={"identifier": "13900003333", "password": "GoodPass1"},
    )
    assert fail.json()["code"] == 1003

    ok = await client.post(
        "/api/v1/user/auth/login",
        json={"identifier": "13900003333", "password": "NewPass9"},
    )
    assert ok.json()["code"] == 0
