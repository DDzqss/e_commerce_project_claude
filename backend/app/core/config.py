"""Application configuration.

All settings are read from environment variables (or a local ``.env``
file). Use :func:`get_settings` (LRU-cached) to obtain the singleton.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration loaded from env / .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ---- App meta ---------------------------------------------------------
    PROJECT_NAME: str = "JD-Clone Backend"
    ENVIRONMENT: Literal["local", "dev", "staging", "production"] = "local"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # ---- Database ---------------------------------------------------------
    # Use asyncpg driver for SQLAlchemy 2.0 async engine.
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://jdclone:jdclone@localhost:5432/jdclone",
        description="Async SQLAlchemy DSN (postgresql+asyncpg://...).",
    )
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30
    DB_ECHO: bool = False

    # ---- Redis ------------------------------------------------------------
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis DSN. Used for cache, session, JWT blacklist, rate limiting.",
    )

    # ---- MinIO / S3 -------------------------------------------------------
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"  # noqa: S105  dev-only default; production must override via env
    MINIO_BUCKET: str = "jdclone"
    MINIO_SECURE: bool = False
    # Phase 2 additions: separate public / private buckets and upload constraints.
    MINIO_PUBLIC_BUCKET: str = "jdclone-public"
    MINIO_PRIVATE_BUCKET: str = "jdclone-private"
    MINIO_REGION: str = "us-east-1"
    MINIO_PUBLIC_BASE_URL: str | None = Field(
        default=None,
        description=(
            "Override the base URL used to build public GET links. "
            "Defaults to http(s)://{endpoint}/{bucket}. Use this when serving "
            "MinIO through a reverse proxy or CDN."
        ),
    )
    MAX_UPLOAD_SIZE_MB: int = 5
    UPLOAD_ALLOWED_CONTENT_TYPES: str = Field(
        default="image/jpeg,image/png,image/webp",
        description="Comma-separated list of allowed presign content-types.",
    )
    UPLOAD_PRESIGN_EXPIRE_SECONDS: int = 15 * 60  # 15 minutes

    @field_validator("UPLOAD_ALLOWED_CONTENT_TYPES", mode="before")
    @classmethod
    def _normalize_upload_types(cls, v: object) -> str:
        if isinstance(v, list):
            return ",".join(str(x).strip() for x in v)
        if isinstance(v, str):
            return v
        raise TypeError("UPLOAD_ALLOWED_CONTENT_TYPES must be a string or list")

    @property
    def upload_allowed_content_types_list(self) -> list[str]:
        """Return the allow-list as a stripped, non-empty list."""
        return [
            t.strip().lower() for t in self.UPLOAD_ALLOWED_CONTENT_TYPES.split(",") if t.strip()
        ]

    # ---- Auth / JWT -------------------------------------------------------
    SECRET_KEY: str = Field(
        default="CHANGE-ME-IN-PRODUCTION-please-generate-a-real-secret",
        min_length=32,
        description=(
            "Secret used to sign JWTs. MUST be overridden in prod. "
            "Minimum 32 chars per Phase 7 security baseline (§6.1)."
        ),
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 2  # 2 hours
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 14  # 14 days

    # ---- CORS -------------------------------------------------------------
    # Accepts either a comma-separated string or a real list in env.
    CORS_ORIGINS: str = Field(
        default="http://localhost:3000,http://localhost:3001,http://localhost:3002",
        description="Comma-separated list of allowed origins.",
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _normalize_cors(cls, v: object) -> str:
        if isinstance(v, list):
            return ",".join(str(x).strip() for x in v)
        if isinstance(v, str):
            return v
        raise TypeError("CORS_ORIGINS must be a comma-separated string or list")

    @property
    def cors_origins_list(self) -> list[str]:
        """Return CORS_ORIGINS as a stripped, non-empty list."""
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    # ---- Logging ----------------------------------------------------------
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"

    # ---- Phase 3 · orders / cart -----------------------------------------
    PAYMENT_TIMEOUT_MINUTES: int = 30
    AUTO_COMPLETE_DAYS: int = 15
    MAX_ADDRESSES_PER_USER: int = 20
    MAX_CART_ITEMS_PER_USER: int = 500
    MAX_CART_ITEM_QUANTITY: int = 999

    # ---- Phase 4 · aftersales --------------------------------------------
    MERCHANT_REVIEW_TIMEOUT_HOURS: int = 72
    USER_RETURN_TIMEOUT_DAYS: int = 7
    MERCHANT_RECEIVE_TIMEOUT_DAYS: int = 15
    EXCHANGE_CONFIRM_TIMEOUT_DAYS: int = 15
    NUDGE_MAX_PER_DAY: int = 3
    AFTERSALES_RISK_WINDOW_DAYS: int = 30
    AFTERSALES_RISK_THRESHOLD: int = 3
    MAX_EVIDENCE_IMAGES_PER_STAGE: int = 8

    # ---- Phase 5 · reviews / notifications / shop-profile ----------------
    REVIEW_EDIT_WINDOW_DAYS: int = 15
    MAX_REVIEW_IMAGES: int = 6
    MAX_REVIEW_LENGTH: int = 2000
    MIN_REVIEW_LENGTH: int = 5
    MAX_ANNOUNCEMENT_LENGTH: int = 2000


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the process-wide cached Settings instance."""
    return Settings()
