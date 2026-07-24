"""Admin login + /me RBAC tests."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.models.admin_user import AdminUser
from tests.conftest import bearer, login_admin_get_tokens


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("role_key", "username", "password"),
    [
        ("SUPER_ADMIN", "super", "super_pwd_change_me"),
        ("BUSINESS_ADMIN", "biz01", "biz_pwd_change_me"),
        ("CUSTOMER_SERVICE_ADMIN", "cs01", "cs_pwd_change_me"),
        ("TECH_ADMIN", "tech01", "tech_pwd_change_me"),
    ],
)
async def test_all_admins_can_login(
    client: AsyncClient,
    seed_admins: dict[str, AdminUser],
    role_key: str,
    username: str,
    password: str,
) -> None:
    _ = seed_admins  # fixture side-effect
    tokens = await login_admin_get_tokens(client, username, password)
    assert tokens["access_token"]

    me = await client.get("/api/v1/admin/me", headers=bearer(tokens["access_token"]))
    body = me.json()
    assert body["code"] == 0
    assert body["data"]["admin"]["role"] == role_key
    assert "permissions" in body["data"]


@pytest.mark.asyncio
async def test_admin_bad_credentials(
    client: AsyncClient, seed_admins: dict[str, AdminUser]
) -> None:
    _ = seed_admins
    resp = await client.post(
        "/api/v1/admin/auth/login",
        json={"username": "super", "password": "bad_password"},
    )
    assert resp.json()["code"] == 1003


@pytest.mark.asyncio
async def test_admin_refresh_and_logout(
    client: AsyncClient, seed_admins: dict[str, AdminUser]
) -> None:
    _ = seed_admins
    tokens = await login_admin_get_tokens(client, "super", "super_pwd_change_me")

    r = await client.post(
        "/api/v1/admin/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert r.json()["code"] == 0
    new_tokens = r.json()["data"]

    lo = await client.post(
        "/api/v1/admin/auth/logout",
        headers=bearer(new_tokens["access_token"]),
        json={"refresh_token": new_tokens["refresh_token"]},
    )
    assert lo.json()["code"] == 0
