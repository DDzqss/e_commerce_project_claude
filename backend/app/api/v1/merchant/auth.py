"""Merchant-domain auth endpoints (contract §5.2)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_client_ip, get_current_merchant, get_user_agent
from app.core.database import get_db
from app.core.errors import envelope
from app.models.merchant import MerchantAccount
from app.models.refresh_token import SubjectType
from app.schemas.auth import LogoutIn, RefreshIn
from app.schemas.merchant import MerchantChangePasswordIn, MerchantLoginIn
from app.services import auth_service, merchant_service

router = APIRouter()


@router.post("/login", summary="Log in with merchant login_name")
async def login(
    payload: MerchantLoginIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    account, tokens = await auth_service.login_merchant(
        session,
        payload.login_name,
        payload.password,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    me = await merchant_service.get_me(session, account)
    return envelope(
        data={
            **tokens.model_dump(),
            "merchant_account": me.merchant_account.model_dump(mode="json"),
            "shop": me.shop.model_dump(mode="json"),
        }
    )


@router.post("/refresh", summary="Rotate merchant refresh token")
async def refresh(
    payload: RefreshIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    tokens = await auth_service.refresh_tokens(
        session,
        payload.refresh_token,
        SubjectType.MERCHANT,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=tokens.model_dump())


@router.post("/logout", summary="Merchant log out")
async def logout(
    payload: LogoutIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(get_current_merchant),
) -> dict[str, Any]:
    await auth_service.logout(
        session,
        payload.refresh_token,
        SubjectType.MERCHANT,
        account.id,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=None)


@router.post("/change-password", summary="Change merchant password")
async def change_password(
    payload: MerchantChangePasswordIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    account: MerchantAccount = Depends(get_current_merchant),
) -> dict[str, Any]:
    await merchant_service.change_password(
        session,
        account,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=None)
