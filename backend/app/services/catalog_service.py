"""User-facing catalog / search service — contract §11.

Read-only browsing endpoints for the consumer web / app. Returns only
SPUs with ``status = approved`` and hides internal fields.
"""

from __future__ import annotations

from sqlalchemy import ColumnElement, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppException, ErrorCode
from app.models.brand import Brand
from app.models.category import Category
from app.models.product import SPU, SPUStatus
from app.schemas.catalog import (
    BrandOut,
    CategoryTreeOut,
)
from app.schemas.product import SPUDetailOut, SPUListItemOut
from app.services import brand_service, category_service, product_service

_MAX_PAGE_SIZE = 60


async def list_categories(session: AsyncSession) -> list[CategoryTreeOut]:
    """Public tree — only visible + non-deleted categories."""
    return await category_service.list_tree(session, only_visible=True)


async def list_brands(
    session: AsyncSession, *, keyword: str | None, page: int, size: int
) -> tuple[list[BrandOut], int]:
    return await brand_service.list_(
        session,
        keyword=keyword,
        only_visible=True,
        page=page,
        size=size,
    )


def _sort_expr(sort: str | None) -> ColumnElement[object]:
    if sort == "newest":
        return SPU.published_at.desc()
    if sort == "price_asc":
        return SPU.min_price_cents.asc()
    if sort == "price_desc":
        return SPU.min_price_cents.desc()
    if sort == "sales":
        return SPU.sales_count.desc()
    # default
    return SPU.published_at.desc()


async def list_spus(
    session: AsyncSession,
    *,
    category_id: int | None,
    brand_id: int | None,
    keyword: str | None,
    min_price_cents: int | None,
    max_price_cents: int | None,
    sort: str | None,
    page: int,
    size: int,
) -> tuple[list[SPUListItemOut], int]:
    size = min(size, _MAX_PAGE_SIZE)
    conds: list[ColumnElement[bool]] = [
        SPU.deleted_at.is_(None),
        SPU.status == SPUStatus.APPROVED,
    ]
    if category_id is not None:
        ids = await category_service.descendant_ids(session, category_id)
        conds.append(SPU.category_id.in_(ids))
    if brand_id is not None:
        conds.append(SPU.brand_id == brand_id)
    if keyword:
        like = f"%{keyword}%"
        conds.append(or_(SPU.title.ilike(like), SPU.subtitle.ilike(like)))
    if min_price_cents is not None:
        conds.append(SPU.min_price_cents >= min_price_cents)
    if max_price_cents is not None:
        conds.append(SPU.min_price_cents <= max_price_cents)

    total = int(
        (await session.execute(select(func.count(SPU.id)).where(and_(*conds)))).scalar_one()
    )
    stmt = (
        select(SPU)
        .where(and_(*conds))
        .order_by(_sort_expr(sort), SPU.id.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    rows = list((await session.execute(stmt)).scalars().all())
    items = await _hydrate_list_items(session, rows)
    return items, total


async def get_spu_detail(session: AsyncSession, spu_id: int) -> SPUDetailOut:
    """Get an approved SPU with breadcrumb + SKUs, and bump ``view_count``."""
    spu = await session.get(SPU, spu_id)
    if spu is None or spu.deleted_at is not None or spu.status != SPUStatus.APPROVED:
        raise AppException(ErrorCode.SPU_NOT_FOUND, "spu not found")

    spu.view_count += 1
    await session.flush()
    await session.refresh(spu)

    return await product_service._build_detail(session, spu)


async def list_related(
    session: AsyncSession, spu_id: int, *, limit: int = 8
) -> list[SPUListItemOut]:
    spu = await session.get(SPU, spu_id)
    if spu is None or spu.deleted_at is not None:
        raise AppException(ErrorCode.SPU_NOT_FOUND, "spu not found")

    stmt = (
        select(SPU)
        .where(
            SPU.deleted_at.is_(None),
            SPU.status == SPUStatus.APPROVED,
            SPU.category_id == spu.category_id,
            SPU.id != spu.id,
        )
        .order_by(SPU.sales_count.desc(), SPU.id.desc())
        .limit(limit)
    )
    rows = list((await session.execute(stmt)).scalars().all())
    return await _hydrate_list_items(session, rows)


async def _hydrate_list_items(session: AsyncSession, rows: list[SPU]) -> list[SPUListItemOut]:
    brand_ids = {r.brand_id for r in rows if r.brand_id is not None}
    cat_ids = {r.category_id for r in rows}
    brands: dict[int, Brand] = {}
    if brand_ids:
        b_rows = (
            (await session.execute(select(Brand).where(Brand.id.in_(brand_ids)))).scalars().all()
        )
        brands = {b.id: b for b in b_rows}
    cats: dict[int, Category] = {}
    if cat_ids:
        c_rows = (
            (await session.execute(select(Category).where(Category.id.in_(cat_ids))))
            .scalars()
            .all()
        )
        cats = {c.id: c for c in c_rows}

    out: list[SPUListItemOut] = []
    for r in rows:
        brand_dict = None
        if r.brand_id is not None and r.brand_id in brands:
            b = brands[r.brand_id]
            brand_dict = {
                "id": b.id,
                "name": b.name,
                "slug": b.slug,
                "logo_url": b.logo_url,
            }
        cat_dict = None
        if r.category_id in cats:
            c = cats[r.category_id]
            cat_dict = {"id": c.id, "name": c.name, "slug": c.slug}
        out.append(
            SPUListItemOut(
                id=r.id,
                title=r.title,
                subtitle=r.subtitle,
                main_image=r.main_image,
                min_price_cents=r.min_price_cents,
                max_price_cents=r.max_price_cents,
                sales_count=r.sales_count,
                brand=brand_dict,  # type: ignore[arg-type]
                category=cat_dict,  # type: ignore[arg-type]
            )
        )
    return out


async def list_recommendations(session: AsyncSession, *, limit: int = 10) -> list[SPUListItemOut]:
    """Phase 2 minimal: latest approved SPUs."""
    stmt = (
        select(SPU)
        .where(SPU.deleted_at.is_(None), SPU.status == SPUStatus.APPROVED)
        .order_by(SPU.published_at.desc().nullslast(), SPU.id.desc())
        .limit(limit)
    )
    rows = list((await session.execute(stmt)).scalars().all())
    return await _hydrate_list_items(session, rows)


__all__ = [
    "get_spu_detail",
    "list_brands",
    "list_categories",
    "list_recommendations",
    "list_related",
    "list_spus",
]
