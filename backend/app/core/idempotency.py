"""Idempotency-key helpers — contract §14.

Phase 3 keeps the implementation deliberately simple: the key is passed
via the ``Idempotency-Key`` header and enforced at the database layer
via the ``UNIQUE(user_id, idempotency_key)`` constraint on ``orders``.
The service layer catches the resulting integrity error and returns the
prior order instead of a duplicate insert.

For the payment-session endpoint the equivalent guarantee is provided
by the partial ``UNIQUE(order_id) WHERE status='pending'`` index on
``payment_sessions``.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Header

from app.core.errors import AppException, ErrorCode

_MIN_LEN = 8
_MAX_LEN = 120


def require_idempotency_key(
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> str:
    """FastAPI dependency: extract & validate the ``Idempotency-Key`` header.

    Raises ``IDEMPOTENCY_KEY_MISSING`` (422) if absent or malformed.
    """
    if idempotency_key is None:
        raise AppException(
            ErrorCode.IDEMPOTENCY_KEY_MISSING,
            "Idempotency-Key header is required",
        )
    key = idempotency_key.strip()
    if not (_MIN_LEN <= len(key) <= _MAX_LEN):
        raise AppException(
            ErrorCode.IDEMPOTENCY_KEY_MISSING,
            f"Idempotency-Key must be {_MIN_LEN}..{_MAX_LEN} chars",
        )
    return key


__all__ = ["require_idempotency_key"]
