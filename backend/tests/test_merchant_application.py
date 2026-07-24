"""Merchant application state-machine tests (contract §8)."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.models.admin_user import AdminUser
from app.models.user import User
from tests.conftest import (
    bearer,
    login_admin_get_tokens,
    login_merchant_get_tokens,
    login_user_get_tokens,
)


@pytest.fixture
def application_payload() -> dict[str, object]:
    return {
        "shop_name": "小李杂货铺",
        "contact_name": "李明",
        "contact_phone": "13900002222",
        "business_license_no": "91330100MA123",
        "description": "主营家居日用品",
    }


@pytest.mark.asyncio
async def test_apply_then_withdraw(
    client: AsyncClient, seed_user: User, application_payload: dict[str, object]
) -> None:
    user_tokens = await login_user_get_tokens(client, seed_user.phone or "", "Test1234")
    headers = bearer(user_tokens["access_token"])

    resp = await client.post(
        "/api/v1/user/merchant-applications", headers=headers, json=application_payload
    )
    body = resp.json()
    assert resp.status_code == 201
    assert body["code"] == 0
    application_id = body["data"]["id"]
    assert body["data"]["status"] == "pending"

    # duplicate pending → 3001
    dup = await client.post(
        "/api/v1/user/merchant-applications", headers=headers, json=application_payload
    )
    assert dup.json()["code"] == 3001

    # withdraw
    w = await client.post(
        f"/api/v1/user/merchant-applications/{application_id}/withdraw",
        headers=headers,
    )
    assert w.json()["code"] == 0
    assert w.json()["data"]["status"] == "withdrawn"

    # withdraw again → 3004
    w2 = await client.post(
        f"/api/v1/user/merchant-applications/{application_id}/withdraw",
        headers=headers,
    )
    assert w2.json()["code"] == 3004


@pytest.mark.asyncio
async def test_approve_creates_shop_and_merchant_account(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    application_payload: dict[str, object],
) -> None:
    _ = seed_admins
    user_tokens = await login_user_get_tokens(client, seed_user.phone or "", "Test1234")
    user_headers = bearer(user_tokens["access_token"])
    apply_resp = await client.post(
        "/api/v1/user/merchant-applications",
        headers=user_headers,
        json=application_payload,
    )
    application_id = apply_resp.json()["data"]["id"]

    # admin approves
    admin_tokens = await login_admin_get_tokens(client, "super", "super_pwd_change_me")
    admin_headers = bearer(admin_tokens["access_token"])
    approve = await client.post(
        f"/api/v1/admin/merchant-applications/{application_id}/approve",
        headers=admin_headers,
        json={"review_note": "资质齐全"},
    )
    body = approve.json()
    assert body["code"] == 0
    assert body["data"]["application"]["status"] == "approved"
    account = body["data"]["merchant_account"]
    assert account["role"] == "SHOP_OWNER"
    assert account["initial_password"]
    login_name = account["login_name"]
    initial_password = account["initial_password"]

    # try to apply again → 3002 (already a merchant)
    again = await client.post(
        "/api/v1/user/merchant-applications",
        headers=user_headers,
        json=application_payload,
    )
    assert again.json()["code"] == 3002

    # merchant login works
    merchant_tokens = await login_merchant_get_tokens(client, login_name, initial_password)
    me = await client.get("/api/v1/merchant/me", headers=bearer(merchant_tokens["access_token"]))
    assert me.json()["code"] == 0

    # approving a non-pending application → 3004
    reapprove = await client.post(
        f"/api/v1/admin/merchant-applications/{application_id}/approve",
        headers=admin_headers,
        json={},
    )
    assert reapprove.json()["code"] == 3004


@pytest.mark.asyncio
async def test_reject_requires_note(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    application_payload: dict[str, object],
) -> None:
    _ = seed_admins
    user_tokens = await login_user_get_tokens(client, seed_user.phone or "", "Test1234")
    apply_resp = await client.post(
        "/api/v1/user/merchant-applications",
        headers=bearer(user_tokens["access_token"]),
        json=application_payload,
    )
    application_id = apply_resp.json()["data"]["id"]

    admin_tokens = await login_admin_get_tokens(client, "super", "super_pwd_change_me")

    # no note → 5001
    no_note = await client.post(
        f"/api/v1/admin/merchant-applications/{application_id}/reject",
        headers=bearer(admin_tokens["access_token"]),
        json={},
    )
    assert no_note.json()["code"] == 5001

    # too short note → 5001
    too_short = await client.post(
        f"/api/v1/admin/merchant-applications/{application_id}/reject",
        headers=bearer(admin_tokens["access_token"]),
        json={"review_note": "no"},
    )
    assert too_short.json()["code"] == 5001

    # ok note
    ok = await client.post(
        f"/api/v1/admin/merchant-applications/{application_id}/reject",
        headers=bearer(admin_tokens["access_token"]),
        json={"review_note": "营业执照信息不匹配, 请重新提交"},
    )
    assert ok.json()["code"] == 0
    assert ok.json()["data"]["status"] == "rejected"


@pytest.mark.asyncio
async def test_unknown_application_id(
    client: AsyncClient, seed_admins: dict[str, AdminUser]
) -> None:
    _ = seed_admins
    admin_tokens = await login_admin_get_tokens(client, "super", "super_pwd_change_me")
    resp = await client.get(
        "/api/v1/admin/merchant-applications/999999",
        headers=bearer(admin_tokens["access_token"]),
    )
    assert resp.json()["code"] == 3003
