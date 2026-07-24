"""Forgot-password / reset-password tests."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.models.user import User


@pytest.mark.asyncio
async def test_forgot_password_always_returns_ok(client: AsyncClient, seed_user: User) -> None:
    _ = seed_user
    # Existing account
    r1 = await client.post(
        "/api/v1/user/auth/forgot-password",
        json={"identifier": "13800000001"},
    )
    assert r1.json()["code"] == 0

    # Unknown account — same response (anti-enumeration)
    r2 = await client.post(
        "/api/v1/user/auth/forgot-password",
        json={"identifier": "13800009999"},
    )
    assert r2.json()["code"] == 0


@pytest.mark.asyncio
async def test_reset_password_full_flow(client: AsyncClient, seed_user: User, fake_redis) -> None:
    _ = seed_user
    # Kick off the flow so the service actually writes to Redis with
    # the same TTL contract; then peek at the code the service stored.
    await client.post(
        "/api/v1/user/auth/forgot-password",
        json={"identifier": "13800000001"},
    )
    code = await fake_redis.get("pwreset:user:13800000001")
    assert code is not None
    assert len(code) == 6

    # Wrong code → 1010
    bad = await client.post(
        "/api/v1/user/auth/reset-password",
        json={
            "identifier": "13800000001",
            "code": "000000" if code != "000000" else "111111",
            "new_password": "NewPass9",
        },
    )
    assert bad.json()["code"] == 1010

    # Correct code → 0
    good = await client.post(
        "/api/v1/user/auth/reset-password",
        json={
            "identifier": "13800000001",
            "code": code,
            "new_password": "NewPass9",
        },
    )
    assert good.json()["code"] == 0

    # Log in with the new password
    login = await client.post(
        "/api/v1/user/auth/login",
        json={"identifier": "13800000001", "password": "NewPass9"},
    )
    assert login.json()["code"] == 0

    # Old password fails
    old = await client.post(
        "/api/v1/user/auth/login",
        json={"identifier": "13800000001", "password": "Test1234"},
    )
    assert old.json()["code"] == 1003


@pytest.mark.asyncio
async def test_reset_password_unknown_identifier_uses_same_code(
    client: AsyncClient, fake_redis
) -> None:
    # Seed a code for an identifier that doesn't map to any user.
    await fake_redis.setex("pwreset:user:13899998888", 60, "654321")
    resp = await client.post(
        "/api/v1/user/auth/reset-password",
        json={
            "identifier": "13899998888",
            "code": "654321",
            "new_password": "NewPass9",
        },
    )
    # anti-enum: same 1010 as bad captcha
    assert resp.json()["code"] == 1010
