"""Admin category CRUD tests — contract §6.1."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.models.admin_user import AdminUser
from tests.conftest import bearer, login_admin_get_tokens


async def _admin_headers(client: AsyncClient) -> dict[str, str]:
    tokens = await login_admin_get_tokens(client, "super", "super_pwd_change_me")
    return bearer(tokens["access_token"])


@pytest.mark.asyncio
async def test_category_tree_crud_flow(
    client: AsyncClient, seed_admins: dict[str, AdminUser]
) -> None:
    _ = seed_admins
    headers = await _admin_headers(client)

    # create root
    root = await client.post(
        "/api/v1/admin/categories",
        headers=headers,
        json={"name": "数码", "slug": "digital"},
    )
    assert root.status_code == 201, root.text
    root_id = root.json()["data"]["id"]
    assert root.json()["data"]["level"] == 1
    assert root.json()["data"]["path"] == str(root_id)

    # create child
    child = await client.post(
        "/api/v1/admin/categories",
        headers=headers,
        json={"parent_id": root_id, "name": "手机通讯", "slug": "phones-comm"},
    )
    assert child.status_code == 201, child.text
    child_id = child.json()["data"]["id"]
    assert child.json()["data"]["level"] == 2
    assert child.json()["data"]["path"] == f"{root_id}/{child_id}"

    # create grandchild
    leaf = await client.post(
        "/api/v1/admin/categories",
        headers=headers,
        json={"parent_id": child_id, "name": "手机", "slug": "phones"},
    )
    assert leaf.json()["data"]["level"] == 3

    # level 4 → 6003
    over = await client.post(
        "/api/v1/admin/categories",
        headers=headers,
        json={"parent_id": leaf.json()["data"]["id"], "name": "越界", "slug": "over"},
    )
    assert over.json()["code"] == 6003

    # duplicate slug → validation
    dup = await client.post(
        "/api/v1/admin/categories",
        headers=headers,
        json={"name": "另一个", "slug": "digital"},
    )
    assert dup.json()["code"] == 5001

    # tree list
    tree = await client.get("/api/v1/admin/categories", headers=headers)
    items = tree.json()["data"]["items"]
    assert any(n["id"] == root_id and len(n["children"]) >= 1 for n in items)

    # update visibility
    upd = await client.patch(
        f"/api/v1/admin/categories/{leaf.json()['data']['id']}",
        headers=headers,
        json={"is_visible": False, "sort_order": 5},
    )
    assert upd.json()["data"]["is_visible"] is False
    assert upd.json()["data"]["sort_order"] == 5


@pytest.mark.asyncio
async def test_cannot_delete_parent_with_children(
    client: AsyncClient, seed_admins: dict[str, AdminUser]
) -> None:
    _ = seed_admins
    headers = await _admin_headers(client)

    root = (
        await client.post(
            "/api/v1/admin/categories",
            headers=headers,
            json={"name": "家居", "slug": "home"},
        )
    ).json()["data"]
    child = (
        await client.post(
            "/api/v1/admin/categories",
            headers=headers,
            json={"parent_id": root["id"], "name": "厨具", "slug": "kitchen"},
        )
    ).json()["data"]

    del_parent = await client.delete(f"/api/v1/admin/categories/{root['id']}", headers=headers)
    assert del_parent.json()["code"] == 6002

    del_child = await client.delete(f"/api/v1/admin/categories/{child['id']}", headers=headers)
    assert del_child.json()["code"] == 0

    # now parent can be deleted
    del_parent2 = await client.delete(f"/api/v1/admin/categories/{root['id']}", headers=headers)
    assert del_parent2.json()["code"] == 0


@pytest.mark.asyncio
async def test_public_tree_only_visible(
    client: AsyncClient, seed_admins: dict[str, AdminUser]
) -> None:
    _ = seed_admins
    headers = await _admin_headers(client)
    root = (
        await client.post(
            "/api/v1/admin/categories",
            headers=headers,
            json={"name": "服饰", "slug": "apparel", "is_visible": False},
        )
    ).json()["data"]

    tree = await client.get("/api/v1/catalog/categories")
    assert all(n["id"] != root["id"] for n in tree.json()["data"]["items"])
