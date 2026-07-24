"""Aftersales risk-flag test — Phase 4 §14."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import update

from app.core import database as core_db
from app.models.admin_user import AdminUser
from app.models.aftersales import Aftersales
from app.models.merchant import MerchantAccount, Shop
from app.models.user import User
from tests.aftersales_helpers import build_paid_order


@pytest.mark.asyncio
async def test_risk_flag_auto_escalates_new_case(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    # Create 3 refund_only aftersales cases and manually mark them as
    # completed_refunded within the last 30 days.
    completed_ids: list[int] = []
    for _ in range(3):
        ctx = await build_paid_order(
            client,
            seed_user,
            seed_admins,
            seed_merchant_account,
            seed_catalog,
            stock=5,
            quantity=1,
            price_cents=5000,
        )
        oi = (
            await client.get(f"/api/v1/user/orders/{ctx['order']['id']}", headers=ctx["u_headers"])
        ).json()["data"]["items"][0]
        case = (
            await client.post(
                f"/api/v1/user/orders/{ctx['order']['id']}/aftersales",
                headers={**ctx["u_headers"], "Idempotency-Key": str(uuid.uuid4())},
                json={
                    "type": "refund_only",
                    "reason_category": "quality_issue",
                    "reason_note": "商品质量问题需要退款测试风控频次",
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
        completed_ids.append(case["id"])

    # Mark refunded_at ~1 day ago (within 30d window) — service defaults to now
    # but we double-check by explicitly stamping older timestamps.
    async with core_db.async_session_factory() as s:
        await s.execute(
            update(Aftersales)
            .where(Aftersales.id.in_(completed_ids))
            .values(refunded_at=datetime.now(UTC) - timedelta(days=1))
        )
        await s.commit()

    # New order + new aftersales should be auto-escalated by risk rule.
    ctx = await build_paid_order(
        client,
        seed_user,
        seed_admins,
        seed_merchant_account,
        seed_catalog,
        stock=5,
        quantity=1,
        price_cents=5000,
    )
    oi = (
        await client.get(f"/api/v1/user/orders/{ctx['order']['id']}", headers=ctx["u_headers"])
    ).json()["data"]["items"][0]
    new_case = (
        await client.post(
            f"/api/v1/user/orders/{ctx['order']['id']}/aftersales",
            headers={**ctx["u_headers"], "Idempotency-Key": str(uuid.uuid4())},
            json={
                "type": "refund_only",
                "reason_category": "quality_issue",
                "reason_note": "第四次退款测试风控自动升级至平台",
                "items": [{"order_item_id": oi["id"], "quantity": 1}],
                "refund_amount_cents": oi["subtotal_cents"],
            },
        )
    ).json()["data"]
    assert new_case["status"] == "admin_arbitrating"
    assert new_case["escalation_reason"] == "risk_flagged"
