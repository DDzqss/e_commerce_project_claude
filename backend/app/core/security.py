"""Security primitives: password hashing and JWT encode/decode.

These are placeholder-quality implementations. They are correct enough
for local development and testing, but the auth feature branch is
expected to layer on refresh-token rotation, Redis-backed blacklists,
and rate limiting.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

_settings = get_settings()

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

TokenType = Literal["access", "refresh"]


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------
def hash_password(plain: str) -> str:
    """Hash a plaintext password using bcrypt."""
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    return _pwd_context.verify(plain, hashed)


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------
def _create_token(
    subject: str,
    token_type: TokenType,
    expires_delta: timedelta,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, _settings.SECRET_KEY, algorithm=_settings.JWT_ALGORITHM)


def create_access_token(
    subject: str,
    extra_claims: dict[str, Any] | None = None,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a short-lived access token."""
    delta = expires_delta or timedelta(minutes=_settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return _create_token(subject, "access", delta, extra_claims)


def create_refresh_token(
    subject: str,
    extra_claims: dict[str, Any] | None = None,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a long-lived refresh token."""
    delta = expires_delta or timedelta(minutes=_settings.REFRESH_TOKEN_EXPIRE_MINUTES)
    return _create_token(subject, "refresh", delta, extra_claims)


def decode_token(token: str) -> dict[str, Any]:
    """Decode & validate a JWT. Raises :class:`JWTError` on failure."""
    try:
        return jwt.decode(
            token,
            _settings.SECRET_KEY,
            algorithms=[_settings.JWT_ALGORITHM],
        )
    except JWTError:
        # Re-raise as-is so callers can distinguish auth errors.
        raise
