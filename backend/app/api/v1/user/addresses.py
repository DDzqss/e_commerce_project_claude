"""User address-book endpoints — contract §6."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_client_ip, get_user_agent, require_user_permission
from app.core.database import get_db
from app.core.errors import envelope
from app.core.rbac import Permission
from app.models.user import User
from app.schemas.address import AddressCreateIn, AddressUpdateIn
from app.services import address_service

router = APIRouter()


@router.get("", summary="List user addresses")
async def list_addresses(
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_ADDRESS_MANAGE)),
) -> dict[str, Any]:
    items = await address_service.list_(session, user)
    return envelope(data={"items": [i.model_dump(mode="json") for i in items], "total": len(items)})


@router.get("/{address_id}", summary="Get one address")
async def get_address(
    address_id: int,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_ADDRESS_MANAGE)),
) -> dict[str, Any]:
    row = await address_service.get(session, user, address_id)
    return envelope(data=row.model_dump(mode="json"))


@router.post("", status_code=status.HTTP_201_CREATED, summary="Create address")
async def create_address(
    payload: AddressCreateIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_ADDRESS_MANAGE)),
) -> dict[str, Any]:
    row = await address_service.create(
        session,
        user,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=row.model_dump(mode="json"))


@router.patch("/{address_id}", summary="Update address")
async def update_address(
    address_id: int,
    payload: AddressUpdateIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_ADDRESS_MANAGE)),
) -> dict[str, Any]:
    row = await address_service.update_(
        session,
        user,
        address_id,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=row.model_dump(mode="json"))


@router.delete("/{address_id}", summary="Soft-delete address")
async def delete_address(
    address_id: int,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_ADDRESS_MANAGE)),
) -> dict[str, Any]:
    await address_service.soft_delete(
        session,
        user,
        address_id,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data={"deleted": True})


@router.post("/{address_id}/set-default", summary="Set default address")
async def set_default_address(
    address_id: int,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_ADDRESS_MANAGE)),
) -> dict[str, Any]:
    row = await address_service.set_default(
        session,
        user,
        address_id,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=row.model_dump(mode="json"))
