"""Application error codes, exception type, and FastAPI handlers.

All handlers emit the unified ``{code, message, data}`` envelope defined
in the API contract §1. Business error codes are the 4-digit integers
in §2 (see :class:`ErrorCode`).
"""

from __future__ import annotations

import enum
import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class ErrorCode(int, enum.Enum):
    """Business error codes (contract §2). ``0`` = success."""

    OK = 0

    # 1xxx — auth & session
    UNAUTHENTICATED = 1001
    TOKEN_EXPIRED = 1002
    BAD_CREDENTIALS = 1003
    ACCOUNT_DISABLED = 1004
    INVALID_REFRESH_TOKEN = 1005
    INVALID_CAPTCHA = 1010
    PERMISSION_DENIED = 1020

    # 2xxx — user profile
    USER_NOT_FOUND = 2001
    PHONE_ALREADY_REGISTERED = 2002
    EMAIL_ALREADY_REGISTERED = 2003
    OLD_PASSWORD_MISMATCH = 2010

    # 3xxx — merchant & onboarding
    APPLICATION_ALREADY_PENDING = 3001
    ALREADY_A_MERCHANT = 3002
    APPLICATION_NOT_FOUND = 3003
    APPLICATION_STATUS_INVALID_FOR_ACTION = 3004
    MERCHANT_ACCOUNT_FROZEN = 3010

    # 4xxx — admin
    ADMIN_NOT_FOUND = 4001
    ADMIN_PERMISSION_DENIED = 4020

    # 5xxx — validation & generic
    VALIDATION_ERROR = 5001
    RESOURCE_NOT_FOUND = 5002
    RATE_LIMITED = 5003

    # 9xxx — server
    INTERNAL_ERROR = 9000


# ---------------------------------------------------------------------------
# Default HTTP status per error code
# ---------------------------------------------------------------------------
_DEFAULT_HTTP_STATUS: dict[ErrorCode, int] = {
    ErrorCode.OK: status.HTTP_200_OK,
    ErrorCode.UNAUTHENTICATED: status.HTTP_401_UNAUTHORIZED,
    ErrorCode.TOKEN_EXPIRED: status.HTTP_401_UNAUTHORIZED,
    ErrorCode.BAD_CREDENTIALS: status.HTTP_400_BAD_REQUEST,
    ErrorCode.ACCOUNT_DISABLED: status.HTTP_403_FORBIDDEN,
    ErrorCode.INVALID_REFRESH_TOKEN: status.HTTP_401_UNAUTHORIZED,
    ErrorCode.INVALID_CAPTCHA: status.HTTP_400_BAD_REQUEST,
    ErrorCode.PERMISSION_DENIED: status.HTTP_403_FORBIDDEN,
    ErrorCode.USER_NOT_FOUND: status.HTTP_404_NOT_FOUND,
    ErrorCode.PHONE_ALREADY_REGISTERED: status.HTTP_409_CONFLICT,
    ErrorCode.EMAIL_ALREADY_REGISTERED: status.HTTP_409_CONFLICT,
    ErrorCode.OLD_PASSWORD_MISMATCH: status.HTTP_400_BAD_REQUEST,
    ErrorCode.APPLICATION_ALREADY_PENDING: status.HTTP_409_CONFLICT,
    ErrorCode.ALREADY_A_MERCHANT: status.HTTP_409_CONFLICT,
    ErrorCode.APPLICATION_NOT_FOUND: status.HTTP_404_NOT_FOUND,
    ErrorCode.APPLICATION_STATUS_INVALID_FOR_ACTION: status.HTTP_409_CONFLICT,
    ErrorCode.MERCHANT_ACCOUNT_FROZEN: status.HTTP_403_FORBIDDEN,
    ErrorCode.ADMIN_NOT_FOUND: status.HTTP_404_NOT_FOUND,
    ErrorCode.ADMIN_PERMISSION_DENIED: status.HTTP_403_FORBIDDEN,
    ErrorCode.VALIDATION_ERROR: 422,
    ErrorCode.RESOURCE_NOT_FOUND: status.HTTP_404_NOT_FOUND,
    ErrorCode.RATE_LIMITED: status.HTTP_429_TOO_MANY_REQUESTS,
    ErrorCode.INTERNAL_ERROR: status.HTTP_500_INTERNAL_SERVER_ERROR,
}


class AppException(Exception):
    """Business exception carrying an :class:`ErrorCode` and HTTP status."""

    def __init__(
        self,
        code: ErrorCode,
        message: str | None = None,
        *,
        http_status: int | None = None,
        data: Any = None,
    ) -> None:
        self.code = code
        self.message = message or code.name.lower().replace("_", " ")
        self.http_status = http_status or _DEFAULT_HTTP_STATUS.get(
            code, status.HTTP_400_BAD_REQUEST
        )
        self.data = data
        super().__init__(self.message)


def envelope(
    *,
    code: ErrorCode | int = ErrorCode.OK,
    message: str = "ok",
    data: Any = None,
) -> dict[str, Any]:
    """Build the standard ``{code, message, data}`` response body."""
    code_int = code.value if isinstance(code, ErrorCode) else int(code)
    return {"code": code_int, "message": message, "data": data}


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------
async def _app_exception_handler(_: Request, exc: AppException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.http_status,
        content=envelope(code=exc.code, message=exc.message, data=exc.data),
    )


async def _validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    errors = [
        {"loc": list(err.get("loc", [])), "msg": err.get("msg"), "type": err.get("type")}
        for err in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content=envelope(
            code=ErrorCode.VALIDATION_ERROR,
            message="validation error",
            data={"errors": errors},
        ),
    )


async def _http_exception_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    # Map common HTTP statuses to closest business code so front-end
    # can rely on the envelope even for framework-raised exceptions.
    fallback = ErrorCode.INTERNAL_ERROR
    if exc.status_code == status.HTTP_401_UNAUTHORIZED:
        fallback = ErrorCode.UNAUTHENTICATED
    elif exc.status_code == status.HTTP_403_FORBIDDEN:
        fallback = ErrorCode.PERMISSION_DENIED
    elif exc.status_code == status.HTTP_404_NOT_FOUND:
        fallback = ErrorCode.RESOURCE_NOT_FOUND
    elif exc.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
        fallback = ErrorCode.RATE_LIMITED

    return JSONResponse(
        status_code=exc.status_code,
        content=envelope(code=fallback, message=str(exc.detail), data=None),
    )


async def _unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled exception: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=envelope(code=ErrorCode.INTERNAL_ERROR, message="internal error", data=None),
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Wire all custom exception handlers onto the FastAPI app."""
    app.add_exception_handler(AppException, _app_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(
        RequestValidationError,
        _validation_exception_handler,  # type: ignore[arg-type]
    )
    app.add_exception_handler(
        StarletteHTTPException,
        _http_exception_handler,  # type: ignore[arg-type]
    )
    app.add_exception_handler(Exception, _unhandled_exception_handler)


__all__ = [
    "AppException",
    "ErrorCode",
    "envelope",
    "register_exception_handlers",
]
