"""User product-review lifecycle tests — Phase 5 contract §4."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core import database as core_db
from app.models.admin_user import AdminUser
from app.models.merchant import MerchantAccount, Shop
from app.models.review import Review
from app.models.user import User
from tests.aftersales_helpers import build_paid_order


async def _completed_order_ctx(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
    *,
    quantity: int = 1,
    price_cents: int = 12000,
) -> dict[str, Any]:
    ctx = await build_paid_order(
        client,
        seed_user,
        seed_admins,
        seed_merchant_account,
        seed_catalog,
        stock=5,
        quantity=quantity,
        price_cents=price_cents,
        complete=True,
    )
    detail = (
        await client.get(f"/api/v1/user/orders/{ctx['order']['id']}", headers=ctx["u_headers"])
    ).json()["data"]
    ctx["order_item"] = detail["items"][0]
    return ctx


@pytest.mark.asyncio
async def test_create_review_happy_path(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    ctx = await _completed_order_ctx(
        client, seed_user, seed_admins, seed_merchant_account, seed_catalog
    )
    oi = ctx["order_item"]
    resp = await client.post(
        f"/api/v1/user/orders/{ctx['order']['id']}/reviews",
        headers={**ctx["u_headers"], "Idempotency-Key": str(uuid.uuid4())},
        json={
            "reviews": [
                {
                    "order_item_id": oi["id"],
                    "rating": 5,
                    "content": "商品质量非常好非常满意值得推荐给大家",
                    "images": ["reviews/2026/07/25/a.jpg", "reviews/2026/07/25/b.jpg"],
                    "is_anonymous": False,
                }
            ]
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["code"] == 0
    items = body["data"]["items"]
    assert len(items) == 1
    row = items[0]
    assert row["rating"] == 5
    assert row["visible"] is True
    assert row["edit_count"] == 0
    assert len(row["images"]) == 2


@pytest.mark.asyncio
async def test_review_edit_window(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
    db_session_factory: async_sessionmaker[Any],
) -> None:
    ctx = await _completed_order_ctx(
        client, seed_user, seed_admins, seed_merchant_account, seed_catalog
    )
    oi = ctx["order_item"]
    created = (
        await client.post(
            f"/api/v1/user/orders/{ctx['order']['id']}/reviews",
            headers={**ctx["u_headers"], "Idempotency-Key": str(uuid.uuid4())},
            json={
                "reviews": [
                    {
                        "order_item_id": oi["id"],
                        "rating": 4,
                        "content": "初次评价文本占位需要至少五个字",
                        "images": [],
                        "is_anonymous": False,
                    }
                ]
            },
        )
    ).json()["data"]["items"][0]

    # First edit is allowed within the 15-day window.
    edit1 = await client.patch(
        f"/api/v1/user/reviews/{created['id']}",
        headers=ctx["u_headers"],
        json={"rating": 5, "content": "编辑后的评价内容占位符测试字符"},
    )
    assert edit1.json()["code"] == 0
    assert edit1.json()["data"]["edit_count"] == 1
    assert edit1.json()["data"]["rating"] == 5

    # Second edit blocked: edit_count already 1.
    edit2 = await client.patch(
        f"/api/v1/user/reviews/{created['id']}",
        headers=ctx["u_headers"],
        json={"content": "第二次编辑应该被拒绝字符占位"},
    )
    assert edit2.json()["code"] == 19004

    # Push deadline into the past to prove the window is enforced independently.
    async with db_session_factory() as session:  # type: ignore[operator]
        row = await session.get(Review, created["id"])
        assert row is not None
        row.edit_count = 0
        row.edit_deadline_at = datetime.now(UTC) - timedelta(days=1)
        await session.commit()

    _ = core_db  # module used indirectly by DI

    edit3 = await client.patch(
        f"/api/v1/user/reviews/{created['id']}",
        headers=ctx["u_headers"],
        json={"content": "过期后再编辑应该被拒绝字符占位"},
    )
    assert edit3.json()["code"] == 19004


@pytest.mark.asyncio
async def test_review_star_validation(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    ctx = await _completed_order_ctx(
        client, seed_user, seed_admins, seed_merchant_account, seed_catalog
    )
    oi = ctx["order_item"]
    resp = await client.post(
        f"/api/v1/user/orders/{ctx['order']['id']}/reviews",
        headers={**ctx["u_headers"], "Idempotency-Key": str(uuid.uuid4())},
        json={
            "reviews": [
                {
                    "order_item_id": oi["id"],
                    "rating": 7,
                    "content": "星级非法测试字符占位需要五个字",
                    "images": [],
                    "is_anonymous": False,
                }
            ]
        },
    )
    # Pydantic ge=1/le=5 rejects payload before service; contract error surface is validation.
    assert resp.json()["code"] == 5001


@pytest.mark.asyncio
async def test_review_only_completed_order(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    # Build a paid but not-completed order.
    ctx = await build_paid_order(
        client,
        seed_user,
        seed_admins,
        seed_merchant_account,
        seed_catalog,
        stock=5,
        quantity=1,
        price_cents=8000,
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
                    "rating": 5,
                    "content": "订单未完成不应该允许评价字符占位",
                    "images": [],
                    "is_anonymous": False,
                }
            ]
        },
    )
    assert resp.json()["code"] == 19003


@pytest.mark.asyncio
async def test_review_duplicate(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    ctx = await _completed_order_ctx(
        client, seed_user, seed_admins, seed_merchant_account, seed_catalog
    )
    oi = ctx["order_item"]
    payload = {
        "reviews": [
            {
                "order_item_id": oi["id"],
                "rating": 5,
                "content": "同一件商品第一次评价占位符测试",
                "images": [],
                "is_anonymous": False,
            }
        ]
    }
    ok = await client.post(
        f"/api/v1/user/orders/{ctx['order']['id']}/reviews",
        headers={**ctx["u_headers"], "Idempotency-Key": str(uuid.uuid4())},
        json=payload,
    )
    assert ok.status_code == 201

    dup = await client.post(
        f"/api/v1/user/orders/{ctx['order']['id']}/reviews",
        headers={**ctx["u_headers"], "Idempotency-Key": str(uuid.uuid4())},
        json=payload,
    )
    assert dup.json()["code"] == 19003


@pytest.mark.asyncio
async def test_review_image_limit(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    ctx = await _completed_order_ctx(
        client, seed_user, seed_admins, seed_merchant_account, seed_catalog
    )
    oi = ctx["order_item"]
    imgs = [f"reviews/2026/07/25/{i}.jpg" for i in range(7)]
    resp = await client.post(
        f"/api/v1/user/orders/{ctx['order']['id']}/reviews",
        headers={**ctx["u_headers"], "Idempotency-Key": str(uuid.uuid4())},
        json={
            "reviews": [
                {
                    "order_item_id": oi["id"],
                    "rating": 5,
                    "content": "图片数量超上限的评价占位符字符",
                    "images": imgs,
                    "is_anonymous": False,
                }
            ]
        },
    )
    # Pydantic max_length=6 fails first → validation envelope 5001.
    assert resp.json()["code"] == 5001
