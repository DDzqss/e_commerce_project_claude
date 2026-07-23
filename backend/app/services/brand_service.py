"""Brand service — contract §6.2."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppException, ErrorCode
from app.models.brand import Brand
from app.schemas.catalog import BrandCreateIn, BrandOut, BrandUpdateIn


async def _get_active(session: AsyncSession, brand_id: int) -> Brand:
    row = await session.get(Brand, brand_id)
    if row is None or row.deleted_at is not None:
        raise AppException(ErrorCode.BRAND_NOT_FOUND, "brand not found")
    return row


async def _slug_exists(session: AsyncSession, slug: str, *, exclude_id: int | None = None) -> bool:
    stmt = select(Brand.id).where(Brand.slug == slug, Brand.deleted_at.is_(None))
    if exclude_id is not None:
        stmt = stmt.where(Brand.id != exclude_id)
    return (await session.execute(stmt)).scalar_one_or_none() is not None


async def _name_exists(session: AsyncSession, name: str, *, exclude_id: int | None = None) -> bool:
    stmt = select(Brand.id).where(Brand.name == name, Brand.deleted_at.is_(None))
    if exclude_id is not None:
        stmt = stmt.where(Brand.id != exclude_id)
    return (await session.execute(stmt)).scalar_one_or_none() is not None


async def get(session: AsyncSession, brand_id: int) -> BrandOut:
    row = await _get_active(session, brand_id)
    return BrandOut.model_validate(row)


async def list_(
    session: AsyncSession,
    *,
    keyword: str | None,
    only_visible: bool,
    page: int,
    size: int,
) -> tuple[list[BrandOut], int]:
    conds = [Brand.deleted_at.is_(None)]
    if only_visible:
        conds.append(Brand.is_visible.is_(True))
    if keyword:
        like = f"%{keyword}%"
        conds.append(or_(Brand.name.ilike(like), Brand.slug.ilike(like)))

    total_stmt = select(func.count(Brand.id)).where(*conds)
    total = int((await session.execute(total_stmt)).scalar_one())

    stmt = (
        select(Brand)
        .where(*conds)
        .order_by(Brand.sort_order, Brand.id)
        .offset((page - 1) * size)
        .limit(size)
    )
    rows = list((await session.execute(stmt)).scalars().all())
    return [BrandOut.model_validate(r) for r in rows], total


async def create(session: AsyncSession, payload: BrandCreateIn) -> BrandOut:
    if await _slug_exists(session, payload.slug):
        raise AppException(ErrorCode.BRAND_SLUG_CONFLICT, f"slug '{payload.slug}' already exists")
    if await _name_exists(session, payload.name):
        raise AppException(
            ErrorCode.VALIDATION_ERROR, f"brand name '{payload.name}' already exists"
        )

    row = Brand(
        name=payload.name,
        slug=payload.slug,
        logo_url=payload.logo_url,
        description=payload.description,
        sort_order=payload.sort_order,
        is_visible=payload.is_visible,
    )
    session.add(row)
    await session.flush()
    await session.refresh(row)
    return BrandOut.model_validate(row)


async def update(session: AsyncSession, brand_id: int, payload: BrandUpdateIn) -> BrandOut:
    row = await _get_active(session, brand_id)

    if payload.slug is not None and payload.slug != row.slug:
        if await _slug_exists(session, payload.slug, exclude_id=row.id):
            raise AppException(
                ErrorCode.BRAND_SLUG_CONFLICT, f"slug '{payload.slug}' already exists"
            )
        row.slug = payload.slug
    if payload.name is not None and payload.name != row.name:
        if await _name_exists(session, payload.name, exclude_id=row.id):
            raise AppException(
                ErrorCode.VALIDATION_ERROR,
                f"brand name '{payload.name}' already exists",
            )
        row.name = payload.name
    if payload.logo_url is not None:
        row.logo_url = payload.logo_url
    if payload.description is not None:
        row.description = payload.description
    if payload.sort_order is not None:
        row.sort_order = payload.sort_order
    if payload.is_visible is not None:
        row.is_visible = payload.is_visible

    await session.flush()
    await session.refresh(row)
    return BrandOut.model_validate(row)


async def soft_delete(session: AsyncSession, brand_id: int) -> None:
    row = await _get_active(session, brand_id)
    row.deleted_at = datetime.now(UTC)
    await session.flush()


__all__ = ["create", "get", "list_", "soft_delete", "update"]
