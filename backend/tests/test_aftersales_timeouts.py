"""Aftersales timeout-scanner tests — Phase 4 §11."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import update

from app.core import database as core_db
from app.models.admin_user import AdminUser
from app.models.aftersales import Aftersales, AftersalesStatus
from app.models.merchant import MerchantAccount, Shop
from app.models.user import User
from app.services import aftersales_service
from tests.aftersales_helpers import build_paid_order


async def _make_return_refund_case(
    client: AsyncClient, ctx: dict[str, Any], *, approve: bool = False
) -> dict[str, Any]:
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
                "type": "return_refund",
                "reason_category": "quality_issue",
                "reason_note": "商品质量问题需要退货退款测试超时",
                "items": [{"order_item_id": oi["id"], "quantity": 1}],
                "refund_amount_cents": oi["subtotal_cents"],
            },
        )
    ).json()["data"]
    if approve:
        await client.post(
            f"/api/v1/merchant/aftersales/{case['id']}/approve",
            headers=ctx["m_headers"],
            json={
                "actual_refund_cents": case["refund_amount_cents"],
                "return_address": "浙江省杭州市 XX 路 XX 号",
                "review_note": "同意退货",
            },
        )
    return case


@pytest.mark.asyncio
async def test_merchant_review_timeout_escalates(
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
        complete=True,
    )
    case = await _make_return_refund_case(client, ctx)
    past = datetime.now(UTC) - timedelta(minutes=1)
    async with core_db.async_session_factory() as s:
        await s.execute(
            update(Aftersales)
            .where(Aftersales.id == case["id"])
            .values(merchant_review_deadline=past)
        )
        await s.commit()
        n = await aftersales_service.scan_merchant_review_timeouts(s)
        await s.commit()
    assert n >= 1
    async with core_db.async_session_factory() as s:
        row = await s.get(Aftersales, case["id"])
        assert row.status == AftersalesStatus.ADMIN_ARBITRATING
        assert row.escalation_reason.value == "merchant_timeout"


@pytest.mark.asyncio
async def test_user_return_timeout_closes(
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
        complete=True,
    )
    case = await _make_return_refund_case(client, ctx, approve=True)
    past = datetime.now(UTC) - timedelta(minutes=1)
    async with core_db.async_session_factory() as s:
        await s.execute(
            update(Aftersales).where(Aftersales.id == case["id"]).values(return_ship_deadline=past)
        )
        await s.commit()
        n = await aftersales_service.scan_user_return_timeouts(s)
        await s.commit()
    assert n >= 1
    async with core_db.async_session_factory() as s:
        row = await s.get(Aftersales, case["id"])
        assert row.status == AftersalesStatus.SYSTEM_CLOSED
        assert row.close_reason.value == "user_ship_timeout"


@pytest.mark.asyncio
async def test_merchant_receive_timeout_auto_refunds(
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
        complete=True,
    )
    case = await _make_return_refund_case(client, ctx, approve=True)
    await client.post(
        f"/api/v1/user/aftersales/{case['id']}/submit-tracking",
        headers=ctx["u_headers"],
        json={"carrier": "SF", "tracking_no": "SF12345678"},
    )
    past = datetime.now(UTC) - timedelta(minutes=1)
    async with core_db.async_session_factory() as s:
        await s.execute(
            update(Aftersales)
            .where(Aftersales.id == case["id"])
            .values(merchant_receive_deadline=past)
        )
        await s.commit()
        n = await aftersales_service.scan_merchant_receive_timeouts(s)
        await s.commit()
    assert n >= 1
    async with core_db.async_session_factory() as s:
        row = await s.get(Aftersales, case["id"])
        assert row.status == AftersalesStatus.COMPLETED_REFUNDED
        assert row.refund_txn_no is not None


@pytest.mark.asyncio
async def test_exchange_confirm_timeout_completes(
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
        complete=True,
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
                "type": "exchange",
                "reason_category": "wrong_item",
                "reason_note": "尺码不合适需要换货处理超时测试",
                "items": [{"order_item_id": oi["id"], "quantity": 1}],
                "refund_amount_cents": 0,
            },
        )
    ).json()["data"]
    await client.post(
        f"/api/v1/merchant/aftersales/{case['id']}/approve",
        headers=ctx["m_headers"],
        json={
            "actual_refund_cents": 0,
            "return_address": "杭州市文三路 100 号",
            "review_note": "同意换货",
        },
    )
    await client.post(
        f"/api/v1/user/aftersales/{case['id']}/submit-tracking",
        headers=ctx["u_headers"],
        json={"carrier": "SF", "tracking_no": "SF99887766"},
    )
    await client.post(
        f"/api/v1/merchant/aftersales/{case['id']}/confirm-received",
        headers=ctx["m_headers"],
        json={"note": "收到"},
    )
    await client.post(
        f"/api/v1/merchant/aftersales/{case['id']}/ship-exchange",
        headers=ctx["m_headers"],
        json={"carrier": "SF", "tracking_no": "SF44556677"},
    )
    past = datetime.now(UTC) - timedelta(minutes=1)
    async with core_db.async_session_factory() as s:
        await s.execute(
            update(Aftersales)
            .where(Aftersales.id == case["id"])
            .values(exchange_confirm_deadline=past)
        )
        await s.commit()
        n = await aftersales_service.scan_exchange_confirm_timeouts(s)
        await s.commit()
    assert n >= 1
    async with core_db.async_session_factory() as s:
        row = await s.get(Aftersales, case["id"])
        assert row.status == AftersalesStatus.COMPLETED_EXCHANGED
        assert row.close_reason.value == "auto_confirmed"
