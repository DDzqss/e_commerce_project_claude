"""Aftersales return-receive path tests — Phase 4 §7.5 / §8.3."""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from httpx import AsyncClient

from app.models.admin_user import AdminUser
from app.models.merchant import MerchantAccount, Shop
from app.models.user import User
from tests.aftersales_helpers import build_paid_order


async def _apply_return_refund(client: AsyncClient, ctx: dict[str, Any]) -> dict[str, Any]:
    order_id = ctx["order"]["id"]
    detail = (await client.get(f"/api/v1/user/orders/{order_id}", headers=ctx["u_headers"])).json()[
        "data"
    ]
    oi = detail["items"][0]
    resp = await client.post(
        f"/api/v1/user/orders/{order_id}/aftersales",
        headers={**ctx["u_headers"], "Idempotency-Key": str(uuid.uuid4())},
        json={
            "type": "return_refund",
            "reason_category": "quality_issue",
            "reason_note": "商品外观和描述不一致需要退货",
            "items": [{"order_item_id": oi["id"], "quantity": 1}],
            "refund_amount_cents": oi["subtotal_cents"],
        },
    )
    return resp.json()["data"]


@pytest.mark.asyncio
async def test_submit_tracking_and_merchant_confirm_refunds(
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
    case = await _apply_return_refund(client, ctx)
    # Merchant approve → waiting return.
    await client.post(
        f"/api/v1/merchant/aftersales/{case['id']}/approve",
        headers=ctx["m_headers"],
        json={
            "actual_refund_cents": case["refund_amount_cents"],
            "return_address": "地址：文三路 100 号",
            "review_note": "同意",
        },
    )
    # User submits tracking.
    st = await client.post(
        f"/api/v1/user/aftersales/{case['id']}/submit-tracking",
        headers=ctx["u_headers"],
        json={"carrier": "SF", "tracking_no": "SF9988776655"},
    )
    body = st.json()["data"]
    assert body["status"] == "return_shipped_waiting_receive"
    assert body["return_carrier"] == "SF"

    # Merchant confirm-received → refunding → completed_refunded.
    cr = await client.post(
        f"/api/v1/merchant/aftersales/{case['id']}/confirm-received",
        headers=ctx["m_headers"],
        json={"note": "已收到货物"},
    )
    body = cr.json()["data"]
    assert body["status"] == "completed_refunded"
    assert body["refund_txn_no"] is not None


@pytest.mark.asyncio
async def test_submit_tracking_only_after_approve(
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
        complete=True,
    )
    case = await _apply_return_refund(client, ctx)
    resp = await client.post(
        f"/api/v1/user/aftersales/{case['id']}/submit-tracking",
        headers=ctx["u_headers"],
        json={"carrier": "SF", "tracking_no": "SF11223344"},
    )
    # Case still pending_merchant_review — 17002 return_not_agreed
    assert resp.json()["code"] == 17002


@pytest.mark.asyncio
async def test_merchant_refuse_receive_escalates(
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
        complete=True,
    )
    case = await _apply_return_refund(client, ctx)
    await client.post(
        f"/api/v1/merchant/aftersales/{case['id']}/approve",
        headers=ctx["m_headers"],
        json={
            "actual_refund_cents": case["refund_amount_cents"],
            "return_address": "文三路 100 号",
            "review_note": "同意",
        },
    )
    await client.post(
        f"/api/v1/user/aftersales/{case['id']}/submit-tracking",
        headers=ctx["u_headers"],
        json={"carrier": "SF", "tracking_no": "SF9988776655"},
    )
    resp = await client.post(
        f"/api/v1/merchant/aftersales/{case['id']}/refuse-receive",
        headers=ctx["m_headers"],
        json={"refuse_note": "包裹外观明显不同不予接收"},
    )
    body = resp.json()["data"]
    assert body["status"] == "admin_arbitrating"
    assert body["escalation_reason"] == "merchant_refuse_receive"
    assert body["merchant_refuse_receive"] is True
