"""Aftersales exchange full-flow tests — Phase 4 §7 / §8."""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from httpx import AsyncClient

from app.models.admin_user import AdminUser
from app.models.merchant import MerchantAccount, Shop
from app.models.user import User
from tests.aftersales_helpers import build_paid_order


@pytest.mark.asyncio
async def test_full_exchange_flow(
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
        price_cents=15000,
        complete=True,
    )
    order_id = ctx["order"]["id"]
    detail = (await client.get(f"/api/v1/user/orders/{order_id}", headers=ctx["u_headers"])).json()[
        "data"
    ]
    oi = detail["items"][0]

    # 1) Apply EXCHANGE
    resp = await client.post(
        f"/api/v1/user/orders/{order_id}/aftersales",
        headers={**ctx["u_headers"], "Idempotency-Key": str(uuid.uuid4())},
        json={
            "type": "exchange",
            "reason_category": "wrong_item",
            "reason_note": "尺码不合适需要更换其他规格产品",
            "items": [{"order_item_id": oi["id"], "quantity": 1}],
            "refund_amount_cents": 0,
        },
    )
    assert resp.status_code == 201
    case = resp.json()["data"]
    assert case["status"] == "pending_merchant_review"

    # 2) Merchant approve → waiting return
    approve = await client.post(
        f"/api/v1/merchant/aftersales/{case['id']}/approve",
        headers=ctx["m_headers"],
        json={
            "actual_refund_cents": 0,
            "return_address": "浙江省杭州市 XX 路 XX 号",
            "review_note": "同意换货",
        },
    )
    assert approve.json()["data"]["status"] == "merchant_agreed_waiting_return"

    # 3) User submit tracking
    st = await client.post(
        f"/api/v1/user/aftersales/{case['id']}/submit-tracking",
        headers=ctx["u_headers"],
        json={"carrier": "SF", "tracking_no": "SF00001111"},
    )
    assert st.json()["data"]["status"] == "return_shipped_waiting_receive"

    # 4) Merchant confirm-received → waiting_ship (EXCHANGE branch)
    cr = await client.post(
        f"/api/v1/merchant/aftersales/{case['id']}/confirm-received",
        headers=ctx["m_headers"],
        json={"note": "收到"},
    )
    assert cr.json()["data"]["status"] == "merchant_agreed_waiting_ship"

    # 5) Merchant ship-exchange
    ship = await client.post(
        f"/api/v1/merchant/aftersales/{case['id']}/ship-exchange",
        headers=ctx["m_headers"],
        json={"carrier": "SF", "tracking_no": "SF99998888"},
    )
    body = ship.json()["data"]
    assert body["status"] == "exchange_shipped_waiting_receive"
    assert body["exchange_carrier"] == "SF"

    # 6) User confirm-exchange → completed_exchanged
    confirm = await client.post(
        f"/api/v1/user/aftersales/{case['id']}/confirm-exchange",
        headers=ctx["u_headers"],
    )
    body = confirm.json()["data"]
    assert body["status"] == "completed_exchanged"
    assert body["close_reason"] == "completed"
