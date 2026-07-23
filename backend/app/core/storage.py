"""S3-compatible object storage helpers (MinIO in dev).

Uses ``aioboto3`` so presign / put operations are natively async and
integrate cleanly with FastAPI request handlers.
"""

from __future__ import annotations

import logging
from typing import Any

import aioboto3
from botocore.client import Config

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def _s3_endpoint_url() -> str:
    settings = get_settings()
    scheme = "https" if settings.MINIO_SECURE else "http"
    return f"{scheme}://{settings.MINIO_ENDPOINT}"


def _s3_client_kwargs() -> dict[str, Any]:
    settings = get_settings()
    return {
        "endpoint_url": _s3_endpoint_url(),
        "aws_access_key_id": settings.MINIO_ACCESS_KEY,
        "aws_secret_access_key": settings.MINIO_SECRET_KEY,
        "region_name": settings.MINIO_REGION,
        # SigV4 + path-style is the MinIO default and works with hostnames
        # that contain a colon (``localhost:9000``).
        "config": Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
        ),
    }


def get_session() -> aioboto3.Session:
    """Return a shared aioboto3 session."""
    return aioboto3.Session()


async def presign_put(
    object_key: str,
    content_type: str,
    *,
    bucket: str | None = None,
    expires: int | None = None,
) -> str:
    """Generate a presigned PUT URL for direct browser upload.

    The client MUST send the same ``Content-Type`` header when doing the
    actual PUT, otherwise the signature check will fail.
    """
    settings = get_settings()
    bucket_name = bucket or settings.MINIO_PUBLIC_BUCKET
    expires_in = expires or settings.UPLOAD_PRESIGN_EXPIRE_SECONDS

    session = get_session()
    async with session.client("s3", **_s3_client_kwargs()) as s3:
        url: str = await s3.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": bucket_name,
                "Key": object_key,
                "ContentType": content_type,
            },
            ExpiresIn=expires_in,
            HttpMethod="PUT",
        )
    return url


def build_public_url(object_key: str, *, bucket: str | None = None) -> str:
    """Build the public GET URL for an object in the public bucket.

    Prefer ``MINIO_PUBLIC_BASE_URL`` when it is configured (e.g. CDN),
    otherwise fall back to ``{scheme}://{endpoint}/{bucket}/{key}``.
    """
    settings = get_settings()
    bucket_name = bucket or settings.MINIO_PUBLIC_BUCKET
    if settings.MINIO_PUBLIC_BASE_URL:
        base = settings.MINIO_PUBLIC_BASE_URL.rstrip("/")
        return f"{base}/{object_key}"
    return f"{_s3_endpoint_url()}/{bucket_name}/{object_key}"


__all__ = ["build_public_url", "get_session", "presign_put"]
