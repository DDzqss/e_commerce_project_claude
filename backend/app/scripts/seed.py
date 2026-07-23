"""Phase 1 + 2 seed script.

Idempotent — safe to re-run; existing rows are left alone. Inserts:

- 4 admin accounts (Phase 1, contract §12)
- 2 baseline test users (Phase 1)
- 7-node category tree (Phase 2, contract §13)
- 5 baseline brands (Phase 2)
- 1 baseline shop + merchant account (so Phase 2 SPUs have an owner)
- 3 approved SPUs with 2-3 SKUs each

Run:
    uv run python -m app.scripts.seed

Refuses to run in ``ENVIRONMENT=production``.
"""

from __future__ import annotations

import asyncio
import logging
import random
import sys
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import async_session_factory, dispose_engine
from app.core.security import hash_password
from app.models.address import Address
from app.models.admin_user import AdminRole, AdminUser
from app.models.brand import Brand
from app.models.category import Category
from app.models.merchant import (
    MerchantAccount,
    MerchantAccountStatus,
    MerchantRole,
    Shop,
    ShopStatus,
)
from app.models.order import CancelReason, Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.order_status_history import ActorType, OrderStatusHistory
from app.models.product import SPU, SPUStatus
from app.models.sku import SKU
from app.models.user import User, UserStatus

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AdminSeed:
    username: str
    password: str
    display_name: str
    role: AdminRole


@dataclass(frozen=True)
class UserSeed:
    phone: str
    password: str
    nickname: str


# Contract §12 baseline data.
# NOTE: these passwords are development defaults; production must
# ``ENVIRONMENT=production`` (which blocks this script) and provision
# admins through a secure out-of-band channel.
ADMINS: tuple[AdminSeed, ...] = (
    AdminSeed(
        username="super",
        password="super_pwd_change_me",  # noqa: S106  dev-only seed; script refuses to run in production
        display_name="超级管理员",
        role=AdminRole.SUPER_ADMIN,
    ),
    AdminSeed(
        username="biz01",
        password="biz_pwd_change_me",  # noqa: S106
        display_name="业务管理员",
        role=AdminRole.BUSINESS_ADMIN,
    ),
    AdminSeed(
        username="cs01",
        password="cs_pwd_change_me",  # noqa: S106
        display_name="客服管理员",
        role=AdminRole.CUSTOMER_SERVICE_ADMIN,
    ),
    AdminSeed(
        username="tech01",
        password="tech_pwd_change_me",  # noqa: S106
        display_name="技术管理员",
        role=AdminRole.TECH_ADMIN,
    ),
)

USERS: tuple[UserSeed, ...] = (
    UserSeed(phone="13800000001", password="Test1234", nickname="老李"),  # noqa: S106
    UserSeed(phone="13800000002", password="Test1234", nickname="老王"),  # noqa: S106
)


# ---------------------------------------------------------------------------
# Phase 2 catalog seed data
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class CategorySeed:
    slug: str
    name: str
    parent_slug: str | None


CATEGORY_TREE: tuple[CategorySeed, ...] = (
    # level 1
    CategorySeed(slug="digital", name="数码", parent_slug=None),
    CategorySeed(slug="home-goods", name="家居日用", parent_slug=None),
    # level 2
    CategorySeed(slug="phones-communication", name="手机通讯", parent_slug="digital"),
    CategorySeed(slug="pcs-office", name="电脑办公", parent_slug="digital"),
    CategorySeed(slug="kitchenware", name="厨具餐具", parent_slug="home-goods"),
    # level 3
    CategorySeed(slug="phones", name="手机", parent_slug="phones-communication"),
    CategorySeed(slug="walkie-talkies", name="对讲机", parent_slug="phones-communication"),
    CategorySeed(slug="laptops", name="笔记本电脑", parent_slug="pcs-office"),
    CategorySeed(slug="keyboards", name="键盘", parent_slug="pcs-office"),
    CategorySeed(slug="thermos-cups", name="保温杯", parent_slug="kitchenware"),
)


