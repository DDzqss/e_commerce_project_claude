"""Aftersales → order side-link tests — Phase 4 §13."""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from httpx import AsyncClient

from app.core import database as core_db
from app.models.admin_user import AdminUser
from app.models.merchant import MerchantAccount, Shop
from app.models.order import Order, OrderStatus
from app.models.user import User
from tests.aftersales_helpers import build_paid_order


@pytest.mark.asyncio
async def test_full_refund_closes_order(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    ctx = await build_paid_order(
        client,
        seed_user,
        seed_admins,
        seed_merchant_account,
        seed_catalog,
        stock=5,
        quantity=1,
        price_cents=10000,
    )
    order_id = ctx["order"]["id"]
    detail = (await client.get(f"/api/v1/user/orders/{order_id}", headers=ctx["u_headers"])).json()[
        "data"
    ]
    oi = detail["items"][0]
    case = (
        await client.post(
            f"/api/v1/user/orders/{order_id}/aftersales",
            headers={**ctx["u_headers"], "Idempotency-Key": str(uuid.uuid4())},
            json={
                "type": "refund_only",
                "reason_category": "quality_issue",
                "reason_note": "全额退款测试订单侧联动关闭订单",
                "items": [{"order_item_id": oi["id"], "quantity": 1}],
                "refund_amount_cents": oi["subtotal_cents"],
            },
        )
    ).json()["data"]

    await client.post(
        f"/api/v1/merchant/aftersales/{case['id']}/approve",
        headers=ctx["m_headers"],
        json={"actual_refund_cents": case["refund_amount_cents"], "review_note": "同意"},
    )

    async with core_db.async_session_factory() as s:
        order = await s.get(Order, order_id)
        assert order.status == OrderStatus.CLOSED
        assert order.total_refunded_cents == case["refund_amount_cents"]


@pytest.mark.asyncio
async def test_partial_refund_flags_order(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    # 2 items in order → refund one line only.
    ctx = await build_paid_order(
        client,
        seed_user,
        seed_admins,
        seed_merchant_account,
        seed_catalog,
        stock=10,
        quantity=2,
        price_cents=10000,
    )
    order_id = ctx["order"]["id"]
    detail = (await client.get(f"/api/v1/user/orders/{order_id}", headers=ctx["u_headers"])).json()[
        "data"
    ]
    oi = detail["items"][0]
    half_amount = oi["unit_price_cents"] * 1  # 1 of 2 units
    case = (
        await client.post(
            f"/api/v1/user/orders/{order_id}/aftersales",
            headers={**ctx["u_headers"], "Idempotency-Key": str(uuid.uuid4())},
            json={
                "type": "refund_only",
                "reason_category": "quality_issue",
                "reason_note": "部分退款测试订单侧联动只标记不关订单",
                "items": [{"order_item_id": oi["id"], "quantity": 1}],
                "refund_amount_cents": half_amount,
            },
        )
    ).json()["data"]

    await client.post(
        f"/api/v1/merchant/aftersales/{case['id']}/approve",
        headers=ctx["m_headers"],
        json={"actual_refund_cents": half_amount, "review_note": "同意"},
    )

    async with core_db.async_session_factory() as s:
        order = await s.get(Order, order_id)
        # Order stays paid (not shipped yet); has_partial_refund flag set.
        assert order.status != OrderStatus.CLOSED
        assert order.has_partial_refund is True
        assert order.total_refunded_cents == half_amount
