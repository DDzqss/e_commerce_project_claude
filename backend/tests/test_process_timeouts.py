"""Timeout scanner tests — contract §12.

Exercises ``order_service.scan_and_expire_payments`` and
``scan_and_auto_complete`` end-to-end by running them against real data
seeded by the HTTP layer.
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
from app.models.user import User
from app.services import order_service
from tests.conftest import (
    bearer,
    login_admin_get_tokens,
    login_merchant_get_tokens,
    login_user_get_tokens,
)


async def _place_order(
    client: AsyncClient,
    seed_user: User,
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
    a_headers: dict[str, str],
) -> dict[str, Any]:
    account, _ = seed_merchant_account
    u_headers = bearer(
        (await login_user_get_tokens(client, seed_user.phone or "", "Test1234"))["access_token"]
    )
    m_headers = bearer(
        (await login_merchant_get_tokens(client, account.login_name, "Merch1234"))["access_token"]
    )
    spu = (
        await client.post(
            "/api/v1/merchant/spus",
            headers=m_headers,
            json={
                "category_id": seed_catalog["leaf"].id,
                "brand_id": seed_catalog["brand"].id,
                "title": "扫描测试",
                "main_image": "spu/scan.jpg",
                "spec_axes": ["color"],
            },
        )
    ).json()["data"]
    sku = (
        await client.post(
            f"/api/v1/merchant/spus/{spu['id']}/skus",
            headers=m_headers,
            json={
                "sku_code": f"SC-{uuid.uuid4().hex[:6]}",
                "specs": {"color": "红"},
                "price_cents": 1000,
                "stock": 5,
            },
        )
    ).json()["data"]
    await client.post(f"/api/v1/merchant/spus/{spu['id']}/submit-review", headers=m_headers)
    await client.post(f"/api/v1/admin/spus/{spu['id']}/approve", headers=a_headers, json={})
    ci = (
        await client.post(
            "/api/v1/user/cart/items",
            headers=u_headers,
            json={"sku_id": sku["id"], "quantity": 1},
        )
    ).json()["data"]
    addr = (
        await client.post(
            "/api/v1/user/addresses",
            headers=u_headers,
            json={
                "receiver_name": "A",
                "receiver_phone": "13800000000",
                "province": "P",
                "city": "C",
                "district": "D",
                "detail": "detail",
                "is_default": True,
            },
        )
    ).json()["data"]
    return (
        await client.post(
            "/api/v1/user/orders",
            headers={**u_headers, "Idempotency-Key": str(uuid.uuid4())},
            json={"cart_item_ids": [ci["id"]], "address_id": addr["id"]},
        )
    ).json()["data"]["orders"][0]


@pytest.mark.asyncio
async def test_scan_expires_pending_payments(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    _ = seed_admins
    a_headers = bearer(
        (await login_admin_get_tokens(client, "super", "super_pwd_change_me"))["access_token"]
    )
    order = await _place_order(client, seed_user, seed_merchant_account, seed_catalog, a_headers)
    past = datetime.now(UTC) - timedelta(minutes=1)
    async with core_db.async_session_factory() as s:
        await s.execute(
            update(Order).where(Order.id == order["id"]).values(payment_deadline_at=past)
        )
        await s.commit()

    async with core_db.async_session_factory() as s:
        n = await order_service.scan_and_expire_payments(s)
        await s.commit()
    assert n >= 1

    async with core_db.async_session_factory() as s:
        o = (await s.execute(select(Order).where(Order.id == order["id"]))).scalar_one()
        assert o.status == OrderStatus.CANCELLED


@pytest.mark.asyncio
async def test_scan_is_idempotent(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    _ = seed_admins
    a_headers = bearer(
        (await login_admin_get_tokens(client, "super", "super_pwd_change_me"))["access_token"]
    )
    order = await _place_order(client, seed_user, seed_merchant_account, seed_catalog, a_headers)
    past = datetime.now(UTC) - timedelta(minutes=1)
    async with core_db.async_session_factory() as s:
        await s.execute(
            update(Order).where(Order.id == order["id"]).values(payment_deadline_at=past)
        )
        await s.commit()

    async with core_db.async_session_factory() as s:
        first = await order_service.scan_and_expire_payments(s)
        await s.commit()
    async with core_db.async_session_factory() as s:
        second = await order_service.scan_and_expire_payments(s)
        await s.commit()
    assert first >= 1
    assert second == 0  # nothing left to expire