@dataclass(frozen=True)
class BrandSeed:
    slug: str
    name: str


BRANDS: tuple[BrandSeed, ...] = (
    BrandSeed(slug="apple", name="Apple"),
    BrandSeed(slug="huawei", name="华为"),
    BrandSeed(slug="xiaomi", name="小米"),
    BrandSeed(slug="muji", name="无印良品"),
    BrandSeed(slug="thermos", name="膳魔师"),
)


@dataclass(frozen=True)
class SKUSeed:
    sku_code: str
    specs: dict[str, str]
    price_cents: int
    original_price_cents: int
    stock: int


@dataclass(frozen=True)
class SPUSeed:
    title: str
    subtitle: str
    category_slug: str
    brand_slug: str
    spec_axes: list[str]
    main_image_key: str
    skus: list[SKUSeed]


SPUS: tuple[SPUSeed, ...] = (
    SPUSeed(
        title="iPhone 20 Pro",
        subtitle="钛金属机身 · 全新影像系统",
        category_slug="phones",
        brand_slug="apple",
        spec_axes=["color", "storage"],
        main_image_key="spu/seed/iphone-20-pro.jpg",
        skus=[
            SKUSeed(
                sku_code="PRO-BLACK-256",
                specs={"color": "曜岩黑", "storage": "256G"},
                price_cents=799900,
                original_price_cents=899900,
                stock=50,
            ),
            SKUSeed(
                sku_code="PRO-WHITE-512",
                specs={"color": "陶瓷白", "storage": "512G"},
                price_cents=999900,
                original_price_cents=1099900,
                stock=30,
            ),
        ],
    ),
    SPUSeed(
        title="MateBook X Pro 2026",
        subtitle="14.2 英寸 3K 屏 · Ultra 9",
        category_slug="laptops",
        brand_slug="huawei",
        spec_axes=["memory", "storage"],
        main_image_key="spu/seed/matebook-x-pro.jpg",
        skus=[
            SKUSeed(
                sku_code="MBX-16-512",
                specs={"memory": "16G", "storage": "512G"},
                price_cents=999900,
                original_price_cents=1099900,
                stock=20,
            ),
            SKUSeed(
                sku_code="MBX-32-1T",
                specs={"memory": "32G", "storage": "1T"},
                price_cents=1399900,
                original_price_cents=1499900,
                stock=10,
            ),
        ],
    ),
    SPUSeed(
        title="膳魔师保温杯 500ml",
        subtitle="24 小时长效保温 · 直饮盖",
        category_slug="thermos-cups",
        brand_slug="thermos",
        spec_axes=["color"],
        main_image_key="spu/seed/thermos-500ml.jpg",
        skus=[
            SKUSeed(
                sku_code="TS-500-BLK",
                specs={"color": "曜黑"},
                price_cents=19900,
                original_price_cents=24900,
                stock=200,
            ),
            SKUSeed(
                sku_code="TS-500-SLV",
                specs={"color": "冰银"},
                price_cents=19900,
                original_price_cents=24900,
                stock=180,
            ),
            SKUSeed(
                sku_code="TS-500-RED",
                specs={"color": "珊瑚红"},
                price_cents=21900,
                original_price_cents=24900,
                stock=120,
            ),
        ],
    ),
)


# ---------------------------------------------------------------------------
# Seed steps
# ---------------------------------------------------------------------------


async def _seed_admins(session: AsyncSession) -> None:
    for spec in ADMINS:
        exists = await session.execute(
            select(AdminUser.id).where(AdminUser.username == spec.username)
        )
        if exists.scalar_one_or_none() is not None:
            logger.info("admin exists, skip: %s", spec.username)
            continue
        session.add(
            AdminUser(
                username=spec.username,
                password_hash=hash_password(spec.password),
                display_name=spec.display_name,
                role=spec.role,
            )
        )
        logger.info("seeded admin: %s (%s)", spec.username, spec.role.value)


