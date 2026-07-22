"""Phase 1 seed script.

Inserts the 4 baseline admin accounts + 2 baseline test users defined
in contract §12. Idempotent — safe to re-run; existing rows are left
alone.

Run:
    uv run python -m app.scripts.seed

Refuses to run in ``ENVIRONMENT=production``.
"""

from __future__ import annotations

import asyncio
import logging
import sys
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import async_session_factory, dispose_engine
from app.core.security import hash_password
from app.models.admin_user import AdminRole, AdminUser
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


async def _seed() -> None:
    settings = get_settings()
    if settings.ENVIRONMENT == "production":
        logger.error("seed script refuses to run in production")
        raise SystemExit(1)

    async with async_session_factory() as session:
        await _seed_admins(session)
        await _seed_users(session)
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
