"""Notification tests — Phase 5 contract §6."""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin_user import AdminUser
from app.models.merchant import MerchantAccount, Shop
from app.models.notification import (
    Notification,
    NotificationCategory,
    NotificationRecipientType,
)
from app.models.user import User
from tests.aftersales_helpers import (
    bearer,
    build_paid_order,
    headers_admin,
    headers_merchant,
    headers_user,
    login_admin_get_tokens,
)


async def _seed_notifications(
    session: AsyncSession,
    *,
    recipient_type: NotificationRecipientType,
    recipient_id: int,
    count_unread: int = 2,
    count_read: int = 1,
) -> None:
    for i in range(count_unread):
        session.add(
            Notification(
                recipient_type=recipient_type,
                recipient_id=recipient_id,
                category=NotificationCategory.SYSTEM,
                title=f"未读通知 {i}",
                body=f"body-unread-{i}",
                is_read=False,
            )
        )
    for i in range(count_read):
        session.add(
            Notification(
                recipient_type=recipient_type,
                recipient_id=recipient_id,
                category=NotificationCategory.ORDER,
                title=f"已读通知 {i}",
                body=f"body-read-{i}",
                is_read=True,
            )
        )
    await session.commit()


@pytest.mark.asyncio
async def test_list_notifications_and_unread_count(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    db_session: AsyncSession,
) -> None:
    account, _shop = seed_merchant_account
    admin = seed_admins["SUPER_ADMIN"]

    await _seed_notifications(
        db_session,
        recipient_type=NotificationRecipientType.USER,
        recipient_id=seed_user.id,
        count_unread=2,
        count_read=1,
    )
    await _seed_notifications(
        db_session,
        recipient_type=NotificationRecipientType.MERCHANT,
        recipient_id=account.id,
        count_unread=3,
        count_read=0,
    )
    await _seed_notifications(
        db_session,
        recipient_type=NotificationRecipientType.ADMIN,
        recipient_id=admin.id,
        count_unread=1,
        count_read=2,
    )

    u_headers = await headers_user(client, seed_user)
    m_headers = await headers_merchant(client, seed_merchant_account)
    a_headers = await headers_admin(client)  # super

    u_list = (await client.get("/api/v1/user/notifications", headers=u_headers)).json()
    assert u_list["code"] == 0
    assert u_list["data"]["total"] == 3
    assert u_list["data"]["unread_total"] == 2

    u_cnt = (await client.get("/api/v1/user/notifications/unread-count", headers=u_headers)).json()
    assert u_cnt["data"]["count"] == 2

    m_cnt = (
        await client.get("/api/v1/merchant/notifications/unread-count", headers=m_headers)
    ).json()
    assert m_cnt["data"]["count"] == 3

    a_cnt = (await client.get("/api/v1/admin/notifications/unread-count", headers=a_headers)).json()
    assert a_cnt["data"]["count"] == 1


@pytest.mark.asyncio
async def test_mark_read_and_mark_all_read(
    client: AsyncClient,
    seed_user: User,
    db_session: AsyncSession,
) -> None:
    await _seed_notifications(
        db_session,
        recipient_type=NotificationRecipientType.USER,
        recipient_id=seed_user.id,
        count_unread=3,
        count_read=0,
    )
    u_headers = await headers_user(client, seed_user)

    listing = (await client.get("/api/v1/user/notifications", headers=u_headers)).json()["data"]
    first_id = listing["items"][0]["id"]

    one = await client.post(f"/api/v1/user/notifications/{first_id}/read", headers=u_headers)
    assert one.json()["code"] == 0
    assert one.json()["data"]["is_read"] is True

    left = (await client.get("/api/v1/user/notifications/unread-count", headers=u_headers)).json()[
        "data"
    ]["count"]
    assert left == 2

    all_read = await client.post("/api/v1/user/notifications/read-all", headers=u_headers)
    assert all_read.json()["code"] == 0
    assert all_read.json()["data"]["updated"] == 2

    final_count = (
        await client.get("/api/v1/user/notifications/unread-count", headers=u_headers)
    ).json()["data"]["count"]
    assert final_count == 0


@pytest.mark.asyncio
async def test_event_driven_creation(
    client: AsyncClient,
    seed_user: User,
    seed_admins: dict[str, AdminUser],
    seed_merchant_account: tuple[MerchantAccount, Shop],
    seed_catalog: dict[str, Any],
) -> None:
    """Trigger a real business event (aftersales approve) and confirm the
    corresponding user notification lands in the inbox."""
    ctx = await build_paid_order(
        client,
        seed_user,
        seed_admins,
        seed_merchant_account,
        seed_catalog,
        stock=5,
        quantity=1,
        price_cents=8000,
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
                "type": "refund_only",
                "reason_category": "quality_issue",
                "reason_note": "商品质量问题请求退款测试字符占位",
                "items": [{"order_item_id": oi["id"], "quantity": 1}],
                "refund_amount_cents": oi["subtotal_cents"],
            },
        )
    ).json()["data"]

    # Merchant approves — this fires notify_user (event=merchant_approved).
    approve = await client.post(
        f"/api/v1/merchant/aftersales/{case['id']}/approve",
        headers=ctx["m_headers"],
        json={"actual_refund_cents": case["refund_amount_cents"], "review_note": "同意退款申请"},
    )
    assert approve.json()["code"] == 0

    listing = (await client.get("/api/v1/user/notifications", headers=ctx["u_headers"])).json()[
        "data"
    ]
    aftersales_related = [
        n
        for n in listing["items"]
        if n["category"] == "aftersales" and n["related_id"] == case["id"]
    ]
    assert aftersales_related, f"expected an aftersales notification, got {listing['items']!r}"


@pytest.mark.asyncio
async def test_delete_notification(
    client: AsyncClient,
    seed_admins: dict[str, AdminUser],
    db_session: AsyncSession,
) -> None:
    admin = seed_admins["SUPER_ADMIN"]
    await _seed_notifications(
        db_session,
        recipient_type=NotificationRecipientType.ADMIN,
        recipient_id=admin.id,
        count_unread=1,
        count_read=2,
    )
    tokens = await login_admin_get_tokens(client, "super", "super_pwd_change_me")
    a_headers = bearer(tokens["access_token"])

    listing = (await client.get("/api/v1/admin/notifications", headers=a_headers)).json()["data"]
    target_id = listing["items"][0]["id"]

    one = await client.delete(f"/api/v1/admin/notifications/{target_id}", headers=a_headers)
    assert one.json()["code"] == 0
    assert one.json()["data"]["deleted"] is True

    # Idempotency: hitting a missing id → 22001.
    miss = await client.delete(f"/api/v1/admin/notifications/{target_id}", headers=a_headers)
    assert miss.json()["code"] == 22001

    # Remaining rows still visible in the inbox.
    after = (await client.get("/api/v1/admin/notifications", headers=a_headers)).json()["data"]
    assert after["total"] == 2