async def _seed_users(session: AsyncSession) -> None:
    for idx, spec in enumerate(USERS, start=1):
        exists = await session.execute(select(User.id).where(User.phone == spec.phone))
        if exists.scalar_one_or_none() is not None:
            logger.info("user exists, skip: %s", spec.phone)
            continue
        session.add(
            User(
                phone=spec.phone,
                email=None,
                password_hash=hash_password(spec.password),
                nickname=spec.nickname,
                status=UserStatus.ACTIVE,
            )
        )
        logger.info("seeded user: phone=%s nickname=%s (#%d)", spec.phone, spec.nickname, idx)


async def _seed_categories(session: AsyncSession) -> dict[str, Category]:
    """Seed the 3-level category tree; returns slug->row map."""
    slug_map: dict[str, Category] = {}
    for spec in CATEGORY_TREE:
        exists = (
            await session.execute(select(Category).where(Category.slug == spec.slug))
        ).scalar_one_or_none()
        if exists is not None:
            slug_map[spec.slug] = exists
            continue
        parent = slug_map.get(spec.parent_slug) if spec.parent_slug else None
        level = 1 if parent is None else parent.level + 1
        row = Category(
            parent_id=parent.id if parent is not None else None,
            name=spec.name,
            slug=spec.slug,
            level=level,
            path="pending",
            sort_order=0,
            is_visible=True,
        )
        session.add(row)
        await session.flush()
        row.path = f"{parent.path}/{row.id}" if parent is not None else str(row.id)
        await session.flush()
        slug_map[spec.slug] = row
        logger.info("seeded category: %s (level=%d)", spec.slug, level)
    return slug_map


async def _seed_brands(session: AsyncSession) -> dict[str, Brand]:
    slug_map: dict[str, Brand] = {}
    for idx, spec in enumerate(BRANDS):
        exists = (
            await session.execute(select(Brand).where(Brand.slug == spec.slug))
        ).scalar_one_or_none()
        if exists is not None:
            slug_map[spec.slug] = exists
            continue
        row = Brand(
            name=spec.name,
            slug=spec.slug,
            logo_url=f"brand/seed/{spec.slug}.png",
            description=None,
            sort_order=idx * 10,
            is_visible=True,
        )
        session.add(row)
        await session.flush()
        slug_map[spec.slug] = row
        logger.info("seeded brand: %s", spec.slug)
    return slug_map


async def _seed_shop_and_owner(session: AsyncSession) -> tuple[Shop, MerchantAccount]:
    """Ensure the demo Shop + a linked MerchantAccount exist."""
    shop_name = "JD-Clone 演示店"
    shop = (await session.execute(select(Shop).where(Shop.name == shop_name))).scalar_one_or_none()
    if shop is None:
        shop = Shop(
            name=shop_name,
            description="用于 Phase 2 联调的官方演示店铺",
            contact_name="老李",
            contact_phone="13800000001",
            status=ShopStatus.ACTIVE,
        )
        session.add(shop)
        await session.flush()
        logger.info("seeded shop: %s (id=%d)", shop.name, shop.id)

    owner_user = (
        await session.execute(select(User).where(User.phone == USERS[0].phone))
    ).scalar_one()

    login_name = f"shop{shop.id}_owner"
    account = (
        await session.execute(
            select(MerchantAccount).where(MerchantAccount.login_name == login_name)
        )
    ).scalar_one_or_none()
    if account is None:
        account = MerchantAccount(
            user_id=owner_user.id,
            login_name=login_name,
            password_hash=hash_password("Merch1234"),
            shop_id=shop.id,
            role=MerchantRole.SHOP_OWNER,
            status=MerchantAccountStatus.ACTIVE,
        )
        session.add(account)
        await session.flush()
        logger.info(
            "seeded merchant account: login_name=%s (initial password: Merch1234)",
            login_name,
        )
    return shop, account


