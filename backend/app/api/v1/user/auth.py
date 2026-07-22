"""User-domain auth endpoints (contract §5.1)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_client_ip, get_current_user, get_user_agent
from app.core.database import get_db
from app.core.errors import envelope
from app.core.redis import get_redis
from app.models.refresh_token import SubjectType
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordIn,
    LogoutIn,
    RefreshIn,
    ResetPasswordIn,
    UserLoginIn,
    UserRegisterIn,
)
from app.services import auth_service

router = APIRouter()


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    summary="Register a consumer account",
)
async def register(
    payload: UserRegisterIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    result = await auth_service.register_user(
        session,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=result.model_dump())


@router.post("/login", summary="Log in with phone or email")
async def login(
    payload: UserLoginIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    result = await auth_service.login_user(
        session,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=result.model_dump())


@router.post("/refresh", summary="Rotate refresh token")
async def refresh(
    payload: RefreshIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    result = await auth_service.refresh_tokens(
        session,
        payload.refresh_token,
        SubjectType.USER,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=result.model_dump())


@router.post("/logout", summary="Log out (revoke refresh)")
async def logout(
    payload: LogoutIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    await auth_service.logout(
        session,
        payload.refresh_token,
        SubjectType.USER,
        user.id,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=None)


@router.post("/forgot-password", summary="Send a password-reset code (simulated)")
async def forgot_password(
    payload: ForgotPasswordIn,
    redis=Depends(get_redis),
) -> dict[str, Any]:
    await auth_service.forgot_password(redis, payload)
    return envelope(message="verification code sent", data=None)


@router.post("/reset-password", summary="Reset password using verification code")
async def reset_password(
    payload: ResetPasswordIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
) -> dict[str, Any]:
    await auth_service.reset_password(
        session,
        redis,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=None)
