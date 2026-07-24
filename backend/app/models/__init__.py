"""SQLAlchemy ORM models.

Import concrete model modules here so Alembic autogenerate picks them
up via ``Base.metadata``. Feature branches append their imports below.
"""

from app.models.address import Address
from app.models.admin_user import AdminRole, AdminStatus, AdminUser
from app.models.aftersales import (
    Aftersales,
    AftersalesArbitrationOutcome,
    AftersalesCloseReason,
    AftersalesEscalationReason,
    AftersalesReasonCategory,
    AftersalesStatus,
    AftersalesType,
)
from app.models.aftersales_evidence import (
    AftersalesEvidence,
    AftersalesEvidenceStage,
    AftersalesEvidenceUploaderType,
)
from app.models.aftersales_item import AftersalesItem
from app.models.aftersales_message import (
    AftersalesMessage,
    AftersalesMessageKind,
    AftersalesMessageSenderType,
)
from app.models.aftersales_status_history import (
    AftersalesActorType,
    AftersalesStatusHistory,
)
from app.models.audit_log import AuditActorType, AuditLog
from app.models.base import Base, IdMixin, SoftDeleteMixin, TimestampMixin
from app.models.brand import Brand
from app.models.cart import CartItem
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
from app.models.notification import (
    Notification,
    NotificationCategory,
    NotificationRecipientType,
)
from app.models.order import CancelReason, Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.order_status_history import ActorType, OrderStatusHistory
from app.models.payment_session import PaymentChannel, PaymentSession, PaymentStatus
from app.models.product import SPU, SPUStatus
from app.models.refresh_token import RefreshToken, SubjectType
from app.models.region import Region
from app.models.review import Review
from app.models.review_reply import ReviewReply
from app.models.review_report import (
    ReviewReport,
    ReviewReportReasonCategory,
    ReviewReportStatus,
)
from app.models.shipment_event import ShipmentEvent, ShipmentEventType
from app.models.sku import SKU
from app.models.user import User, UserStatus

__all__ = [
    "SKU",
    "SPU",
    "ActorType",
    "Address",
    "AdminRole",
    "AdminStatus",
    "AdminUser",
    "Aftersales",
    "AftersalesActorType",
    "AftersalesArbitrationOutcome",
    "AftersalesCloseReason",
    "AftersalesEscalationReason",
    "AftersalesEvidence",
    "AftersalesEvidenceStage",
    "AftersalesEvidenceUploaderType",
    "AftersalesItem",
    "AftersalesMessage",
    "AftersalesMessageKind",
    "AftersalesMessageSenderType",
    "AftersalesReasonCategory",
    "AftersalesStatus",
    "AftersalesStatusHistory",
    "AftersalesType",
    "AuditActorType",
    "AuditLog",
    "Base",
    "Brand",
    "CancelReason",
    "CartItem",
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
    "Notification",
    "NotificationCategory",
    "NotificationRecipientType",
    "Order",
    "OrderItem",
    "OrderStatus",
    "OrderStatusHistory",
    "PaymentChannel",
    "PaymentSession",
    "PaymentStatus",
    "RefreshToken",
    "Region",
    "Review",
    "ReviewReply",
    "ReviewReport",
    "ReviewReportReasonCategory",
    "ReviewReportStatus",
    "SPUStatus",
    "ShipmentEvent",
    "ShipmentEventType",
    "Shop",
    "ShopStatus",
    "SoftDeleteMixin",
    "SubjectType",
    "TimestampMixin",
    "User",
    "UserStatus",
]