async def _seed_spus(
    session: AsyncSession,
    shop: Shop,
    categories: dict[str, Category],
    brands: dict[str, Brand],
) -> None:
    for spec in SPUS:
        exists = (
            await session.execute(
                select(SPU).where(SPU.shop_id == shop.id, SPU.title == spec.title)
            )
        ).scalar_one_or_none()
        if exists is not None:
            logger.info("spu exists, skip: %s", spec.title)
            continue

        now = datetime.now(UTC)
        spu = SPU(
            shop_id=shop.id,
            category_id=categories[spec.category_slug].id,
            brand_id=brands[spec.brand_slug].id,
            title=spec.title,
            subtitle=spec.subtitle,
            description=f"<p>{spec.title} - seed description</p>",
            main_image=spec.main_image_key,
            images=[spec.main_image_key],
            spec_axes=list(spec.spec_axes),
            status=SPUStatus.APPROVED,
            reviewed_at=now,
            published_at=now,
        )
        session.add(spu)
        await session.flush()

        prices: list[int] = []
        for s in spec.skus:
            sku = SKU(
                spu_id=spu.id,
                sku_code=s.sku_code,
                specs=dict(s.specs),
                price_cents=s.price_cents,
                original_price_cents=s.original_price_cents,
                stock=s.stock,
                is_active=True,
            )
            session.add(sku)
            prices.append(s.price_cents)
        await session.flush()

        spu.min_price_cents = min(prices)
        spu.max_price_cents = max(prices)
        await session.flush()
        logger.info("seeded spu: %s (id=%d, skus=%d)", spec.title, spu.id, len(spec.skus))


async def _seed_addresses(session: AsyncSession) -> None:
    """Insert two demo addresses per baseline user (idempotent)."""
    for spec in USERS:
        user_row = (
            await session.execute(select(User).where(User.phone == spec.phone))
        ).scalar_one_or_none()
        if user_row is None:
            continue
        existing = list(
            (
                await session.execute(
                    select(Address.id).where(
                        Address.user_id == user_row.id, Address.deleted_at.is_(None)
                    )
                )
            ).scalars().all()
        )
        if existing:
            continue
        session.add_all(
            [
                Address(
                    user_id=user_row.id,
                    receiver_name=spec.nickname,
                    receiver_phone=spec.phone,
                    province="浙江省",
                    city="杭州市",
                    district="西湖区",
                    detail="文三路 100 号 A 楼 3 层",
                    postal_code="310012",
                    is_default=True,
                ),
                Address(
                    user_id=user_row.id,
                    receiver_name=spec.nickname,
                    receiver_phone=spec.phone,
                    province="北京市",
                    city="北京市",
                    district="海淀区",
                    detail="中关村大街 27 号 8 层",
                    postal_code="100080",
                    is_default=False,
                ),
            ]
        )
        logger.info("seeded 2 addresses for %s", spec.phone)


