"""Admin SPU review endpoints — contract §7 (permissions + admin ops)."""

from __future__ import annotations

from typing import Any

import pytest
from httpx import AsyncClient

from app.models.admin_user import AdminUser
from app.models.merchant import MerchantAccount, Shop
from tests.conftest import (
    bearer,
    login_admin_get_tokens,
    login_merchant_get_tokens,
)


async def _mk_pending_spu(
    client: AsyncClient,
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> dict[str, Any]:
    account, _ = seed_merchant_account
    m_tokens = await login_merchant_get_tokens(client, account.login_name, "Merch1234")
    m_headers = bearer(m_tokens["access_token"])
    spu = (
        await client.post(
            "/api/v1/merchant/spus",
            headers=m_headers,
            json={
                "category_id": seed_catalog["leaf"].id,
                "brand_id": seed_catalog["brand"].id,
                "title": "待审商品",
                "main_image": "spu/x.jpg",
                "spec_axes": ["color"],
            },
        )
    ).json()["data"]
    await client.post(
        f"/api/v1/merchant/spus/{spu['id']}/skus",
        headers=m_headers,
        json={
            "sku_code": "P",
            "specs": {"color": "红"},
            "price_cents": 1000,
            "stock": 5,
        },
    )
    await client.post(f"/api/v1/merchant/spus/{spu['id']}/submit-review", headers=m_headers)
    return spu


@pytest.mark.asyncio
async def test_admin_can_list_and_get_all_shops(
    client: AsyncClient,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    _ = seed_admins
    spu = await _mk_pending_spu(client, seed_merchant_account, seed_catalog)
    a_tokens = await login_admin_get_tokens(client, "super", "super_pwd_change_me")
    a_headers = bearer(a_tokens["access_token"])

    lst = await client.get("/api/v1/admin/spus?status=pending_review", headers=a_headers)
    ids = [i["id"] for i in lst.json()["data"]["items"]]
    assert spu["id"] in ids

    d = await client.get(f"/api/v1/admin/spus/{spu['id']}", headers=a_headers)
    assert d.json()["data"]["id"] == spu["id"]
    assert len(d.json()["data"]["skus"]) == 1


@pytest.mark.asyncio
async def test_tech_admin_cannot_review(
    client: AsyncClient,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    _ = seed_admins
    spu = await _mk_pending_spu(client, seed_merchant_account, seed_catalog)
    t = await login_admin_get_tokens(client, "tech01", "tech_pwd_change_me")
    headers = bearer(t["access_token"])
    resp = await client.post(f"/api/v1/admin/spus/{spu['id']}/approve", headers=headers, json={})
    # TECH_ADMIN lacks ADMIN_SPU_REVIEW so approve returns 4020.
    assert resp.json()["code"] == 4020


@pytest.mark.asyncio
async def test_business_admin_can_approve_and_force_offshelf(
    client: AsyncClient,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    _ = seed_admins
    spu = await _mk_pending_spu(client, seed_merchant_account, seed_catalog)
    tokens = await login_admin_get_tokens(client, "biz01", "biz_pwd_change_me")
    headers = bearer(tokens["access_token"])

    ap = await client.post(f"/api/v1/admin/spus/{spu['id']}/approve", headers=headers, json={})
    assert ap.json()["data"]["status"] == "approved"

    fo = await client.post(
        f"/api/v1/admin/spus/{spu['id']}/force-offshelf",
        headers=headers,
        json={"review_note": "违规商品下架"},
    )
    assert fo.json()["data"]["status"] == "off_shelf"
