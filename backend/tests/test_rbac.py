"""RBAC / permission-matrix tests."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.models.admin_user import AdminUser
from tests.conftest import bearer, login_admin_get_tokens


@pytest.mark.asyncio
async def test_biz_admin_can_review_but_cs_and_tech_cannot(
    client: AsyncClient,
    seed_admins: dict[str, AdminUser],
) -> None:
    _ = seed_admins
    # biz_admin: has both READ and REVIEW → LIST returns 200
    biz = await login_admin_get_tokens(client, "biz01", "biz_pwd_change_me")
    resp = await client.get(
        "/api/v1/admin/merchant-applications", headers=bearer(biz["access_token"])
    )
    assert resp.status_code == 200
    assert resp.json()["code"] == 0

    # customer service: lacks READ → 4020
    cs = await login_admin_get_tokens(client, "cs01", "cs_pwd_change_me")
    resp = await client.get(
        "/api/v1/admin/merchant-applications", headers=bearer(cs["access_token"])
    )
    assert resp.json()["code"] == 4020

    # tech admin: lacks READ → 4020
    tech = await login_admin_get_tokens(client, "tech01", "tech_pwd_change_me")
    resp = await client.get(
        "/api/v1/admin/merchant-applications", headers=bearer(tech["access_token"])
    )
    assert resp.json()["code"] == 4020


@pytest.mark.asyncio
async def test_super_admin_has_all_permissions(
    client: AsyncClient, seed_admins: dict[str, AdminUser]
) -> None:
    _ = seed_admins
    tokens = await login_admin_get_tokens(client, "super", "super_pwd_change_me")
    me = await client.get("/api/v1/admin/me", headers=bearer(tokens["access_token"]))
    perms = me.json()["data"]["permissions"]
    assert "admin:merchant_application:review" in perms
    assert "admin:merchant_application:read" in perms
    assert "admin:audit_log:read" in perms


@pytest.mark.asyncio
async def test_unauthenticated_admin_call(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/admin/me")
    body = resp.json()
    assert body["code"] == 1001


@pytest.mark.asyncio
async def test_wrong_audience_token_rejected(
    client: AsyncClient, seed_admins: dict[str, AdminUser]
) -> None:
    _ = seed_admins
    # login as admin, try to use the token as a user
    tokens = await login_admin_get_tokens(client, "super", "super_pwd_change_me")
    resp = await client.get("/api/v1/user/me", headers=bearer(tokens["access_token"]))
    # aud mismatch → invalid token → 1001
    assert resp.json()["code"] == 1001
