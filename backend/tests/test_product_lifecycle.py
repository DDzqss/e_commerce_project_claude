"""SPU lifecycle state-machine tests — contract §4 / §7 / §8.1."""

from __future__ import annotations

from typing import Any

import pytest
from httpx import AsyncClient

from app.core.security import hash_password
from app.models.admin_user import AdminUser
from app.models.merchant import (
    MerchantAccount,
    MerchantAccountStatus,
    MerchantRole,
    Shop,
    ShopStatus,
)
from tests.conftest import (
    bearer,
    login_admin_get_tokens,
    login_merchant_get_tokens,
)


async def _merchant_headers(
    client: AsyncClient, seed_merchant_account: tuple[MerchantAccount, Shop]
) -> dict[str, str]:
    account, _ = seed_merchant_account
    tokens = await login_merchant_get_tokens(client, account.login_name, "Merch1234")
    return bearer(tokens["access_token"])


async def _admin_headers(client: AsyncClient) -> dict[str, str]:
    tokens = await login_admin_get_tokens(client, "super", "super_pwd_change_me")
    return bearer(tokens["access_token"])


async def _create_draft_spu(
    client: AsyncClient,
    m_headers: dict[str, str],
    leaf_id: int,
    brand_id: int,
    *,
    title: str = "iPhone 20 Pro",
) -> dict[str, Any]:
    payload = {
        "category_id": leaf_id,
        "brand_id": brand_id,
        "title": title,
        "subtitle": "钛金属机身",
        "description": "<p>test</p>",
        "main_image": "spu/seed/example.jpg",
        "images": ["spu/seed/example.jpg"],
        "spec_axes": ["color", "storage"],
    }
    resp = await client.post("/api/v1/merchant/spus", headers=m_headers, json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()["data"]


async def _add_sku(
    client: AsyncClient,
    m_headers: dict[str, str],
    spu_id: int,
    *,
    sku_code: str = "PRO-BLACK-256",
    price_cents: int = 799900,
) -> dict[str, Any]:
    payload = {
        "sku_code": sku_code,
        "specs": {"color": "黑", "storage": "256G"},
        "price_cents": price_cents,
        "stock": 50,
        "is_active": True,
    }
    resp = await client.post(
        f"/api/v1/merchant/spus/{spu_id}/skus",
        headers=m_headers,
        json=payload,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["data"]


@pytest.mark.asyncio
async def test_full_lifecycle_draft_to_offshelf(
    client: AsyncClient,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    _ = seed_admins
    m_headers = await _merchant_headers(client, seed_merchant_account)
    a_headers = await _admin_headers(client)
    leaf_id = seed_catalog["leaf"].id
    brand_id = seed_catalog["brand"].id

    spu = await _create_draft_spu(client, m_headers, leaf_id, brand_id)
    assert spu["status"] == "draft"

    # cannot submit without SKU
    no_sku = await client.post(
        f"/api/v1/merchant/spus/{spu['id']}/submit-review", headers=m_headers
    )
    assert no_sku.json()["code"] == 7004

    await _add_sku(client, m_headers, spu["id"])

    # submit review
    sub = await client.post(f"/api/v1/merchant/spus/{spu['id']}/submit-review", headers=m_headers)
    assert sub.json()["data"]["status"] == "pending_review"

    # admin approves
    ap = await client.post(
        f"/api/v1/admin/spus/{spu['id']}/approve",
        headers=a_headers,
        json={"review_note": "ok"},
    )
    assert ap.json()["data"]["status"] == "approved"
    assert ap.json()["data"]["published_at"] is not None

    # edit non-critical field (subtitle) → stays approved
    non_crit = await client.patch(
        f"/api/v1/merchant/spus/{spu['id']}",
        headers=m_headers,
        json={"subtitle": "全新配色"},
    )
    assert non_crit.json()["data"]["status"] == "approved"

    # edit critical field (title) → back to pending
    crit = await client.patch(
        f"/api/v1/merchant/spus/{spu['id']}",
        headers=m_headers,
        json={"title": "iPhone 20 Pro Max"},
    )
    assert crit.json()["data"]["status"] == "pending_review"
    assert crit.json()["data"]["reviewer_admin_id"] is None

    # admin rejects
    rj = await client.post(
        f"/api/v1/admin/spus/{spu['id']}/reject",
        headers=a_headers,
        json={"review_note": "标题不合规范请修改"},
    )
    assert rj.json()["data"]["status"] == "rejected"

    # resubmit → pending
    sub2 = await client.post(f"/api/v1/merchant/spus/{spu['id']}/submit-review", headers=m_headers)
    assert sub2.json()["data"]["status"] == "pending_review"

    # withdraw pending → draft
    wd = await client.post(f"/api/v1/merchant/spus/{spu['id']}/withdraw-review", headers=m_headers)
    assert wd.json()["data"]["status"] == "draft"

    # submit again + approve
    await client.post(f"/api/v1/merchant/spus/{spu['id']}/submit-review", headers=m_headers)
    await client.post(f"/api/v1/admin/spus/{spu['id']}/approve", headers=a_headers, json={})

    # merchant offshelf
    off = await client.post(f"/api/v1/merchant/spus/{spu['id']}/offshelf", headers=m_headers)
    assert off.json()["data"]["status"] == "off_shelf"

    # merchant onshelf
    on = await client.post(f"/api/v1/merchant/spus/{spu['id']}/onshelf", headers=m_headers)
    assert on.json()["data"]["status"] == "approved"

    # admin force-offshelf
    fo = await client.post(
        f"/api/v1/admin/spus/{spu['id']}/force-offshelf",
        headers=a_headers,
        json={"review_note": "疑似违规下架"},
    )
    assert fo.json()["data"]["status"] == "off_shelf"


@pytest.mark.asyncio
async def test_reject_requires_note(
    client: AsyncClient,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    _ = seed_admins
    m_headers = await _merchant_headers(client, seed_merchant_account)
    a_headers = await _admin_headers(client)

    spu = await _create_draft_spu(
        client,
        m_headers,
        seed_catalog["leaf"].id,
        seed_catalog["brand"].id,
    )
    await _add_sku(client, m_headers, spu["id"])
    await client.post(f"/api/v1/merchant/spus/{spu['id']}/submit-review", headers=m_headers)

    no_note = await client.post(
        f"/api/v1/admin/spus/{spu['id']}/reject", headers=a_headers, json={}
    )
    assert no_note.json()["code"] == 5001


@pytest.mark.asyncio
async def test_cannot_delete_approved_spu(
    client: AsyncClient,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    _ = seed_admins
    m_headers = await _merchant_headers(client, seed_merchant_account)
    a_headers = await _admin_headers(client)

    spu = await _create_draft_spu(
        client, m_headers, seed_catalog["leaf"].id, seed_catalog["brand"].id
    )
    await _add_sku(client, m_headers, spu["id"])
    await client.post(f"/api/v1/merchant/spus/{spu['id']}/submit-review", headers=m_headers)
    await client.post(f"/api/v1/admin/spus/{spu['id']}/approve", headers=a_headers, json={})

    dele = await client.delete(f"/api/v1/merchant/spus/{spu['id']}", headers=m_headers)
    assert dele.json()["code"] == 7003


@pytest.mark.asyncio
async def test_spu_must_use_leaf_category(
    client: AsyncClient,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    _ = seed_admins
    m_headers = await _merchant_headers(client, seed_merchant_account)
    resp = await client.post(
        "/api/v1/merchant/spus",
        headers=m_headers,
        json={
            "category_id": seed_catalog["root"].id,  # level=1 non-leaf
            "brand_id": seed_catalog["brand"].id,
            "title": "非法商品",
            "main_image": "spu/x.jpg",
        },
    )
    assert resp.json()["code"] == 5001


@pytest.mark.asyncio
async def test_other_shop_cannot_touch_my_spu(
    client: AsyncClient,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_second_user: Any,
    seed_catalog: dict[str, Any],
    db_session: Any,
) -> None:
    _ = seed_admins

    m_headers = await _merchant_headers(client, seed_merchant_account)
    spu = await _create_draft_spu(
        client, m_headers, seed_catalog["leaf"].id, seed_catalog["brand"].id
    )

    # Create a second shop with second user as owner.
    shop2 = Shop(
        name="另一家店",
        description=None,
        contact_name="老王",
        contact_phone="13800000002",
        status=ShopStatus.ACTIVE,
    )
    db_session.add(shop2)
    await db_session.flush()
    acct2 = MerchantAccount(
        user_id=seed_second_user.id,
        login_name=f"shop{shop2.id}_owner",
        password_hash=hash_password("Merch1234"),
        shop_id=shop2.id,
        role=MerchantRole.SHOP_OWNER,
        status=MerchantAccountStatus.ACTIVE,
    )
    db_session.add(acct2)
    await db_session.commit()

    other_tokens = await login_merchant_get_tokens(client, acct2.login_name, "Merch1234")
    other_headers = bearer(other_tokens["access_token"])
    resp = await client.get(f"/api/v1/merchant/spus/{spu['id']}", headers=other_headers)
    assert resp.json()["code"] == 7002
