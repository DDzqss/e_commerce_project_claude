"""Security primitives: password hashing, JWT encode/decode, refresh token helpers.

JWT scheme (contract §10):
- HS256, signed with :attr:`app.core.config.Settings.SECRET_KEY`
- ``aud`` claim identifies the identity domain: ``user`` / ``merchant`` / ``admin``
- Access tokens carry ``exp`` (default 15 minutes)
- Refresh tokens are **opaque random strings** (not JWTs), stored as
  SHA-256 hash in the ``refresh_tokens`` table.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

_settings = get_settings()

# rounds=12 per contract; bcrypt limits passwords to 72 bytes so we truncate
# defensively at the application layer via schema validators.
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

# JWT audience claim: which identity domain the token is for.
Audience = Literal["user", "merchant", "admin"]


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------
def hash_password(plain: str) -> str:
    """Hash a plaintext password using bcrypt (rounds=12)."""
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    return _pwd_context.verify(plain, hashed)


# ---------------------------------------------------------------------------
# Access JWT
# ---------------------------------------------------------------------------
def create_access_token(
    *,
    subject: str | int,
    audience: Audience,
    extra_claims: dict[str, Any] | None = None,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a signed access JWT.

    Access tokens are short-lived (contract §10, default 15 minutes).
    """
    now = datetime.now(UTC)
    # Contract §10: TTL = 15 minutes for access tokens. Fall back to the
    # settings value so ops can override.
    delta = expires_delta or timedelta(minutes=15)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "aud": audience,
        "iat": int(now.timestamp()),
        "exp": int((now + delta).timestamp()),
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, _settings.SECRET_KEY, algorithm=_settings.JWT_ALGORITHM)


def decode_access_token(token: str, *, audience: Audience) -> dict[str, Any]:
    """Decode & validate a JWT for the given audience.

    Raises :class:`jose.JWTError` (or a subclass such as
    ``ExpiredSignatureError``) on failure — callers translate those to
    ``AppException`` with the appropriate business code.
    """
    try:
        return jwt.decode(
            token,
            _settings.SECRET_KEY,
            algorithms=[_settings.JWT_ALGORITHM],
            audience=audience,
        )
    except JWTError:
        raise


# ---------------------------------------------------------------------------
# Refresh tokens (opaque random string + SHA-256 hash)
# ---------------------------------------------------------------------------
def generate_refresh_token() -> str:
    """Generate a cryptographically-random opaque refresh token."""
    # 48 bytes -> ~64 url-safe chars, matching contract §10.
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    """SHA-256 hash of a refresh token (hex-encoded)."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


__all__ = [
    "Audience",
    "create_access_token",
    "decode_access_token",
    "generate_refresh_token",
    "hash_password",
    "hash_refresh_token",
    "verify_password",
]
