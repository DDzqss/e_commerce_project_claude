"""Aftersales review-flow tests — Phase 4 §8."""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from httpx import AsyncClient

from app.models.admin_user import AdminUser
from app.models.merchant import MerchantAccount, Shop
from app.models.user import User
from tests.aftersales_helpers import build_paid_order


async def _create_case(
    client: AsyncClient,
    ctx: dict[str, Any],
    *,
    type_: str,
    complete_order: bool = False,
) -> dict[str, Any]:
    order_id = ctx["order"]["id"]
    detail = (await client.get(f"/api/v1/user/orders/{order_id}", headers=ctx["u_headers"])).json()[
        "data"
    ]
    oi = detail["items"][0]
    resp = await client.post(
        f"/api/v1/user/orders/{order_id}/aftersales",
        headers={**ctx["u_headers"], "Idempotency-Key": str(uuid.uuid4())},
        json={
            "type": type_,
            "reason_category": "quality_issue",
            "reason_note": "商品有明显问题需要处理的情况",
            "items": [{"order_item_id": oi["id"], "quantity": 1}],
            "refund_amount_cents": oi["subtotal_cents"],
        },
    )
    assert resp.status_code == 201, resp.text
    _ = complete_order  # placeholder for future use
    return resp.json()["data"]


@pytest.mark.asyncio
async def test_refund_only_approve_triggers_refund(
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
        price_cents=8000,
    )
    case = await _create_case(client, ctx, type_="refund_only")

    resp = await client.post(
        f"/api/v1/merchant/aftersales/{case['id']}/approve",
        headers=ctx["m_headers"],
        json={"actual_refund_cents": case["refund_amount_cents"], "review_note": "同意"},
    )
    assert resp.json()["code"] == 0
    body = resp.json()["data"]
    assert body["status"] == "completed_refunded"
    assert body["refund_txn_no"] is not None
    assert body["actual_refund_cents"] == case["refund_amount_cents"]


@pytest.mark.asyncio
async def test_return_refund_approve_waits_for_user(
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
        price_cents=12000,
        complete=True,
    )
    case = await _create_case(client, ctx, type_="return_refund")
    resp = await client.post(
        f"/api/v1/merchant/aftersales/{case['id']}/approve",
        headers=ctx["m_headers"],
        json={
            "actual_refund_cents": case["refund_amount_cents"],
            "return_address": "浙江省杭州市西湖区 XX 路 XX 号",
            "review_note": "同意退货",
        },
    )
    body = resp.json()["data"]
    assert body["status"] == "merchant_agreed_waiting_return"
    assert body["return_address"].startswith("浙江省")


@pytest.mark.asyncio
async def test_merchant_reject_then_user_appeal_escalates(
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
        price_cents=6000,
    )
    case = await _create_case(client, ctx, type_="refund_only")

    reject = await client.post(
        f"/api/v1/merchant/aftersales/{case['id']}/reject",
        headers=ctx["m_headers"],
        json={"review_note": "驳回，理由充分"},
    )
    assert reject.json()["data"]["status"] == "merchant_rejected"

    appeal = await client.post(
        f"/api/v1/user/aftersales/{case['id']}/appeal",
        headers=ctx["u_headers"],
        json={
            "reason": "用户申诉理由文本占位需要至少二十个中文字符占位",
            "evidence_image_keys": [],
        },
    )
    body = appeal.json()["data"]
    assert body["status"] == "admin_arbitrating"
    assert body["escalation_reason"] == "user_appeal"
    assert body["appeal_count"] == 1

    # Second appeal blocked (already in arbitration).
    second = await client.post(
        f"/api/v1/user/aftersales/{case['id']}/appeal",
        headers=ctx["u_headers"],
        json={
            "reason": "重复申诉理由文本占位需要至少二十个字符占位符测试",
            "evidence_image_keys": [],
        },
    )
    assert second.json()["code"] in {15009, 15003}


@pytest.mark.asyncio
async def test_merchant_reject_note_too_short_rejected(
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
    )
    case = await _create_case(client, ctx, type_="refund_only")
    resp = await client.post(
        f"/api/v1/merchant/aftersales/{case['id']}/reject",
        headers=ctx["m_headers"],
        json={"review_note": "不"},  # < 5 chars
    )
    assert resp.json()["code"] == 5001
