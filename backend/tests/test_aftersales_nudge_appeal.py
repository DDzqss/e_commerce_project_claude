"""Aftersales nudge & appeal tests — Phase 4 §7.7 / §7.8."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import update

from app.core import database as core_db
from app.models.admin_user import AdminUser
from app.models.aftersales_message import AftersalesMessage, AftersalesMessageKind
from app.models.merchant import MerchantAccount, Shop
from app.models.user import User
from tests.aftersales_helpers import build_paid_order


async def _make_pending_case(client: AsyncClient, ctx: dict[str, Any]) -> dict[str, Any]:
    detail = (
        await client.get(f"/api/v1/user/orders/{ctx['order']['id']}", headers=ctx["u_headers"])
    ).json()["data"]
    oi = detail["items"][0]
    resp = await client.post(
        f"/api/v1/user/orders/{ctx['order']['id']}/aftersales",
        headers={**ctx["u_headers"], "Idempotency-Key": str(uuid.uuid4())},
        json={
            "type": "refund_only",
            "reason_category": "quality_issue",
            "reason_note": "商品质量问题需要退款测试催办功能",
            "items": [{"order_item_id": oi["id"], "quantity": 1}],
            "refund_amount_cents": oi["subtotal_cents"],
        },
    )
    return resp.json()["data"]


@pytest.mark.asyncio
async def test_nudge_rate_limit_3_per_24h(
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
    case = await _make_pending_case(client, ctx)
    for i in range(3):
        resp = await client.post(
            f"/api/v1/user/aftersales/{case['id']}/nudge", headers=ctx["u_headers"]
        )
        assert resp.json()["code"] == 0
        assert resp.json()["data"]["nudge_count"] == i + 1

    over = await client.post(
        f"/api/v1/user/aftersales/{case['id']}/nudge", headers=ctx["u_headers"]
    )
    assert over.json()["code"] == 5003


@pytest.mark.asyncio
async def test_nudge_reopens_after_24h(
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
    case = await _make_pending_case(client, ctx)
    for _ in range(3):
        await client.post(f"/api/v1/user/aftersales/{case['id']}/nudge", headers=ctx["u_headers"])
    # Push messages back in time so they're outside the 24h window.
    old = datetime.now(UTC) - timedelta(hours=25)
    async with core_db.async_session_factory() as s:
        await s.execute(
            update(AftersalesMessage)
            .where(
                AftersalesMessage.aftersales_id == case["id"],
                AftersalesMessage.kind == AftersalesMessageKind.NUDGE,
            )
            .values(created_at=old)
        )
        await s.commit()

    resp = await client.post(
        f"/api/v1/user/aftersales/{case['id']}/nudge", headers=ctx["u_headers"]
    )
    assert resp.json()["code"] == 0


@pytest.mark.asyncio
async def test_appeal_only_once_and_not_in_arbitration(
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
    case = await _make_pending_case(client, ctx)
    # Merchant reject.
    await client.post(
        f"/api/v1/merchant/aftersales/{case['id']}/reject",
        headers=ctx["m_headers"],
        json={"review_note": "驳回，理由充分足够长"},
    )
    # First appeal succeeds.
    ok = await client.post(
        f"/api/v1/user/aftersales/{case['id']}/appeal",
        headers=ctx["u_headers"],
        json={
            "reason": "第一次申诉理由文本占位需要至少二十个字符哦哦哦",
            "evidence_image_keys": [],
        },
    )
    assert ok.json()["code"] == 0
    # Second appeal blocked (already in arbitration).
    dup = await client.post(
        f"/api/v1/user/aftersales/{case['id']}/appeal",
        headers=ctx["u_headers"],
        json={
            "reason": "第二次申诉理由文本占位需要至少二十个字符哦哦哦",
            "evidence_image_keys": [],
        },
    )
    assert dup.json()["code"] in {15009, 15003}
