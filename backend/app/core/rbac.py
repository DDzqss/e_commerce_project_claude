"""RBAC primitives — Permissions, role definitions, and role→permission map.

Phase 1 uses a hard-coded permission matrix (contract §7.2). Later
phases may migrate to a database-backed role/permission table if the
matrix grows unwieldy.
"""

from __future__ import annotations

import enum

from app.models.admin_user import AdminRole
from app.models.merchant import MerchantRole


class Permission(enum.StrEnum):
    """Fine-grained permission keys.

    Naming: ``{scope}:{resource}[:{sub}]:{action}``.
    """

    # user scope
    USER_SELF_READ = "user:self:read"
    USER_SELF_UPDATE = "user:self:update"
    USER_MERCHANT_APPLICATION_SUBMIT = "user:merchant_application:submit"
    USER_MERCHANT_APPLICATION_WITHDRAW = "user:merchant_application:withdraw"
    USER_MERCHANT_APPLICATION_READ = "user:merchant_application:read"
    USER_CATALOG_READ = "user:catalog:read"
    USER_SPU_READ = "user:spu:read"

    # merchant scope
    MERCHANT_SELF_READ = "merchant:self:read"
    MERCHANT_SHOP_UPDATE = "merchant:shop:update"
    MERCHANT_SPU_MANAGE = "merchant:spu:manage"
    MERCHANT_SKU_MANAGE = "merchant:sku:manage"
    MERCHANT_INVENTORY_ADJUST = "merchant:inventory:adjust"
    MERCHANT_UPLOAD_PRESIGN = "merchant:upload:presign"

    # admin scope
    ADMIN_SELF_READ = "admin:self:read"
    ADMIN_MERCHANT_APPLICATION_READ = "admin:merchant_application:read"
    ADMIN_MERCHANT_APPLICATION_REVIEW = "admin:merchant_application:review"
    ADMIN_AUDIT_LOG_READ = "admin:audit_log:read"
    ADMIN_CATEGORY_MANAGE = "admin:category:manage"
    ADMIN_BRAND_MANAGE = "admin:brand:manage"
    ADMIN_SPU_REVIEW = "admin:spu:review"
    ADMIN_SPU_FORCE_OFFSHELF = "admin:spu:force_offshelf"
    ADMIN_SPU_READ_ALL = "admin:spu:read_all"


# ---------------------------------------------------------------------------
# Baseline permission sets
# ---------------------------------------------------------------------------

# Every authenticated User gets these unconditionally.
USER_BASE_PERMISSIONS: frozenset[Permission] = frozenset(
    {
        Permission.USER_SELF_READ,
        Permission.USER_SELF_UPDATE,
        Permission.USER_MERCHANT_APPLICATION_SUBMIT,
        Permission.USER_MERCHANT_APPLICATION_WITHDRAW,
        Permission.USER_MERCHANT_APPLICATION_READ,
        Permission.USER_CATALOG_READ,
        Permission.USER_SPU_READ,
    }
)


# Merchant permissions keyed by their in-shop role.
MERCHANT_ROLE_PERMISSIONS: dict[MerchantRole, frozenset[Permission]] = {
    MerchantRole.SHOP_OWNER: frozenset(
        {
            Permission.MERCHANT_SELF_READ,
            Permission.MERCHANT_SHOP_UPDATE,
            Permission.MERCHANT_SPU_MANAGE,
            Permission.MERCHANT_SKU_MANAGE,
            Permission.MERCHANT_INVENTORY_ADJUST,
            Permission.MERCHANT_UPLOAD_PRESIGN,
        }
    ),
    MerchantRole.SHOP_OPERATOR: frozenset(
        {
            Permission.MERCHANT_SELF_READ,
            Permission.MERCHANT_SPU_MANAGE,
            Permission.MERCHANT_SKU_MANAGE,
            Permission.MERCHANT_INVENTORY_ADJUST,
            Permission.MERCHANT_UPLOAD_PRESIGN,
        }
    ),
    MerchantRole.SHOP_SUPPORT: frozenset(
        {
            Permission.MERCHANT_SELF_READ,
        }
    ),
}


# Admin permissions keyed by role.
ROLE_PERMISSIONS: dict[AdminRole, frozenset[Permission]] = {
    AdminRole.SUPER_ADMIN: frozenset(Permission),
    AdminRole.BUSINESS_ADMIN: frozenset(
        {
            Permission.ADMIN_SELF_READ,
            Permission.ADMIN_MERCHANT_APPLICATION_READ,
            Permission.ADMIN_MERCHANT_APPLICATION_REVIEW,
            Permission.ADMIN_CATEGORY_MANAGE,
            Permission.ADMIN_BRAND_MANAGE,
            Permission.ADMIN_SPU_REVIEW,
            Permission.ADMIN_SPU_FORCE_OFFSHELF,
            Permission.ADMIN_SPU_READ_ALL,
        }
    ),
    AdminRole.CUSTOMER_SERVICE_ADMIN: frozenset(
        {
            Permission.ADMIN_SELF_READ,
            Permission.ADMIN_SPU_READ_ALL,
        }
    ),
    AdminRole.TECH_ADMIN: frozenset(
        {
            Permission.ADMIN_SELF_READ,
            Permission.ADMIN_AUDIT_LOG_READ,
        }
    ),
}


def permissions_for_admin(role: AdminRole) -> frozenset[Permission]:
    """Return the permission set for a given admin role."""
    return ROLE_PERMISSIONS.get(role, frozenset())


def permissions_for_merchant(role: MerchantRole) -> frozenset[Permission]:
    """Return the permission set for a given merchant role."""
    return MERCHANT_ROLE_PERMISSIONS.get(role, frozenset())
