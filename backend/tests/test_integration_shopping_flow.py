"""Phase 7 · end-to-end integration tests.

These sit at a higher altitude than the per-feature phase tests: each test
chains 6+ real HTTP endpoints together to verify the whole path works with
the state-machine, side-tables, and cross-actor authorization all wired up
correctly. They also serve as a regression net for the perf changes made
in Phase 7 (batch order-item preload, review preload) — the shipping and
aftersales flows exercise ``list_by_user`` / ``list_by_merchant`` which
now hit the batched loader.
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core import database as core_db
from app.models.admin_user import AdminUser
from app.models.merchant import MerchantAccount, Shop
from app.models.order import Order, OrderStatus
from app.models.sku import SKU
from tests.conftest import (
    bearer,
    login_admin_get_tokens,
    login_merchant_get_tokens,
)


def _sf() -> Any:
    """Return whatever the conftest patched onto ``core_db.async_session_factory``."""
    return core_db.async_session_factory


async def _register_and_login(client: AsyncClient, phone: str) -> dict[str, str]:
    """Register a fresh consumer user and return an Authorization header."""
    resp = await client.post(
        "/api/v1/user/auth/register",
        json={"phone": phone, "password": "GoodPass1", "nickname": "集成小明"},
    )
    assert resp.status_code == 201, resp.text
    tokens = resp.json()["data"]
    return bearer(tokens["access_token"])


async def _publish_sku(
    client: AsyncClient,
    m_headers: dict[str, str],
    a_headers: dict[str, str],
    catalog: dict[str, Any],
    *,
    title: str,
    price_cents: int,
    stock: int,
    sku_code_suffix: str,
) -> dict[str, Any]:
    spu = (
        await client.post(
            "/api/v1/merchant/spus",
            headers=m_headers,
            json={
                "category_id": catalog["leaf"].id,
                "brand_id": catalog["brand"].id,
                "title": title,
                "main_image": "spu/integ.jpg",
                "spec_axes": ["color"],
            },
        )
    ).json()["data"]
    sku = (
        await client.post(
            f"/api/v1/merchant/spus/{spu['id']}/skus",
            headers=m_headers,
            json={
                "sku_code": f"INT-{sku_code_suffix}",
                "specs": {"color": "红"},
                "price_cents": price_cents,
                "stock": stock,
            },
        )
    ).json()["data"]
    await client.post(f"/api/v1/merchant/spus/{spu['id']}/submit-review", headers=m_headers)
    await client.post(f"/api/v1/admin/spus/{spu['id']}/approve", headers=a_headers, json={})
    return sku


@pytest.mark.asyncio
async def test_user_shops_pays_gets_shipped_confirms(
    client: AsyncClient,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    """Golden path: register → cart → checkout → pay → ship → confirm.

    Covers 10 endpoints in one test. Asserts stock/sold-count deltas and
    the final order state.
    """
    _ = seed_admins  # required to insert the "super" admin used below
    account, _shop = seed_merchant_account
    m_headers = bearer(
        (await login_merchant_get_tokens(client, account.login_name, "Merch1234"))["access_token"]
    )
    a_headers = bearer(
        (await login_admin_get_tokens(client, "super", "super_pwd_change_me"))["access_token"]
    )

    # 1) register + login as a brand-new user (not the shared seed_user)
    u_headers = await _register_and_login(client, "13900000001")

    # 2) merchant + admin seed an approved SKU for the shop
    sku = await _publish_sku(
        client,
        m_headers,
        a_headers,
        seed_catalog,
        title="集成测试手机",
        price_cents=99900,
        stock=10,
        sku_code_suffix="A",
    )
    initial_stock = sku["stock"]

    # 3) user adds SKU to cart
    cart_item = (
        await client.post(
            "/api/v1/user/cart/items",
            headers=u_headers,
            json={"sku_id": sku["id"], "quantity": 1},
        )
    ).json()["data"]

    # 4) user creates a default address
    addr_id = (
        await client.post(
            "/api/v1/user/addresses",
            headers=u_headers,
            json={
                "receiver_name": "集成小明",
                "receiver_phone": "13900000001",
                "province": "广东省",
                "city": "深圳市",
                "district": "南山区",
                "detail": "科技园南路 1 号",
                "is_default": True,
            },
        )
    ).json()["data"]["id"]

    # verify default address surfaces via list
    addr_list = (await client.get("/api/v1/user/addresses", headers=u_headers)).json()["data"]
    assert any(a["is_default"] for a in addr_list["items"])

    # 5) preview
    preview = (
        await client.post(
            "/api/v1/user/orders/preview",
            headers=u_headers,
            json={"cart_item_ids": [cart_item["id"]], "address_id": addr_id},
        )
    ).json()["data"]
    assert len(preview["groups_by_shop"]) == 1
    assert preview["grand_total_cents"] == sku["price_cents"]
    assert preview["warnings"] == []

    # 6) create the order (Idempotency-Key required)
    idem = str(uuid.uuid4())
    create_resp = await client.post(
        "/api/v1/user/orders",
        headers={**u_headers, "Idempotency-Key": idem},
        json={
            "cart_item_ids": [cart_item["id"]],
            "address_id": addr_id,
            "user_note": "集成流程",
        },
    )
    assert create_resp.status_code == 201
    order = create_resp.json()["data"]["orders"][0]
    order_id = order["id"]
    assert order["total_cents"] == sku["price_cents"]

    # 7) create a payment session
    pay_resp = await client.post(
        f"/api/v1/user/orders/{order_id}/pay",
        headers={**u_headers, "Idempotency-Key": str(uuid.uuid4())},
        json={"channel": "mock_alipay"},
    )
    session_id = pay_resp.json()["data"]["session_id"]

    # 8) mock the payment succeeding → order flips to paid
    mock_resp = await client.post(
        f"/api/v1/user/payment-sessions/{session_id}/mock-succeed",
        headers=u_headers,
    )
    assert mock_resp.json()["data"]["order_status"] == OrderStatus.PAID.value

    # 9) merchant ships (paid → shipped) and 3 fake shipment events land
    ship_resp = await client.post(
        f"/api/v1/merchant/orders/{order_id}/ship",
        headers=m_headers,
        json={"carrier": "SF", "tracking_no": "SF1234567890"},
    )
    ship_body = ship_resp.json()["data"]
    assert ship_body["status"] == OrderStatus.SHIPPED.value
    assert ship_body["shipping_carrier"] == "SF"
    assert ship_body["tracking_no"] == "SF1234567890"
    assert len(ship_body["shipment_events"]) == 3

    # 10) user confirms receipt (shipped → completed)
    confirm_resp = await client.post(
        f"/api/v1/user/orders/{order_id}/confirm-receipt", headers=u_headers
    )
    confirm_body = confirm_resp.json()["data"]
    assert confirm_body["status"] == OrderStatus.COMPLETED.value

    # Cross-check DB side effects: stock deducted by 1, sold_count += 1, no locks left.
    async with _sf()() as s:
        sku_row = (await s.execute(select(SKU).where(SKU.id == sku["id"]))).scalar_one()
        assert sku_row.stock == initial_stock - 1
        assert sku_row.sold_count == 1
        assert sku_row.locked_stock == 0
        order_row = (await s.execute(select(Order).where(Order.id == order_id))).scalar_one()
        assert order_row.status == OrderStatus.COMPLETED
        assert order_row.completed_at is not None

    # User's order list should show the completed order (exercises the batched
    # ``_load_order_items_bulk`` path added in Phase 7).
    list_resp = await client.get("/api/v1/user/orders?status=completed", headers=u_headers)
    listed = list_resp.json()["data"]["items"]
    assert any(o["id"] == order_id and o["status"] == "completed" for o in listed)


@pytest.mark.asyncio
async def test_aftersales_return_refund_end_to_end(
    client: AsyncClient,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    """Full return-refund path once an order is completed.

    Chains: apply → merchant approves + gives return address → user submits
    tracking → merchant confirms received → refund auto-fires. Verifies the
    aftersales case ends in ``completed_refunded`` with a refund txn number
    and that the order-side link records the refund.
    """
    _ = seed_admins
    account, _shop = seed_merchant_account
    m_headers = bearer(
        (await login_merchant_get_tokens(client, account.login_name, "Merch1234"))["access_token"]
    )
    a_headers = bearer(
        (await login_admin_get_tokens(client, "super", "super_pwd_change_me"))["access_token"]
    )
    u_headers = await _register_and_login(client, "13900000002")

    sku = await _publish_sku(
        client,
        m_headers,
        a_headers,
        seed_catalog,
        title="集成测试耳机",
        price_cents=45000,
        stock=5,
        sku_code_suffix="B",
    )

    # Reach "completed" via the same helper flow as the golden path.
    ci = (
        await client.post(
            "/api/v1/user/cart/items",
            headers=u_headers,
            json={"sku_id": sku["id"], "quantity": 1},
        )
    ).json()["data"]
    addr_id = (
        await client.post(
            "/api/v1/user/addresses",
            headers=u_headers,
            json={
                "receiver_name": "集成小明",
                "receiver_phone": "13900000002",
                "province": "广东省",
                "city": "深圳市",
                "district": "南山区",
                "detail": "科技园南路 2 号",
                "is_default": True,
            },
        )
    ).json()["data"]["id"]
    order = (
        await client.post(
            "/api/v1/user/orders",
            headers={**u_headers, "Idempotency-Key": str(uuid.uuid4())},
            json={"cart_item_ids": [ci["id"]], "address_id": addr_id},
        )
    ).json()["data"]["orders"][0]
    order_id = order["id"]
    total_cents = order["total_cents"]

    pay = await client.post(
        f"/api/v1/user/orders/{order_id}/pay",
        headers={**u_headers, "Idempotency-Key": str(uuid.uuid4())},
        json={"channel": "mock_alipay"},
    )
    await client.post(
        f"/api/v1/user/payment-sessions/{pay.json()['data']['session_id']}/mock-succeed",
        headers=u_headers,
    )
    await client.post(
        f"/api/v1/merchant/orders/{order_id}/ship",
        headers=m_headers,
        json={"carrier": "SF", "tracking_no": "SF9990001111"},
    )
    await client.post(f"/api/v1/user/orders/{order_id}/confirm-receipt", headers=u_headers)

    # Grab the order-item id for the aftersales items payload.
    detail = (await client.get(f"/api/v1/user/orders/{order_id}", headers=u_headers)).json()["data"]
    oi = detail["items"][0]

    # 1) user files an aftersales case (return_refund on the completed order)
    apply_resp = await client.post(
        f"/api/v1/user/orders/{order_id}/aftersales",
        headers={**u_headers, "Idempotency-Key": str(uuid.uuid4())},
        json={
            "type": "return_refund",
            "reason_category": "quality_issue",
            "reason_note": "外壳有明显划痕，不满足使用需求，需要退货退款",
            "items": [{"order_item_id": oi["id"], "quantity": oi["quantity"]}],
            "refund_amount_cents": oi["subtotal_cents"],
            "evidence_image_keys": ["aftersales/scratch.jpg"],
        },
    )
    assert apply_resp.status_code == 201, apply_resp.text
    aftersales = apply_resp.json()["data"]
    aftersales_id = aftersales["id"]
    assert aftersales["status"] == "pending_merchant_review"
    assert aftersales["type"] == "return_refund"

    # 2) merchant approves and sets a return address
    approve_resp = await client.post(
        f"/api/v1/merchant/aftersales/{aftersales_id}/approve",
        headers=m_headers,
        json={
            "actual_refund_cents": oi["subtotal_cents"],
            "return_address": "深圳市南山区退货收件仓 A-01",
            "review_note": "同意退货，返回后处理",
        },
    )
    approved = approve_resp.json()["data"]
    assert approved["status"] == "merchant_agreed_waiting_return"
    assert approved["return_address"] == "深圳市南山区退货收件仓 A-01"

    # 3) user submits return tracking
    submit_resp = await client.post(
        f"/api/v1/user/aftersales/{aftersales_id}/submit-tracking",
        headers=u_headers,
        json={"carrier": "SF", "tracking_no": "SF-RET-001"},
    )
    submitted = submit_resp.json()["data"]
    assert submitted["status"] == "return_shipped_waiting_receive"
    assert submitted["return_tracking_no"] == "SF-RET-001"

    # 4) merchant confirms received → auto refund triggers via _trigger_refund
    recv_resp = await client.post(
        f"/api/v1/merchant/aftersales/{aftersales_id}/confirm-received",
        headers=m_headers,
        json={"note": "货已收到，状态良好", "evidence_image_keys": []},
    )
    recv = recv_resp.json()["data"]
    assert recv["status"] == "completed_refunded", recv
    assert recv["refund_txn_no"], "refund_txn_no should be set after mock refund"
    assert recv["closed_at"] is not None
    assert recv["close_reason"] == "completed"

    # 5) order-side link: full refund → order closed + total_refunded_cents recorded.
    async with _sf()() as s:
        order_row = (await s.execute(select(Order).where(Order.id == order_id))).scalar_one()
        assert order_row.total_refunded_cents == total_cents
        # Full refund closes the order (contract §13).
        assert order_row.status == OrderStatus.CLOSED
        # Not partial when the whole total was refunded.
        assert order_row.has_partial_refund is False
