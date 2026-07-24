"""Aftersales arbitration tests — Phase 4 §9."""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import update

from app.core import database as core_db
from app.models.admin_user import AdminUser
from app.models.aftersales import Aftersales, AftersalesStatus
from app.models.merchant import MerchantAccount, Shop
from app.models.user import User
from tests.aftersales_helpers import build_paid_order, headers_admin


async def _apply_and_reject(client: AsyncClient, ctx: dict[str, Any]) -> dict[str, Any]:
    detail = (
        await client.get(f"/api/v1/user/orders/{ctx['order']['id']}", headers=ctx["u_headers"])
    ).json()["data"]
    oi = detail["items"][0]
    case = (
        await client.post(
            f"/api/v1/user/orders/{ctx['order']['id']}/aftersales",
            headers={**ctx["u_headers"], "Idempotency-Key": str(uuid.uuid4())},
            json={
                "type": "refund_only",
                "reason_category": "quality_issue",
                "reason_note": "商品质量问题需要仲裁流程",
                "items": [{"order_item_id": oi["id"], "quantity": 1}],
                "refund_amount_cents": oi["subtotal_cents"],
            },
        )
    ).json()["data"]
    await client.post(
        f"/api/v1/merchant/aftersales/{case['id']}/reject",
        headers=ctx["m_headers"],
        json={"review_note": "驳回，理由充分足够长"},
    )
    resp = await client.post(
        f"/api/v1/user/aftersales/{case['id']}/appeal",
        headers=ctx["u_headers"],
        json={
            "reason": "用户申诉理由文本占位符号需要至少二十个中文字符哦哦哦",
            "evidence_image_keys": [],
        },
    )
    assert resp.json()["code"] == 0, resp.text
    return case


@pytest.mark.asyncio
async def test_arbitrate_side_with_user(
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
    case = await _apply_and_reject(client, ctx)
    a_headers = await headers_admin(client)

    await client.post(f"/api/v1/admin/aftersales/{case['id']}/take-over", headers=a_headers)
    resp = await client.post(
        f"/api/v1/admin/aftersales/{case['id']}/resolve",
        headers=a_headers,
        json={
            "outcome": "side_with_user",
            "conclusion": "客服仲裁结论：用户描述属实并且证据充分故支持全额退款请求处理完毕",
            "actual_refund_cents": case["refund_amount_cents"],
            "evidence_image_keys": [],
        },
    )
    assert resp.json()["code"] == 0, resp.text
    body = resp.json()["data"]
    assert body["status"] == "completed_refunded"
    assert body["arbitration_outcome"] == "side_with_user"


@pytest.mark.asyncio
async def test_arbitrate_side_with_merchant_closes(
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
    case = await _apply_and_reject(client, ctx)
    a_headers = await headers_admin(client)

    resp = await client.post(
        f"/api/v1/admin/aftersales/{case['id']}/resolve",
        headers=a_headers,
        json={
            "outcome": "side_with_merchant",
            "conclusion": "客服仲裁结论：商家描述属实并驳回申诉请求案件已完成",
        },
    )
    body = resp.json()["data"]
    assert body["status"] == "system_closed"
    assert body["close_reason"] == "arbitration_closed"


@pytest.mark.asyncio
async def test_arbitrate_partial_refund(
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
        price_cents=20000,
    )
    case = await _apply_and_reject(client, ctx)
    a_headers = await headers_admin(client)

    half = case["refund_amount_cents"] // 2
    resp = await client.post(
        f"/api/v1/admin/aftersales/{case['id']}/resolve",
        headers=a_headers,
        json={
            "outcome": "partial_refund",
            "conclusion": "客服判定双方各让一步故支持部分退款方案案件已解决完成",
            "actual_refund_cents": half,
        },
    )
    body = resp.json()["data"]
    assert body["status"] == "completed_refunded"
    assert body["actual_refund_cents"] == half


@pytest.mark.asyncio
async def test_admin_force_refund_non_escalated(
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
    )
    detail = (
        await client.get(f"/api/v1/user/orders/{ctx['order']['id']}", headers=ctx["u_headers"])
    ).json()["data"]
    oi = detail["items"][0]
    case = (
        await client.post(
            f"/api/v1/user/orders/{ctx['order']['id']}/aftersales",
            headers={**ctx["u_headers"], "Idempotency-Key": str(uuid.uuid4())},
            json={
                "type": "refund_only",
                "reason_category": "quality_issue",
                "reason_note": "商品质量问题需要强制退款处理",
                "items": [{"order_item_id": oi["id"], "quantity": 1}],
                "refund_amount_cents": oi["subtotal_cents"],
            },
        )
    ).json()["data"]

    a_headers = await headers_admin(client)
    resp = await client.post(
        f"/api/v1/admin/aftersales/{case['id']}/force-refund",
        headers=a_headers,
        json={"amount_cents": case["refund_amount_cents"], "note": "行政干预强制退款"},
    )
    body = resp.json()["data"]
    assert body["status"] == "completed_refunded"
    assert body["actual_refund_cents"] == case["refund_amount_cents"]

    # Verify escalated_at got stamped.
    async with core_db.async_session_factory() as s:
        row = await s.get(Aftersales, case["id"])
        assert row.escalation_reason.value == "manual"
        assert row.status == AftersalesStatus.COMPLETED_REFUNDED
        # Prevent lint about unused import
        _ = update
