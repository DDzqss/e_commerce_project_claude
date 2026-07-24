"""Shop-homepage tests — Phase 5 contract §9."""

from __future__ import annotations

from typing import Any

import pytest
from httpx import AsyncClient

from app.models.admin_user import AdminUser
from app.models.merchant import MerchantAccount, Shop
from app.models.user import User
from tests.aftersales_helpers import build_paid_order, headers_merchant


@pytest.mark.asyncio
async def test_public_shop_homepage_read(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    _account, shop = seed_merchant_account
    # Provision an approved SPU + SKU inside this shop.
    await build_paid_order(
        client,
        seed_user,
        seed_admins,
        seed_merchant_account,
        seed_catalog,
        stock=5,
        quantity=1,
        price_cents=9900,
    )

    profile = await client.get(f"/api/v1/catalog/shops/{shop.id}")
    body = profile.json()
    assert body["code"] == 0
    data = body["data"]
    assert data["id"] == shop.id
    assert data["name"] == shop.name
    # Contact phone should be masked (13800000001 → 138****01).
    assert "*" in data["contact_phone"]
    assert data["status"] == "active"

    listing = await client.get(f"/api/v1/catalog/shops/{shop.id}/spus")
    body2 = listing.json()
    assert body2["code"] == 0
    assert body2["data"]["total"] >= 1


@pytest.mark.asyncio
async def test_merchant_update_shop_homepage(
    client: AsyncClient,
    seed_merchant_account: tuple[MerchantAccount, Shop],
) -> None:
    m_headers = await headers_merchant(client, seed_merchant_account)
    resp = await client.patch(
        "/api/v1/merchant/me/shop",
        headers=m_headers,
        json={
            "description": "本店主营优质数码产品",
            "logo_url": "shop/logo/xyz.png",
            "banner_url": "shop/banner/xyz.jpg",
            "announcement": "暑期促销进行中欢迎选购",
        },
    )
    assert resp.json()["code"] == 0
    shop_out = resp.json()["data"]
    assert shop_out["logo_url"] == "shop/logo/xyz.png"
    assert shop_out["banner_url"] == "shop/banner/xyz.jpg"
    assert shop_out["announcement"].startswith("暑期")
    assert shop_out["description"].startswith("本店")

    # Follow-up read via public catalog reflects the edit.
    _, shop = seed_merchant_account
    public = (await client.get(f"/api/v1/catalog/shops/{shop.id}")).json()["data"]
    assert public["logo_url"] == "shop/logo/xyz.png"
    assert public["banner_url"] == "shop/banner/xyz.jpg"
    assert public["announcement"].startswith("暑期")


@pytest.mark.asyncio
async def test_shop_stats_included(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    """Complete an order and post a review — shop stats update accordingly."""
    _account, shop = seed_merchant_account

    # Baseline: no reviews yet.
    baseline = (await client.get(f"/api/v1/catalog/shops/{shop.id}")).json()["data"]
    assert set(baseline.keys()) >= {"rating_avg", "rating_count", "sales_count"}
    assert baseline["rating_count"] == 0

    # A completed order + review — should bump rating_count.
    import uuid

    ctx = await build_paid_order(
        client,
        seed_user,
        seed_admins,
        seed_merchant_account,
        seed_catalog,
        stock=5,
        quantity=1,
        price_cents=15000,
        complete=True,
    )
    detail = (
        await client.get(f"/api/v1/user/orders/{ctx['order']['id']}", headers=ctx["u_headers"])
    ).json()["data"]
    oi = detail["items"][0]
    review = await client.post(
        f"/api/v1/user/orders/{ctx['order']['id']}/reviews",
        headers={**ctx["u_headers"], "Idempotency-Key": str(uuid.uuid4())},
        json={
            "reviews": [
                {
                    "order_item_id": oi["id"],
                    "rating": 4,
                    "content": "评分四星整体不错但仍有改进空间",
                    "images": [],
                    "is_anonymous": False,
                }
            ]
        },
    )
    assert review.status_code == 201

    after = (await client.get(f"/api/v1/catalog/shops/{shop.id}")).json()["data"]
    assert after["rating_count"] == 1
    assert 3.99 <= after["rating_avg"] <= 4.01
