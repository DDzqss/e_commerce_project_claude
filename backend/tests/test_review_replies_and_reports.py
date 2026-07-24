"""Review reply + review report tests — Phase 5 contract §5."""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.security import hash_password
from app.models.admin_user import AdminUser
from app.models.merchant import (
    MerchantAccount,
    MerchantAccountStatus,
    MerchantRole,
    Shop,
    ShopStatus,
)
from app.models.user import User
from tests.aftersales_helpers import (
    bearer,
    build_paid_order,
    headers_admin,
    login_merchant_get_tokens,
)


async def _create_review(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Build a completed order, create a review, return (review, ctx)."""
    ctx = await build_paid_order(
        client,
        seed_user,
        seed_admins,
        seed_merchant_account,
        seed_catalog,
        stock=5,
        quantity=1,
        price_cents=10000,
        complete=True,
    )
    detail = (
        await client.get(f"/api/v1/user/orders/{ctx['order']['id']}", headers=ctx["u_headers"])
    ).json()["data"]
    oi = detail["items"][0]
    resp = await client.post(
        f"/api/v1/user/orders/{ctx['order']['id']}/reviews",
        headers={**ctx["u_headers"], "Idempotency-Key": str(uuid.uuid4())},
        json={
            "reviews": [
                {
                    "order_item_id": oi["id"],
                    "rating": 4,
                    "content": "评价内容占位测试字符至少五个字",
                    "images": [],
                    "is_anonymous": False,
                }
            ]
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["data"]["items"][0], ctx


@pytest.mark.asyncio
async def test_merchant_reply_once(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    review, ctx = await _create_review(
        client, seed_user, seed_admins, seed_merchant_account, seed_catalog
    )

    ok = await client.post(
        f"/api/v1/merchant/reviews/{review['id']}/reply",
        headers=ctx["m_headers"],
        json={"content": "感谢您的反馈我们会持续改进服务质量"},
    )
    assert ok.status_code == 201, ok.text
    assert ok.json()["code"] == 0
    assert ok.json()["data"]["content"].startswith("感谢")

    dup = await client.post(
        f"/api/v1/merchant/reviews/{review['id']}/reply",
        headers=ctx["m_headers"],
        json={"content": "再次尝试回复应当被拒绝字符占位"},
    )
    assert dup.json()["code"] == 20002


@pytest.mark.asyncio
async def test_user_report_review(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    review, ctx = await _create_review(
        client, seed_user, seed_admins, seed_merchant_account, seed_catalog
    )
    resp = await client.post(
        f"/api/v1/user/reviews/{review['id']}/report",
        headers=ctx["u_headers"],
        json={"reason_category": "ad_spam", "reason_note": "疑似广告或垃圾评价"},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()["data"]
    assert body["status"] == "pending"
    assert body["reason_category"] == "ad_spam"

    # Same user reporting same review again → 21002.
    dup = await client.post(
        f"/api/v1/user/reviews/{review['id']}/report",
        headers=ctx["u_headers"],
        json={"reason_category": "ad_spam", "reason_note": "重复举报测试字符占位"},
    )
    assert dup.json()["code"] == 21002


@pytest.mark.asyncio
async def test_admin_handle_report_hide(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    review, ctx = await _create_review(
        client, seed_user, seed_admins, seed_merchant_account, seed_catalog
    )
    # user submits a report
    report = (
        await client.post(
            f"/api/v1/user/reviews/{review['id']}/report",
            headers=ctx["u_headers"],
            json={"reason_category": "offensive", "reason_note": "包含攻击性文字"},
        )
    ).json()["data"]

    cs_headers = await headers_admin(client, "cs01")
    upheld = await client.post(
        f"/api/v1/admin/review-reports/{report['id']}/uphold",
        headers=cs_headers,
        json={"review_note": "经审核举报成立，隐藏此评价"},
    )
    assert upheld.json()["code"] == 0
    assert upheld.json()["data"]["status"] == "upheld"

    # The linked review is now hidden.
    detail = await client.get(f"/api/v1/admin/reviews/{review['id']}", headers=cs_headers)
    assert detail.json()["data"]["visible"] is False


@pytest.mark.asyncio
async def test_admin_handle_report_reject(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    review, ctx = await _create_review(
        client, seed_user, seed_admins, seed_merchant_account, seed_catalog
    )
    report = (
        await client.post(
            f"/api/v1/user/reviews/{review['id']}/report",
            headers=ctx["u_headers"],
            json={"reason_category": "irrelevant", "reason_note": "与商品无关的评价"},
        )
    ).json()["data"]

    cs_headers = await headers_admin(client, "cs01")
    resp = await client.post(
        f"/api/v1/admin/review-reports/{report['id']}/dismiss",
        headers=cs_headers,
        json={"review_note": "审核后判定举报不成立不予采纳"},
    )
    assert resp.json()["code"] == 0
    assert resp.json()["data"]["status"] == "dismissed"

    # Review remains visible.
    detail = await client.get(f"/api/v1/admin/reviews/{review['id']}", headers=cs_headers)
    assert detail.json()["data"]["visible"] is True


@pytest.mark.asyncio
async def test_reply_permission(
    client: AsyncClient,
    seed_user: User,
    seed_second_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
    db_session_factory: async_sessionmaker[Any],
) -> None:
    review, _ctx = await _create_review(
        client, seed_user, seed_admins, seed_merchant_account, seed_catalog
    )

    # Provision an unrelated shop + merchant account (belongs to another shop).
    async with db_session_factory() as session:  # type: ignore[operator]
        other_shop = Shop(
            name="别家小店",
            description=None,
            contact_name="老赵",
            contact_phone="13800000099",
            status=ShopStatus.ACTIVE,
        )
        session.add(other_shop)
        await session.flush()
        other_login = f"shop{other_shop.id}_owner"
        other_account = MerchantAccount(
            user_id=seed_second_user.id,
            login_name=other_login,
            password_hash=hash_password("Merch1234"),
            shop_id=other_shop.id,
            role=MerchantRole.SHOP_OWNER,
            status=MerchantAccountStatus.ACTIVE,
        )
        session.add(other_account)
        await session.commit()

    tokens = await login_merchant_get_tokens(client, other_login, "Merch1234")
    other_headers = bearer(tokens["access_token"])

    resp = await client.post(
        f"/api/v1/merchant/reviews/{review['id']}/reply",
        headers=other_headers,
        json={"content": "越权尝试回复其他店铺评价的测试字符"},
    )
    assert resp.json()["code"] == 20003
