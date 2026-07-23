"""Upload presign tests — contract §9.

MinIO connectivity is mocked; we only verify the payload validation +
that a signed URL is returned.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest
from httpx import AsyncClient

from app.models.merchant import MerchantAccount, Shop
from tests.conftest import bearer, login_merchant_get_tokens


async def _merchant_headers(
    client: AsyncClient, seed_merchant_account: tuple[MerchantAccount, Shop]
) -> dict[str, str]:
    account, _ = seed_merchant_account
    tokens = await login_merchant_get_tokens(client, account.login_name, "Merch1234")
    return bearer(tokens["access_token"])


@pytest.mark.asyncio
async def test_presign_happy_path(
    client: AsyncClient,
    seed_merchant_account: tuple[MerchantAccount, Shop],
) -> None:
    headers = await _merchant_headers(client, seed_merchant_account)

    async def _fake_presign_put(key: str, content_type: str, **_: Any) -> str:
        return f"http://minio.local/jdclone-public/{key}?X-Amz-Signature=fake"

    with patch("app.services.upload_service.presign_put", side_effect=_fake_presign_put):
        resp = await client.post(
            "/api/v1/merchant/uploads/presign",
            headers=headers,
            json={
                "purpose": "spu_main",
                "content_type": "image/jpeg",
                "file_size": 234567,
            },
        )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["object_key"].startswith("spu/")
    assert data["object_key"].endswith(".jpg")
    assert "X-Amz-Signature" in data["upload_url"]
    assert data["public_url"].endswith(data["object_key"])


@pytest.mark.asyncio
async def test_presign_rejects_bad_content_type(
    client: AsyncClient,
    seed_merchant_account: tuple[MerchantAccount, Shop],
) -> None:
    headers = await _merchant_headers(client, seed_merchant_account)
    resp = await client.post(
        "/api/v1/merchant/uploads/presign",
        headers=headers,
        json={
            "purpose": "spu_main",
            "content_type": "application/pdf",
            "file_size": 100,
        },
    )
    assert resp.json()["code"] == 10001


@pytest.mark.asyncio
async def test_presign_rejects_too_large(
    client: AsyncClient,
    seed_merchant_account: tuple[MerchantAccount, Shop],
) -> None:
    headers = await _merchant_headers(client, seed_merchant_account)
    resp = await client.post(
        "/api/v1/merchant/uploads/presign",
        headers=headers,
        json={
            "purpose": "spu_main",
            "content_type": "image/png",
            "file_size": 10 * 1024 * 1024,  # 10 MB > 5 MB
        },
    )
    assert resp.json()["code"] == 10002
