"""Category (product taxonomy) service — contract §6.1.

Handles the 3-level hierarchy: level/path are derived on create.
Reparenting is disallowed; delete + recreate is the only supported flow.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppException, ErrorCode
from app.models.category import Category
from app.models.product import SPU
from app.schemas.catalog import (
    CategoryCreateIn,
    CategoryOut,
    CategoryTreeOut,
    CategoryUpdateIn,
)

_MAX_LEVEL = 3


async def _slug_exists(session: AsyncSession, slug: str, *, exclude_id: int | None = None) -> bool:
    stmt = select(Category.id).where(Category.slug == slug, Category.deleted_at.is_(None))
    if exclude_id is not None:
        stmt = stmt.where(Category.id != exclude_id)
    return (await session.execute(stmt)).scalar_one_or_none() is not None


async def _sibling_name_exists(
    session: AsyncSession,
    parent_id: int | None,
    name: str,
    *,
    exclude_id: int | None = None,
) -> bool:
    conds = [
        Category.name == name,
        Category.deleted_at.is_(None),
    ]
    if parent_id is None:
        conds.append(Category.parent_id.is_(None))
    else:
        conds.append(Category.parent_id == parent_id)
    stmt = select(Category.id).where(and_(*conds))
    if exclude_id is not None:
        stmt = stmt.where(Category.id != exclude_id)
    return (await session.execute(stmt)).scalar_one_or_none() is not None


async def _get_active(session: AsyncSession, category_id: int) -> Category:
    row = await session.get(Category, category_id)
    if row is None or row.deleted_at is not None:
        raise AppException(ErrorCode.CATEGORY_NOT_FOUND, "category not found")
    return row


async def list_all(session: AsyncSession, *, only_visible: bool = False) -> list[Category]:
    """Return every non-deleted category, ordered for tree assembly."""
    stmt = select(Category).where(Category.deleted_at.is_(None))
    if only_visible:
        stmt = stmt.where(Category.is_visible.is_(True))
    stmt = stmt.order_by(Category.level, Category.sort_order, Category.id)
    return list((await session.execute(stmt)).scalars().all())


async def list_tree(session: AsyncSession, *, only_visible: bool = False) -> list[CategoryTreeOut]:
    """Return the hierarchy as nested ``CategoryTreeOut`` roots."""
    rows = await list_all(session, only_visible=only_visible)
    nodes: dict[int, CategoryTreeOut] = {
        r.id: CategoryTreeOut.model_validate({**CategoryOut.model_validate(r).model_dump()})
        for r in rows
    }
    roots: list[CategoryTreeOut] = []
    for r in rows:
        node = nodes[r.id]
        if r.parent_id is None:
            roots.append(node)
        else:
            parent = nodes.get(r.parent_id)
            if parent is not None:
                parent.children.append(node)
    return roots


async def get(session: AsyncSession, category_id: int) -> CategoryOut:
    row = await _get_active(session, category_id)
    return CategoryOut.model_validate(row)


async def create(session: AsyncSession, payload: CategoryCreateIn) -> CategoryOut:
    """Create a category, deriving ``level`` and ``path``."""
    if await _slug_exists(session, payload.slug):
        raise AppException(ErrorCode.VALIDATION_ERROR, f"slug '{payload.slug}' already exists")
    if await _sibling_name_exists(session, payload.parent_id, payload.name):
        raise AppException(
            ErrorCode.VALIDATION_ERROR,
            "a sibling category with this name already exists",
        )

    parent: Category | None = None
    if payload.parent_id is not None:
        parent = await _get_active(session, payload.parent_id)
        if parent.level >= _MAX_LEVEL:
            raise AppException(
                ErrorCode.CATEGORY_LEVEL_EXCEEDED,
                f"category depth exceeds {_MAX_LEVEL}",
            )

    level = 1 if parent is None else parent.level + 1
    row = Category(
        parent_id=payload.parent_id,
        name=payload.name,
        slug=payload.slug,
        level=level,
        path="pending",  # will be rewritten right after flush to know id
        icon_url=payload.icon_url,
        sort_order=payload.sort_order,
        is_visible=payload.is_visible,
    )
    session.add(row)
    await session.flush()

    row.path = f"{parent.path}/{row.id}" if parent is not None else str(row.id)
    await session.flush()
    await session.refresh(row)
    return CategoryOut.model_validate(row)


async def update(
    session: AsyncSession,
    category_id: int,
    payload: CategoryUpdateIn,
) -> CategoryOut:
    """Update whitelisted fields; parent_id is deliberately immutable."""
    row = await _get_active(session, category_id)

    if payload.slug is not None and payload.slug != row.slug:
        if await _slug_exists(session, payload.slug, exclude_id=row.id):
            raise AppException(ErrorCode.VALIDATION_ERROR, f"slug '{payload.slug}' already exists")
        row.slug = payload.slug
    if payload.name is not None and payload.name != row.name:
        if await _sibling_name_exists(session, row.parent_id, payload.name, exclude_id=row.id):
            raise AppException(
                ErrorCode.VALIDATION_ERROR,
                "a sibling category with this name already exists",
            )
        row.name = payload.name
    if payload.icon_url is not None:
        row.icon_url = payload.icon_url
    if payload.sort_order is not None:
        row.sort_order = payload.sort_order
    if payload.is_visible is not None:
        row.is_visible = payload.is_visible

    await session.flush()
    await session.refresh(row)
    return CategoryOut.model_validate(row)


async def soft_delete(session: AsyncSession, category_id: int) -> None:
    """Soft-delete a leaf category with no SPU references."""
    row = await _get_active(session, category_id)

    child_stmt = select(func.count(Category.id)).where(
        Category.parent_id == row.id, Category.deleted_at.is_(None)
    )
    if int((await session.execute(child_stmt)).scalar_one()) > 0:
        raise AppException(
            ErrorCode.CATEGORY_IN_USE,
            "cannot delete a category with children",
        )

    spu_stmt = select(func.count(SPU.id)).where(SPU.category_id == row.id, SPU.deleted_at.is_(None))
    if int((await session.execute(spu_stmt)).scalar_one()) > 0:
        raise AppException(
            ErrorCode.CATEGORY_IN_USE,
            "cannot delete a category referenced by SPUs",
        )

    row.deleted_at = datetime.now(UTC)
    await session.flush()


async def descendant_ids(session: AsyncSession, category_id: int) -> list[int]:
    """Return ``[category_id]`` plus all descendant IDs (self-included)."""
    root = await _get_active(session, category_id)
    prefix = f"{root.path}/"
    stmt = select(Category.id).where(
        Category.deleted_at.is_(None),
        (Category.id == root.id) | (Category.path.like(f"{prefix}%")),
    )
    return [int(x) for x in (await session.execute(stmt)).scalars().all()]


__all__ = [
    "create",
    "descendant_ids",
    "get",
    "list_all",
    "list_tree",
    "soft_delete",
    "update",
]
