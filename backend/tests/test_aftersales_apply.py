"""Aftersales apply tests — Phase 4 §7.1."""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from httpx import AsyncClient

from app.models.admin_user import AdminUser
from app.models.merchant import MerchantAccount, Shop
from app.models.order import OrderStatus
from app.models.user import User
from tests.aftersales_helpers import build_paid_order, set_order_status


@pytest.mark.asyncio
async def test_refund_only_apply_paid_order(
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
        quantity=2,
        price_cents=10000,
    )
    order = ctx["order"]
    detail = (
        await client.get(f"/api/v1/user/orders/{order['id']}", headers=ctx["u_headers"])
    ).json()["data"]
    oi = detail["items"][0]
    resp = await client.post(
        f"/api/v1/user/orders/{order['id']}/aftersales",
        headers={**ctx["u_headers"], "Idempotency-Key": str(uuid.uuid4())},
        json={
            "type": "refund_only",
            "reason_category": "quality_issue",
            "reason_note": "产品有明显划痕，非物流损坏说明",
            "items": [{"order_item_id": oi["id"], "quantity": oi["quantity"]}],
            "refund_amount_cents": oi["subtotal_cents"],
            "evidence_image_keys": ["aftersales/2026/07/24/xxx.jpg"],
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["type"] == "refund_only"
    assert body["data"]["status"] == "pending_merchant_review"
    assert len(body["data"]["items"]) == 1
    assert len(body["data"]["evidences"]) == 1


@pytest.mark.asyncio
async def test_return_refund_apply_completed_order(
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
    detail = (
        await client.get(f"/api/v1/user/orders/{ctx['order']['id']}", headers=ctx["u_headers"])
    ).json()["data"]
    oi = detail["items"][0]
    resp = await client.post(
        f"/api/v1/user/orders/{ctx['order']['id']}/aftersales",
        headers={**ctx["u_headers"], "Idempotency-Key": str(uuid.uuid4())},
        json={
            "type": "return_refund",
            "reason_category": "wrong_item",
            "reason_note": "收到的商品与描述不符请求退款",
            "items": [{"order_item_id": oi["id"], "quantity": 1}],
            "refund_amount_cents": oi["subtotal_cents"],
        },
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["data"]["type"] == "return_refund"


@pytest.mark.asyncio
async def test_exchange_apply_shipped_order(
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
        ship=True,
    )
    detail = (
        await client.get(f"/api/v1/user/orders/{ctx['order']['id']}", headers=ctx["u_headers"])
    ).json()["data"]
    oi = detail["items"][0]
    resp = await client.post(
        f"/api/v1/user/orders/{ctx['order']['id']}/aftersales",
        headers={**ctx["u_headers"], "Idempotency-Key": str(uuid.uuid4())},
        json={
            "type": "exchange",
            "reason_category": "wrong_item",
            "reason_note": "尺码不合适，需要换个规格再发",
            "items": [{"order_item_id": oi["id"], "quantity": 1}],
            "refund_amount_cents": 0,
        },
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["data"]["type"] == "exchange"


@pytest.mark.asyncio
async def test_apply_requires_idempotency_key(
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
    detail = (
        await client.get(f"/api/v1/user/orders/{ctx['order']['id']}", headers=ctx["u_headers"])
    ).json()["data"]
    oi = detail["items"][0]
    resp = await client.post(
        f"/api/v1/user/orders/{ctx['order']['id']}/aftersales",
        headers=ctx["u_headers"],
        json={
            "type": "refund_only",
            "reason_category": "quality_issue",
            "reason_note": "abcdefghij",
            "items": [{"order_item_id": oi["id"], "quantity": 1}],
            "refund_amount_cents": oi["subtotal_cents"],
        },
    )
    assert resp.json()["code"] == 5010


@pytest.mark.asyncio
async def test_apply_blocked_when_order_has_active_case(
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
    detail = (
        await client.get(f"/api/v1/user/orders/{ctx['order']['id']}", headers=ctx["u_headers"])
    ).json()["data"]
    oi = detail["items"][0]
    payload = {
        "type": "refund_only",
        "reason_category": "quality_issue",
        "reason_note": "第一次申请测试文本占位符号很长",
        "items": [{"order_item_id": oi["id"], "quantity": 1}],
        "refund_amount_cents": oi["subtotal_cents"],
    }
    ok = await client.post(
        f"/api/v1/user/orders/{ctx['order']['id']}/aftersales",
        headers={**ctx["u_headers"], "Idempotency-Key": str(uuid.uuid4())},
        json=payload,
    )
    assert ok.status_code == 201

    dup = await client.post(
        f"/api/v1/user/orders/{ctx['order']['id']}/aftersales",
        headers={**ctx["u_headers"], "Idempotency-Key": str(uuid.uuid4())},
        json=payload,
    )
    assert dup.json()["code"] == 15005


@pytest.mark.asyncio
async def test_apply_blocked_when_order_status_not_allowed(
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
    # Push the paid order to cancelled — no aftersales allowed.
    await set_order_status(ctx["order"]["id"], OrderStatus.CANCELLED)
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
            "reason_note": "订单已取消不能申请测试字符占位",
            "items": [{"order_item_id": oi["id"], "quantity": 1}],
            "refund_amount_cents": oi["subtotal_cents"],
        },
    )
    assert resp.json()["code"] == 15004


@pytest.mark.asyncio
async def test_apply_refund_amount_exceeds(
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
        price_cents=5000,
    )
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
            "reason_note": "退款金额超过订单金额测试字符占位",
            "items": [{"order_item_id": oi["id"], "quantity": 1}],
            "refund_amount_cents": oi["subtotal_cents"] * 5,
        },
    )
    assert resp.json()["code"] == 15006


@pytest.mark.asyncio
async def test_apply_empty_items_rejected(
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
    resp = await client.post(
        f"/api/v1/user/orders/{ctx['order']['id']}/aftersales",
        headers={**ctx["u_headers"], "Idempotency-Key": str(uuid.uuid4())},
        json={
            "type": "refund_only",
            "reason_category": "quality_issue",
            "reason_note": "items 数组为空的验证测试字符",
            "items": [],
            "refund_amount_cents": 100,
        },
    )
    # Pydantic min_length=1 → 422 validation error (5001)
    assert resp.json()["code"] == 5001


@pytest.mark.asyncio
async def test_apply_permission_denied_for_other_user_order(
    client: AsyncClient,
    seed_user: User,
    seed_second_user: User,
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
    # Login as second user, try to attack first user's order.
    from tests.aftersales_helpers import headers_user

    other_headers = await headers_user(client, seed_second_user)
    resp = await client.post(
        f"/api/v1/user/orders/{ctx['order']['id']}/aftersales",
        headers={**other_headers, "Idempotency-Key": str(uuid.uuid4())},
        json={
            "type": "refund_only",
            "reason_category": "quality_issue",
            "reason_note": "越权访问其他用户订单测试字符",
            "items": [{"order_item_id": 1, "quantity": 1}],
            "refund_amount_cents": 100,
        },
    )
    assert resp.json()["code"] == 13001
