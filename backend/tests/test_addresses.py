"""User address-book tests — contract §6."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.models.user import User
from tests.conftest import bearer, login_user_get_tokens


async def _user_headers(client: AsyncClient, seed_user: User) -> dict[str, str]:
    tokens = await login_user_get_tokens(client, seed_user.phone or "", "Test1234")
    return bearer(tokens["access_token"])


def _addr_payload(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "receiver_name": "张三",
        "receiver_phone": "13800000001",
        "province": "浙江省",
        "city": "杭州市",
        "district": "西湖区",
        "detail": "文三路 100 号 A 楼 3 层",
        "postal_code": "310012",
        "is_default": False,
    }
    base.update(overrides)
    return base


@pytest.mark.asyncio
async def test_create_and_list_addresses(client: AsyncClient, seed_user: User) -> None:
    headers = await _user_headers(client, seed_user)
    r1 = await client.post("/api/v1/user/addresses", headers=headers, json=_addr_payload())
    assert r1.json()["code"] == 0
    assert r1.json()["data"]["is_default"] is True  # first one auto-default

    r2 = await client.post(
        "/api/v1/user/addresses",
        headers=headers,
        json=_addr_payload(receiver_name="李四", is_default=True),
    )
    assert r2.json()["code"] == 0
    assert r2.json()["data"]["is_default"] is True

    lst = await client.get("/api/v1/user/addresses", headers=headers)
    items = lst.json()["data"]["items"]
    assert len(items) == 2
    # first row must be current default (李四)
    assert items[0]["receiver_name"] == "李四"
    assert items[0]["is_default"] is True
    assert items[1]["is_default"] is False


@pytest.mark.asyncio
async def test_update_and_set_default(client: AsyncClient, seed_user: User) -> None:
    headers = await _user_headers(client, seed_user)
    a = (await client.post("/api/v1/user/addresses", headers=headers, json=_addr_payload())).json()[
        "data"
    ]
    b = (await client.post("/api/v1/user/addresses", headers=headers, json=_addr_payload())).json()[
        "data"
    ]
    # update a's detail
    upd = await client.patch(
        f"/api/v1/user/addresses/{a['id']}",
        headers=headers,
        json={"detail": "新地址 200 号"},
    )
    assert upd.json()["data"]["detail"] == "新地址 200 号"
    # promote b to default
    resp = await client.post(f"/api/v1/user/addresses/{b['id']}/set-default", headers=headers)
    assert resp.json()["data"]["is_default"] is True

    lst = (await client.get("/api/v1/user/addresses", headers=headers)).json()["data"]["items"]
    default_ids = [x["id"] for x in lst if x["is_default"]]
    assert default_ids == [b["id"]]


@pytest.mark.asyncio
async def test_delete_default_does_not_reassign(client: AsyncClient, seed_user: User) -> None:
    headers = await _user_headers(client, seed_user)
    a = (await client.post("/api/v1/user/addresses", headers=headers, json=_addr_payload())).json()[
        "data"
    ]
    _b = (
        await client.post("/api/v1/user/addresses", headers=headers, json=_addr_payload())
    ).json()["data"]
    resp = await client.delete(f"/api/v1/user/addresses/{a['id']}", headers=headers)
    assert resp.json()["data"]["deleted"] is True

    lst = (await client.get("/api/v1/user/addresses", headers=headers)).json()["data"]["items"]
    default_ids = [x["id"] for x in lst if x["is_default"]]
    assert default_ids == []  # no auto reassignment


@pytest.mark.asyncio
async def test_address_limit_cap(client: AsyncClient, seed_user: User) -> None:
    headers = await _user_headers(client, seed_user)
    # 20 addresses ok; 21st should 11003
    for _i in range(20):
        r = await client.post("/api/v1/user/addresses", headers=headers, json=_addr_payload())
        assert r.json()["code"] == 0
    resp = await client.post("/api/v1/user/addresses", headers=headers, json=_addr_payload())
    assert resp.json()["code"] == 11003


@pytest.mark.asyncio
async def test_address_not_owned_returns_11002(
    client: AsyncClient, seed_user: User, seed_second_user: User
) -> None:
    other_headers = bearer(
        (await login_user_get_tokens(client, seed_second_user.phone or "", "Test1234"))[
            "access_token"
        ]
    )
    owner_headers = await _user_headers(client, seed_user)
    a = (
        await client.post("/api/v1/user/addresses", headers=owner_headers, json=_addr_payload())
    ).json()["data"]
    r = await client.get(f"/api/v1/user/addresses/{a['id']}", headers=other_headers)
    assert r.json()["code"] == 11002
