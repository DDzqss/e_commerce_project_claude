"""SPU (Standard Product Unit) service — contract §7 / §8.1.

Implements the merchandising state machine described in §4:

    draft ─(submit-review)─▶ pending_review ─(admin approve)─▶ approved
      ▲                          │                                  │
      │                          │(admin reject)                    │
      │                          ▼                                  ▼
      └──(admin edit critical)─ rejected                        off_shelf
                                                                    │
                                    (merchant onshelf) ─────────────┘

Critical fields (title / category_id / main_image / spec_axes) edited
while in ``approved`` or ``off_shelf`` state auto-revert the SPU to
``pending_review``; non-critical edits are effective immediately.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppException, ErrorCode
from app.models.admin_user import AdminUser
from app.models.audit_log import AuditActorType
from app.models.brand import Brand
from app.models.category import Category
from app.models.merchant import MerchantAccount, Shop
from app.models.product import SPU, SPUStatus
from app.models.sku import SKU
from app.schemas.catalog import (
    BrandBriefOut,
    CategoryBriefOut,
    CategoryPathNode,
)
from app.schemas.product import (
    ShopBriefOut,
    SPUCreateIn,
    SPUDetailOut,
    SPUListItemOut,
    SPUOut,
    SPUUpdateIn,
)
from app.schemas.sku import SKUOut
from app.services.audit_service import write_audit

_CRITICAL_FIELDS: frozenset[str] = frozenset({"title", "category_id", "main_image", "spec_axes"})


# ---------------------------------------------------------------------------
# Loaders / helpers
# ---------------------------------------------------------------------------
async def _load_spu(session: AsyncSession, spu_id: int) -> SPU:
    row = await session.get(SPU, spu_id)
    if row is None or row.deleted_at is not None:
        raise AppException(ErrorCode.SPU_NOT_FOUND, "spu not found")
    return row


def _assert_owns(spu: SPU, account: MerchantAccount) -> None:
    if spu.shop_id != account.shop_id:
        raise AppException(ErrorCode.SPU_PERMISSION_DENIED, "spu belongs to another shop")


async def _assert_category_valid(session: AsyncSession, category_id: int) -> Category:
    cat = await session.get(Category, category_id)
    if cat is None or cat.deleted_at is not None:
        raise AppException(ErrorCode.CATEGORY_NOT_FOUND, "category not found")
    if cat.level != 3:
        raise AppException(
            ErrorCode.VALIDATION_ERROR,
            "SPU can only be attached to a leaf (level=3) category",
        )
    return cat


async def _assert_brand_valid(session: AsyncSession, brand_id: int | None) -> Brand | None:
    if brand_id is None:
        return None
    b = await session.get(Brand, brand_id)
    if b is None or b.deleted_at is not None:
        raise AppException(ErrorCode.BRAND_NOT_FOUND, "brand not found")
    return b


async def _load_active_skus(session: AsyncSession, spu_id: int) -> list[SKU]:
    stmt = select(SKU).where(SKU.spu_id == spu_id, SKU.deleted_at.is_(None)).order_by(SKU.id)
    return list((await session.execute(stmt)).scalars().all())


async def recompute_price_range(session: AsyncSession, spu: SPU) -> None:
    """Recompute ``min_price_cents`` / ``max_price_cents`` from active SKUs."""
    stmt = select(func.min(SKU.price_cents), func.max(SKU.price_cents)).where(
        SKU.spu_id == spu.id,
        SKU.deleted_at.is_(None),
        SKU.is_active.is_(True),
    )
    row = (await session.execute(stmt)).one_or_none()
    if row is None or row[0] is None:
        spu.min_price_cents = 0
        spu.max_price_cents = 0
    else:
        spu.min_price_cents = int(row[0])
        spu.max_price_cents = int(row[1])
    await session.flush()


async def _category_path(
    session: AsyncSession, category_id: int
) -> tuple[Category | None, list[CategoryPathNode]]:
    leaf = await session.get(Category, category_id)
    if leaf is None or leaf.deleted_at is not None:
        return None, []
    ids = [int(x) for x in leaf.path.split("/") if x]
    stmt = select(Category).where(Category.id.in_(ids))
    rows = {r.id: r for r in (await session.execute(stmt)).scalars().all()}
    ordered = [rows[i] for i in ids if i in rows]
    return leaf, [CategoryPathNode(id=c.id, name=c.name, slug=c.slug) for c in ordered]


async def _build_detail(session: AsyncSession, spu: SPU) -> SPUDetailOut:
    skus = await _load_active_skus(session, spu.id)
    brand = None
    if spu.brand_id is not None:
        b = await session.get(Brand, spu.brand_id)
        if b is not None:
            brand = BrandBriefOut.model_validate(b)
    leaf, path_nodes = await _category_path(session, spu.category_id)
    cat_brief = CategoryBriefOut.model_validate(leaf) if leaf is not None else None
    shop_brief: ShopBriefOut | None = None
    shop = await session.get(Shop, spu.shop_id)
    if shop is not None:
        shop_brief = ShopBriefOut.model_validate(shop)

    base = SPUOut.model_validate(spu).model_dump()
    return SPUDetailOut(
        **base,
        brand=brand,
        category=cat_brief,
        category_path=path_nodes,
        shop=shop_brief,
        skus=[SKUOut.model_validate(s) for s in skus],
    )


async def _list_item(session: AsyncSession, spu: SPU) -> SPUListItemOut:
    brand = None
    if spu.brand_id is not None:
        b = await session.get(Brand, spu.brand_id)
        if b is not None:
            brand = BrandBriefOut.model_validate(b)
    cat = await session.get(Category, spu.category_id)
    cat_brief = CategoryBriefOut.model_validate(cat) if cat is not None else None
    base = {
        "id": spu.id,
        "title": spu.title,
        "subtitle": spu.subtitle,
        "main_image": spu.main_image,
        "min_price_cents": spu.min_price_cents,
        "max_price_cents": spu.max_price_cents,
        "sales_count": spu.sales_count,
    }
    return SPUListItemOut(**base, brand=brand, category=cat_brief)


# ---------------------------------------------------------------------------
# Merchant-side
# ---------------------------------------------------------------------------
async def merchant_list(
    session: AsyncSession,
    account: MerchantAccount,
    *,
    status_: SPUStatus | None,
    keyword: str | None,
    page: int,
    size: int,
) -> tuple[list[SPUOut], int]:
    conds = [SPU.shop_id == account.shop_id, SPU.deleted_at.is_(None)]
    if status_ is not None:
        conds.append(SPU.status == status_)
    if keyword:
        like = f"%{keyword}%"
        conds.append(or_(SPU.title.ilike(like), SPU.subtitle.ilike(like)))

    total = int((await session.execute(select(func.count(SPU.id)).where(*conds))).scalar_one())
    stmt = (
        select(SPU)
        .where(*conds)
        .order_by(SPU.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    rows = list((await session.execute(stmt)).scalars().all())
    return [SPUOut.model_validate(r) for r in rows], total


async def merchant_get(
    session: AsyncSession, account: MerchantAccount, spu_id: int
) -> SPUDetailOut:
    spu = await _load_spu(session, spu_id)
    _assert_owns(spu, account)
    return await _build_detail(session, spu)


async def merchant_create(
    session: AsyncSession,
    account: MerchantAccount,
    payload: SPUCreateIn,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> SPUDetailOut:
    await _assert_category_valid(session, payload.category_id)
    await _assert_brand_valid(session, payload.brand_id)

    spu = SPU(
        shop_id=account.shop_id,
        category_id=payload.category_id,
        brand_id=payload.brand_id,
        title=payload.title,
        subtitle=payload.subtitle,
        description=payload.description,
        main_image=payload.main_image,
        images=list(payload.images),
        spec_axes=list(payload.spec_axes),
        status=SPUStatus.DRAFT,
    )
    session.add(spu)
    await session.flush()
    await session.refresh(spu)

    await write_audit(
        session,
        actor_type=AuditActorType.MERCHANT,
        actor_id=account.id,
        action="merchant.spu.create",
        target_type="spu",
        target_id=spu.id,
        ip=ip,
        user_agent=user_agent,
    )
    return await _build_detail(session, spu)


def _apply_spu_updates(spu: SPU, payload: SPUUpdateIn) -> dict[str, Any]:
    """Copy set fields from ``payload`` into ``spu``, returning a change map."""
    changed: dict[str, Any] = {}
    if payload.category_id is not None and payload.category_id != spu.category_id:
        spu.category_id = payload.category_id
        changed["category_id"] = payload.category_id
    if payload.brand_id is not None and payload.brand_id != spu.brand_id:
        spu.brand_id = payload.brand_id
        changed["brand_id"] = payload.brand_id
    if payload.title is not None and payload.title != spu.title:
        spu.title = payload.title
        changed["title"] = True
    if payload.subtitle is not None and payload.subtitle != spu.subtitle:
        spu.subtitle = payload.subtitle
        changed["subtitle"] = True
    if payload.description is not None and payload.description != spu.description:
        spu.description = payload.description
        changed["description"] = True
    if payload.main_image is not None and payload.main_image != spu.main_image:
        spu.main_image = payload.main_image
        changed["main_image"] = True
    if payload.images is not None:
        spu.images = list(payload.images)
        changed["images"] = True
    if payload.spec_axes is not None:
        spu.spec_axes = list(payload.spec_axes)
        changed["spec_axes"] = True
    return changed


async def merchant_update(
    session: AsyncSession,
    account: MerchantAccount,
    spu_id: int,
    payload: SPUUpdateIn,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> SPUDetailOut:
    spu = await _load_spu(session, spu_id)
    _assert_owns(spu, account)

    if spu.status == SPUStatus.PENDING_REVIEW:
        raise AppException(
            ErrorCode.SPU_STATUS_INVALID_FOR_ACTION,
            "withdraw the pending review before editing",
        )

    if payload.category_id is not None and payload.category_id != spu.category_id:
        await _assert_category_valid(session, payload.category_id)
    if payload.brand_id is not None and payload.brand_id != spu.brand_id:
        await _assert_brand_valid(session, payload.brand_id)

    changed = _apply_spu_updates(spu, payload)

    critical_touched = bool(_CRITICAL_FIELDS & changed.keys())
    if critical_touched and spu.status in {SPUStatus.APPROVED, SPUStatus.OFF_SHELF}:
        # Send back to review; clear prior reviewer decision.
        spu.status = SPUStatus.PENDING_REVIEW
        spu.reviewer_admin_id = None
        spu.review_note = None
        spu.reviewed_at = None
        changed["status_reset_to"] = SPUStatus.PENDING_REVIEW.value

    if changed:
        await session.flush()
        await session.refresh(spu)
        await write_audit(
            session,
            actor_type=AuditActorType.MERCHANT,
            actor_id=account.id,
            action="merchant.spu.update",
            target_type="spu",
            target_id=spu.id,
            ip=ip,
            user_agent=user_agent,
            extra={"fields": list(changed.keys())},
        )

    return await _build_detail(session, spu)


async def merchant_delete(
    session: AsyncSession,
    account: MerchantAccount,
    spu_id: int,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> None:
    spu = await _load_spu(session, spu_id)
    _assert_owns(spu, account)

    if spu.status == SPUStatus.APPROVED:
        raise AppException(
            ErrorCode.SPU_STATUS_INVALID_FOR_ACTION,
            "offshelf the SPU before deleting",
        )
    spu.deleted_at = datetime.now(UTC)
    await session.flush()

    await write_audit(
        session,
        actor_type=AuditActorType.MERCHANT,
        actor_id=account.id,
        action="merchant.spu.delete",
        target_type="spu",
        target_id=spu.id,
        ip=ip,
        user_agent=user_agent,
    )


async def submit_review(
    session: AsyncSession,
    account: MerchantAccount,
    spu_id: int,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> SPUDetailOut:
    spu = await _load_spu(session, spu_id)
    _assert_owns(spu, account)
    if spu.status not in {SPUStatus.DRAFT, SPUStatus.REJECTED}:
        raise AppException(
            ErrorCode.SPU_STATUS_INVALID_FOR_ACTION,
            "only draft or rejected SPUs can be submitted for review",
        )
    skus = await _load_active_skus(session, spu.id)
    if not any(s.is_active for s in skus):
        raise AppException(
            ErrorCode.SPU_REQUIRES_AT_LEAST_ONE_SKU,
            "at least one active SKU is required before submitting",
        )

    spu.status = SPUStatus.PENDING_REVIEW
    spu.reviewer_admin_id = None
    spu.review_note = None
    spu.reviewed_at = None
    await session.flush()
    await session.refresh(spu)

    await write_audit(
        session,
        actor_type=AuditActorType.MERCHANT,
        actor_id=account.id,
        action="merchant.spu.submit_review",
        target_type="spu",
        target_id=spu.id,
        ip=ip,
        user_agent=user_agent,
    )
    return await _build_detail(session, spu)


async def withdraw_review(
    session: AsyncSession,
    account: MerchantAccount,
    spu_id: int,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> SPUDetailOut:
    spu = await _load_spu(session, spu_id)
    _assert_owns(spu, account)
    if spu.status != SPUStatus.PENDING_REVIEW:
        raise AppException(
            ErrorCode.SPU_STATUS_INVALID_FOR_ACTION,
            "only pending SPUs can be withdrawn",
        )
    spu.status = SPUStatus.DRAFT
    await session.flush()
    await session.refresh(spu)

    await write_audit(
        session,
        actor_type=AuditActorType.MERCHANT,
        actor_id=account.id,
        action="merchant.spu.withdraw_review",
        target_type="spu",
        target_id=spu.id,
        ip=ip,
        user_agent=user_agent,
    )
    return await _build_detail(session, spu)


async def offshelf(
    session: AsyncSession,
    account: MerchantAccount,
    spu_id: int,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> SPUDetailOut:
    spu = await _load_spu(session, spu_id)
    _assert_owns(spu, account)
    if spu.status != SPUStatus.APPROVED:
        raise AppException(
            ErrorCode.SPU_STATUS_INVALID_FOR_ACTION,
            "only approved SPUs can be off-shelved",
        )
    spu.status = SPUStatus.OFF_SHELF
    await session.flush()
    await session.refresh(spu)

    await write_audit(
        session,
        actor_type=AuditActorType.MERCHANT,
        actor_id=account.id,
        action="merchant.spu.offshelf",
        target_type="spu",
        target_id=spu.id,
        ip=ip,
        user_agent=user_agent,
    )
    return await _build_detail(session, spu)


async def onshelf(
    session: AsyncSession,
    account: MerchantAccount,
    spu_id: int,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> SPUDetailOut:
    spu = await _load_spu(session, spu_id)
    _assert_owns(spu, account)
    if spu.status != SPUStatus.OFF_SHELF:
        raise AppException(
            ErrorCode.SPU_STATUS_INVALID_FOR_ACTION,
            "only off-shelf SPUs can be put back on shelf",
        )
    # Merchant can only re-onshelf a merchant-initiated offshelf; admin force
    # offshelf clears reviewer_admin_id + writes an audit action name
    # ``admin.spu.force_offshelf``. We treat both the same for now (Phase 2
    # simplification) — the audit log lets ops trace intent.
    spu.status = SPUStatus.APPROVED
    await session.flush()
    await session.refresh(spu)

    await write_audit(
        session,
        actor_type=AuditActorType.MERCHANT,
        actor_id=account.id,
        action="merchant.spu.onshelf",
        target_type="spu",
        target_id=spu.id,
        ip=ip,
        user_agent=user_agent,
    )
    return await _build_detail(session, spu)


# ---------------------------------------------------------------------------
# Admin-side
# ---------------------------------------------------------------------------
async def admin_list(
    session: AsyncSession,
    *,
    status_: SPUStatus | None,
    shop_id: int | None,
    keyword: str | None,
    page: int,
    size: int,
) -> tuple[list[SPUOut], int]:
    conds = [SPU.deleted_at.is_(None)]
    if status_ is not None:
        conds.append(SPU.status == status_)
    if shop_id is not None:
        conds.append(SPU.shop_id == shop_id)
    if keyword:
        like = f"%{keyword}%"
        conds.append(or_(SPU.title.ilike(like), SPU.subtitle.ilike(like)))

    total = int((await session.execute(select(func.count(SPU.id)).where(*conds))).scalar_one())
    stmt = (
        select(SPU)
        .where(*conds)
        .order_by(SPU.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    rows = list((await session.execute(stmt)).scalars().all())
    return [SPUOut.model_validate(r) for r in rows], total


async def admin_get(session: AsyncSession, spu_id: int) -> SPUDetailOut:
    spu = await _load_spu(session, spu_id)
    return await _build_detail(session, spu)


async def admin_approve(
    session: AsyncSession,
    admin: AdminUser,
    spu_id: int,
    *,
    review_note: str | None,
    ip: str | None = None,
    user_agent: str | None = None,
) -> SPUDetailOut:
    spu = await _load_spu(session, spu_id)
    if spu.status != SPUStatus.PENDING_REVIEW:
        raise AppException(
            ErrorCode.SPU_STATUS_INVALID_FOR_ACTION,
            "only pending_review SPUs can be approved",
        )
    now = datetime.now(UTC)
    spu.status = SPUStatus.APPROVED
    spu.reviewer_admin_id = admin.id
    spu.review_note = review_note
    spu.reviewed_at = now
    if spu.published_at is None:
        spu.published_at = now
    await session.flush()
    await session.refresh(spu)

    await write_audit(
        session,
        actor_type=AuditActorType.ADMIN,
        actor_id=admin.id,
        action="admin.spu.approve",
        target_type="spu",
        target_id=spu.id,
        ip=ip,
        user_agent=user_agent,
    )
    return await _build_detail(session, spu)


async def admin_reject(
    session: AsyncSession,
    admin: AdminUser,
    spu_id: int,
    *,
    review_note: str,
    ip: str | None = None,
    user_agent: str | None = None,
) -> SPUDetailOut:
    if review_note is None or not (5 <= len(review_note) <= 500):
        raise AppException(
            ErrorCode.VALIDATION_ERROR,
            "review_note is required and must be 5-500 characters",
        )
    spu = await _load_spu(session, spu_id)
    if spu.status != SPUStatus.PENDING_REVIEW:
        raise AppException(
            ErrorCode.SPU_STATUS_INVALID_FOR_ACTION,
            "only pending_review SPUs can be rejected",
        )
    spu.status = SPUStatus.REJECTED
    spu.reviewer_admin_id = admin.id
    spu.review_note = review_note
    spu.reviewed_at = datetime.now(UTC)
    await session.flush()
    await session.refresh(spu)

    await write_audit(
        session,
        actor_type=AuditActorType.ADMIN,
        actor_id=admin.id,
        action="admin.spu.reject",
        target_type="spu",
        target_id=spu.id,
        ip=ip,
        user_agent=user_agent,
    )
    return await _build_detail(session, spu)


async def admin_force_offshelf(
    session: AsyncSession,
    admin: AdminUser,
    spu_id: int,
    *,
    review_note: str,
    ip: str | None = None,
    user_agent: str | None = None,
) -> SPUDetailOut:
    if review_note is None or not (5 <= len(review_note) <= 500):
        raise AppException(
            ErrorCode.VALIDATION_ERROR,
            "review_note is required and must be 5-500 characters",
        )
    spu = await _load_spu(session, spu_id)
    if spu.status not in {SPUStatus.APPROVED, SPUStatus.OFF_SHELF}:
        raise AppException(
            ErrorCode.SPU_STATUS_INVALID_FOR_ACTION,
            "only approved / off_shelf SPUs can be force-offshelved",
        )
    spu.status = SPUStatus.OFF_SHELF
    spu.reviewer_admin_id = admin.id
    spu.review_note = review_note
    spu.reviewed_at = datetime.now(UTC)
    await session.flush()
    await session.refresh(spu)

    await write_audit(
        session,
        actor_type=AuditActorType.ADMIN,
        actor_id=admin.id,
        action="admin.spu.force_offshelf",
        target_type="spu",
        target_id=spu.id,
        ip=ip,
        user_agent=user_agent,
        extra={"note": review_note},
    )
    return await _build_detail(session, spu)


__all__ = [
    "admin_approve",
    "admin_force_offshelf",
    "admin_get",
    "admin_list",
    "admin_reject",
    "merchant_create",
    "merchant_delete",
    "merchant_get",
    "merchant_list",
    "merchant_update",
    "offshelf",
    "onshelf",
    "recompute_price_range",
    "submit_review",
    "withdraw_review",
]