async def _seed_demo_orders(
    session: AsyncSession, shop: Shop
) -> None:
    """Insert three demo orders for the first baseline user against the demo shop."""
    user_row = (
        await session.execute(select(User).where(User.phone == USERS[0].phone))
    ).scalar_one_or_none()
    if user_row is None:
        return

    # Idempotency: skip if we already have >=3 demo orders for this user + shop.
    already = int(
        (
            await session.execute(
                select(func.count(Order.id)).where(
                    Order.user_id == user_row.id, Order.shop_id == shop.id
                )
            )
        ).scalar_one()
    )
    if already >= 3:
        return

    # Grab any two SKUs from the shop.
    sku_stmt = (
        select(SKU)
        .join(SPU, SPU.id == SKU.spu_id)
        .where(SPU.shop_id == shop.id, SKU.deleted_at.is_(None), SPU.deleted_at.is_(None))
        .limit(2)
    )
    skus = list((await session.execute(sku_stmt)).scalars().all())
    if len(skus) < 1:
        return

    now = datetime.now(UTC)

    def _make_order(
        status: OrderStatus,
        *,
        offset_days: int,
        idempotency_key: str,
        paid: bool = False,
        shipped: bool = False,
        completed: bool = False,
    ) -> Order:
        created_at = now - timedelta(days=offset_days)
        subtotal = skus[0].price_cents
        order = Order(
            order_no=(created_at.strftime("%Y%m%d") + f"{random.randint(0, 9_999_999_999):010d}"),  # noqa: S311
            user_id=user_row.id,
            shop_id=shop.id,
            status=status,
            subtotal_cents=subtotal,
            shipping_fee_cents=0,
            discount_cents=0,
            total_cents=subtotal,
            receiver_name=USERS[0].nickname,
            receiver_phone=USERS[0].phone,
            receiver_address="浙江省杭州市西湖区文三路 100 号 A 楼 3 层",
            user_note=None,
            payment_deadline_at=created_at + timedelta(minutes=30),
            paid_at=created_at + timedelta(minutes=5) if paid else None,
            shipped_at=created_at + timedelta(hours=1) if shipped else None,
            auto_complete_at=(
                (created_at + timedelta(hours=1) + timedelta(days=15)) if shipped else None
            ),
            completed_at=created_at + timedelta(days=3) if completed else None,
            idempotency_key=idempotency_key,
        )
        session.add(order)
        return order

    demos = [
        _make_order(
            OrderStatus.PENDING_PAYMENT,
            offset_days=0,
            idempotency_key="seed-order-pending-1",
        ),
        _make_order(
            OrderStatus.PAID,
            offset_days=1,
            idempotency_key="seed-order-paid-1",
            paid=True,
        ),
        _make_order(
            OrderStatus.COMPLETED,
            offset_days=20,
            idempotency_key="seed-order-completed-1",
            paid=True,
            shipped=True,
            completed=True,
        ),
    ]
    await session.flush()

    for order in demos:
        session.add(
            OrderItem(
                order_id=order.id,
                sku_id=skus[0].id,
                spu_id=skus[0].spu_id,
                shop_id=shop.id,
                spu_title="演示商品",
                sku_specs=dict(skus[0].specs or {}),
                sku_image=skus[0].image,
                unit_price_cents=skus[0].price_cents,
                quantity=1,
                subtotal_cents=skus[0].price_cents,
            )
        )
        session.add(
            OrderStatusHistory(
                order_id=order.id,
                from_status=None,
                to_status=OrderStatus.PENDING_PAYMENT.value,
                actor_type=ActorType.USER,
                actor_id=user_row.id,
                note="seed",
            )
        )
    logger.info("seeded %d demo orders for shop %s", len(demos), shop.name)


async def _seed() -> None:
    settings = get_settings()
    if settings.ENVIRONMENT == "production":
        logger.error("seed script refuses to run in production")
        raise SystemExit(1)

    async with async_session_factory() as session:
        await _seed_admins(session)
        await _seed_users(session)
        await session.commit()

        categories = await _seed_categories(session)
        brands = await _seed_brands(session)
        shop, _ = await _seed_shop_and_owner(session)
        await session.commit()

        await _seed_spus(session, shop, categories, brands)
        await session.commit()

        # Phase 3 seed data
        await _seed_addresses(session)
        await session.commit()
        await _seed_demo_orders(session, shop)
        await session.commit()

    await dispose_engine()
    logger.info("seed complete")


def main() -> None:
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)-5s %(name)s: %(message)s"
    )
    try:
        asyncio.run(_seed())
    except SystemExit:
        raise
    except Exception:
        logger.exception("seed failed")
        sys.exit(2)


if __name__ == "__main__":
    main()
