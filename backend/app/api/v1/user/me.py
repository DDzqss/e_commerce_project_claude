"""User self-service endpoints (contract §6.1)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_client_ip, get_current_user, get_user_agent
from app.core.database import get_db
from app.core.errors import envelope
from app.models.user import User
from app.schemas.user import ChangePasswordIn, UserUpdateIn
from app.services import user_service

router = APIRouter()


@router.get("", summary="Get current user profile + merchant/apply context")
async def me(
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    result = await user_service.get_me(session, user)
    return envelope(data=result.model_dump())


@router.patch("", summary="Update current user profile (nickname / avatar)")
async def update_me(
    payload: UserUpdateIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    result = await user_service.update_profile(
        session,
        user,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=result.model_dump())


@router.post("/change-password", summary="Change current user password")
async def change_password(
    payload: ChangePasswordIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    await user_service.change_password(
        session,
        user,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=None)
