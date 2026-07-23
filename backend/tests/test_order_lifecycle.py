"""Order lifecycle tests — contract §4 / §10.

Covers the full state-machine paths that Phase 3 owns.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select, update

from app.core import database as core_db
from app.models.admin_user import AdminUser
from app.models.merchant import MerchantAccount, Shop
from app.models.order import Order, OrderStatus
from app.models.sku import SKU
from app.models.user import User
from tests.conftest import (
    bearer,
    login_admin_get_tokens,
    login_merchant_get_tokens,
    login_user_get_tokens,
)


def _sf() -> Any:
    """Return whatever the conftest patched onto ``core_db.async_session_factory``."""
    return core_db.async_session_factory


async def _headers_user(client: AsyncClient, seed_user: User) -> dict[str, str]:
    tokens = await login_user_get_tokens(client, seed_user.phone or "", "Test1234")
    return bearer(tokens["access_token"])


async def _headers_merchant(
    client: AsyncClient, seed_merchant_account: tuple[MerchantAccount, Shop]
) -> dict[str, str]:
    account, _ = seed_merchant_account
    tokens = await login_merchant_get_tokens(client, account.login_name, "Merch1234")
    return bearer(tokens["access_token"])


async def _headers_admin(client: AsyncClient) -> dict[str, str]:
    tokens = await login_admin_get_tokens(client, "super", "super_pwd_change_me")
    return bearer(tokens["access_token"])


async def _create_order_and_return(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
    *,
    stock: int = 10,
    quantity: int = 2,
    price_cents: int = 5000,
    sku_code_suffix: str = "L",
) -> tuple[dict[str, Any], dict[str, Any], dict[str, str]]:
    """Return (created_order, sku, user_headers)."""
    u_headers = await _headers_user(client, seed_user)
    m_headers = await _headers_merchant(client, seed_merchant_account)
    a_headers = await _headers_admin(client)
    _ = seed_admins

    spu = (
        await client.post(
            "/api/v1/merchant/spus",
            headers=m_headers,
            json={
                "category_id": seed_catalog["leaf"].id,
                "brand_id": seed_catalog["brand"].id,
                "title": "生命周期商品",
                "main_image": "spu/lc.jpg",
                "spec_axes": ["color"],
            },
        )
    ).json()["data"]
    sku = (
        await client.post(
            f"/api/v1/merchant/spus/{spu['id']}/skus",
            headers=m_headers,
            json={
                "sku_code": f"LC-{sku_code_suffix}",
                "specs": {"color": "红"},
                "price_cents": price_cents,
                "stock": stock,
            },
        )
    ).json()["data"]
    await client.post(f"/api/v1/merchant/spus/{spu['id']}/submit-review", headers=m_headers)
    await client.post(f"/api/v1/admin/spus/{spu['id']}/approve", headers=a_headers, json={})

    cart_item = (
        await client.post(
            "/api/v1/user/cart/items",
            headers=u_headers,
            json={"sku_id": sku["id"], "quantity": quantity},
        )
    ).json()["data"]
    addr = (
        await client.post(
            "/api/v1/user/addresses",
            headers=u_headers,
            json={
                "receiver_name": "张三",
                "receiver_phone": "13800000001",
                "province": "浙江省",
                "city": "杭州市",
                "district": "西湖区",
                "detail": "文三路 100 号",
                "is_default": True,
            },
        )
    ).json()["data"]
    idem = str(uuid.uuid4())
    orders = (
        await client.post(
            "/api/v1/user/orders",
            headers={**u_headers, "Idempotency-Key": idem},
            json={"cart_item_ids": [cart_item["id"]], "address_id": addr["id"]},
        )
    ).json()["data"]["orders"]
    return orders[0], sku, u_headers


@pytest.mark.asyncio
async def test_user_cancel_returns_stock(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    order, sku, u_headers = await _create_order_and_return(
        client, seed_user, seed_admins, seed_merchant_account, seed_catalog, stock=10, quantity=3
    )
    # Stock should now be 7 (10 - 3).
    async with _sf()() as s:
        row = (await s.execute(select(SKU).where(SKU.id == sku["id"]))).scalar_one()
        assert row.stock == 7
        assert row.locked_stock == 3

    r = await client.post(
        f"/api/v1/user/orders/{order['id']}/cancel", headers=u_headers, json={}
    )
    assert r.json()["code"] == 0
    assert r.json()["data"]["status"] == OrderStatus.CANCELLED.value

    async with _sf()() as s:
        row = (await s.execute(select(SKU).where(SKU.id == sku["id"]))).scalar_one()
        assert row.stock == 10
        assert row.locked_stock == 0


@pytest.mark.asyncio
async def test_payment_timeout_expires_order(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    order, sku, _u = await _create_order_and_return(
        client, seed_user, seed_admins, seed_merchant_account, seed_catalog, stock=5, quantity=1
    )
    # Push the deadline into the past.
    past = datetime.now(UTC) - timedelta(minutes=1)
    async with _sf()() as s:
        await s.execute(
            update(Order).where(Order.id == order["id"]).values(payment_deadline_at=past)
        )
        await s.commit()

    # Run the scan via admin task.
    a_headers = await _headers_admin(client)
    resp = await client.post("/api/v1/admin/tasks/process-timeouts", headers=a_headers)
    assert resp.json()["data"]["expired_pending_payments"] >= 1

    # Stock restored + order status cancelled + cancel_reason set.
    async with _sf()() as s:
        o = (await s.execute(select(Order).where(Order.id == order["id"]))).scalar_one()
        assert o.status == OrderStatus.CANCELLED
        row = (await s.execute(select(SKU).where(SKU.id == sku["id"]))).scalar_one()
        assert row.stock == 5


@pytest.mark.asyncio
async def test_pay_ship_confirm_flow(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    order, sku, u_headers = await _create_order_and_return(
        client, seed_user, seed_admins, seed_merchant_account, seed_catalog, stock=5, quantity=2
    )
    m_headers = await _headers_merchant(client, seed_merchant_account)

    # Create payment session.
    pay = await client.post(
        f"/api/v1/user/orders/{order['id']}/pay",
        headers={**u_headers, "Idempotency-Key": str(uuid.uuid4())},
        json={"channel": "mock_alipay"},
    )
    session_id = pay.json()["data"]["session_id"]

    # Mock succeed.
    ms = await client.post(
        f"/api/v1/user/payment-sessions/{session_id}/mock-succeed", headers=u_headers
    )
    assert ms.json()["data"]["order_status"] == OrderStatus.PAID.value

    # Merchant ship.
    ship = await client.post(
        f"/api/v1/merchant/orders/{order['id']}/ship",
        headers=m_headers,
        json={"carrier": "SF", "tracking_no": "SF1234567890"},
    )
    detail = ship.json()["data"]
    assert detail["status"] == OrderStatus.SHIPPED.value
    assert detail["shipping_carrier"] == "SF"
    assert len(detail["shipment_events"]) == 3

    # User confirm receipt.
    cr = await client.post(
        f"/api/v1/user/orders/{order['id']}/confirm-receipt", headers=u_headers
    )
    assert cr.json()["data"]["status"] == OrderStatus.COMPLETED.value

    # sold_count on SKU should be 2 now.
    async with _sf()() as s:
        row = (await s.execute(select(SKU).where(SKU.id == sku["id"]))).scalar_one()
        assert row.sold_count == 2
        assert row.locked_stock == 0


@pytest.mark.asyncio
async def test_shipped_auto_complete_via_scan(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    order, sku, u_headers = await _create_order_and_return(
        client, seed_user, seed_admins, seed_merchant_account, seed_catalog, stock=5, quantity=1
    )
    m_headers = await _headers_merchant(client, seed_merchant_account)

    # pay + ship
    pay = await client.post(
        f"/api/v1/user/orders/{order['id']}/pay",
        headers={**u_headers, "Idempotency-Key": str(uuid.uuid4())},
        json={"channel": "mock_alipay"},
    )
    await client.post(
        f"/api/v1/user/payment-sessions/{pay.json()['data']['session_id']}/mock-succeed",
        headers=u_headers,
    )
    await client.post(
        f"/api/v1/merchant/orders/{order['id']}/ship",
        headers=m_headers,
        json={"carrier": "SF", "tracking_no": "SF9876543210"},
    )

    # Fast-forward auto_complete_at.
    past = datetime.now(UTC) - timedelta(minutes=1)
    async with _sf()() as s:
        await s.execute(
            update(Order).where(Order.id == order["id"]).values(auto_complete_at=past)
        )
        await s.commit()

    a_headers = await _headers_admin(client)
    resp = await client.post("/api/v1/admin/tasks/process-timeouts", headers=a_headers)
    assert resp.json()["data"]["auto_completed"] >= 1

    async with _sf()() as s:
        o = (await s.execute(select(Order).where(Order.id == order["id"]))).scalar_one()
        assert o.status == OrderStatus.COMPLETED
        row = (await s.execute(select(SKU).where(SKU.id == sku["id"]))).scalar_one()
        assert row.sold_count == 1
