"""SQLAlchemy ORM models.

Import concrete model modules here so Alembic autogenerate picks them
up via ``Base.metadata``. Feature branches append their imports below.
"""

from app.models.admin_user import AdminRole, AdminStatus, AdminUser
from app.models.audit_log import AuditActorType, AuditLog
from app.models.base import Base, IdMixin, SoftDeleteMixin, TimestampMixin
from app.models.brand import Brand
from app.models.category import Category
from app.models.inventory_log import InventoryLog, InventoryOperatorType, InventoryReason
from app.models.merchant import (
    MerchantAccount,
    MerchantAccountStatus,
    MerchantRole,
    Shop,
    ShopStatus,
)
from app.models.merchant_application import MerchantApplication, MerchantApplicationStatus
from app.models.product import SPU, SPUStatus
from app.models.refresh_token import RefreshToken, SubjectType
from app.models.sku import SKU
from app.models.user import User, UserStatus

__all__ = [
    "SKU",
    "SPU",
    "AdminRole",
    "AdminStatus",
    "AdminUser",
    "AuditActorType",
    "AuditLog",
    "Base",
    "Brand",
    "Category",
    "IdMixin",
    "InventoryLog",
    "InventoryOperatorType",
    "InventoryReason",
    "MerchantAccount",
    "MerchantAccountStatus",
    "MerchantApplication",
    "MerchantApplicationStatus",
    "MerchantRole",
    "RefreshToken",
    "SPUStatus",
    "Shop",
    "ShopStatus",
    "SoftDeleteMixin",
    "SubjectType",
    "TimestampMixin",
    "User",
    "UserStatus",
]
