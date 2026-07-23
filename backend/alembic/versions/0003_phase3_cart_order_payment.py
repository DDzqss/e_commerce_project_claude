"""phase 3: cart, orders, payments, shipments, addresses

Revision ID: 0003_phase3_cart_order_payment
Revises: 0002_phase2_products_catalog
Create Date: 2026-07-23

Creates the seven Phase 3 tables and six native enum types:

- addresses
- cart_items
- orders (+ order_status, cancel_reason enums)
- order_items
- order_status_history (+ order_status_actor_type enum)
- payment_sessions (+ payment_channel, payment_status enums)
- shipment_events (+ shipment_event_type enum)
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0003_phase3_cart_order_payment"
down_revision: str | None = "0002_phase2_products_catalog"
branch_labels: tuple[str, ...] | None = None
depends_on: tuple[str, ...] | None = None


# ---------------------------------------------------------------------------
# Native enum declarations
# ---------------------------------------------------------------------------
_order_status = sa.Enum(
    "pending_payment",
    "paid",
    "shipped",
    "completed",
    "cancelled",
    "closed",
    name="order_status",
)
_cancel_reason = sa.Enum(
    "user_cancel",
    "payment_timeout",
    "merchant_cancel",
    "admin_intervene",
    "out_of_stock",
    name="cancel_reason",
)
_order_status_actor_type = sa.Enum(
    "user",
    "merchant",
    "admin",
    "system",
    name="order_status_actor_type",
)
_payment_channel = sa.Enum(
    "mock_alipay",
    "mock_wechat",
    "mock_bank",
    name="payment_channel",
)
_payment_status = sa.Enum(
    "pending",
    "succeeded",
    "failed",
    "expired",
    name="payment_status",
)
_shipment_event_type = sa.Enum(
    "picked_up",
    "in_transit",
    "arrived_city",
    "out_for_delivery",
    "delivered",
    name="shipment_event_type",
)


def upgrade() -> None:
    bind = op.get_bind()
    _order_status.create(bind, checkfirst=True)
    _cancel_reason.create(bind, checkfirst=True)
    _order_status_actor_type.create(bind, checkfirst=True)
    _payment_channel.create(bind, checkfirst=True)
    _payment_status.create(bind, checkfirst=True)
    _shipment_event_type.create(bind, checkfirst=True)

    # ------------------------------------------------------------- addresses
    op.create_table(
        "addresses",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=False),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("receiver_name", sa.String(length=60), nullable=False),
        sa.Column("receiver_phone", sa.String(length=20), nullable=False),
        sa.Column("province", sa.String(length=40), nullable=False),
        sa.Column("city", sa.String(length=40), nullable=False),
        sa.Column("district", sa.String(length=40), nullable=False),
        sa.Column("detail", sa.String(length=200), nullable=False),
        sa.Column("postal_code", sa.String(length=10), nullable=True),
        sa.Column(
            "is_default",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_addresses_user", ondelete="RESTRICT"
        ),
    )
    op.create_index("ix_addresses_user_id", "addresses", ["user_id"], unique=False)
    op.create_index(
        "ix_addresses_user_deleted",
        "addresses",
        ["user_id", "deleted_at"],
        unique=False,
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_addresses_user_default_partial "
        "ON addresses (user_id) WHERE is_default = TRUE AND deleted_at IS NULL"
    )

    # ------------------------------------------------------------ cart_items
    op.create_table(
        "cart_items",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=False),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("sku_id", sa.BigInteger(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column(
            "selected",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_cart_items_user", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["sku_id"], ["skus.id"], name="fk_cart_items_sku", ondelete="RESTRICT"
        ),
        sa.UniqueConstraint("user_id", "sku_id", name="uq_cart_items_user_sku"),
        sa.CheckConstraint(
            "quantity >= 1 AND quantity <= 999",
            name="ck_cart_items_quantity_range",
        ),
    )
    op.create_index("ix_cart_items_user", "cart_items", ["user_id"], unique=False)

    # ---------------------------------------------------------------- orders
    op.create_table(
        "orders",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=False),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("order_no", sa.String(length=32), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("shop_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "status",
            _order_status,
            nullable=False,
            server_default=sa.text("'pending_payment'"),
        ),
        sa.Column("subtotal_cents", sa.Integer(), nullable=False),
        sa.Column(
            "shipping_fee_cents",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "discount_cents",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("total_cents", sa.Integer(), nullable=False),
        sa.Column("receiver_name", sa.String(length=60), nullable=False),
        sa.Column("receiver_phone", sa.String(length=20), nullable=False),
        sa.Column("receiver_address", sa.String(length=400), nullable=False),
        sa.Column("user_note", sa.Text(), nullable=True),
        sa.Column("merchant_note", sa.Text(), nullable=True),
        sa.Column("admin_note", sa.Text(), nullable=True),
        sa.Column("payment_deadline_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("shipped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("auto_complete_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_reason", _cancel_reason, nullable=True),
        sa.Column("cancel_note", sa.Text(), nullable=True),
        sa.Column("shipping_carrier", sa.String(length=60), nullable=True),
        sa.Column("tracking_no", sa.String(length=60), nullable=True),
        sa.Column("idempotency_key", sa.String(length=120), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_orders_user", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["shop_id"], ["shops.id"], name="fk_orders_shop", ondelete="RESTRICT"
        ),
        sa.UniqueConstraint("order_no", name="uq_orders_order_no"),
        sa.UniqueConstraint(
            "user_id", "idempotency_key", name="uq_orders_user_idempotency"
        ),
    )
    op.create_index("ix_orders_user_created", "orders", ["user_id", "created_at"], unique=False)
    op.create_index(
        "ix_orders_shop_status_created",
        "orders",
        ["shop_id", "status", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_orders_status_payment_deadline",
        "orders",
        ["status", "payment_deadline_at"],
        unique=False,
    )
    op.create_index(
        "ix_orders_status_auto_complete",
        "orders",
        ["status", "auto_complete_at"],
        unique=False,
    )

    # ----------------------------------------------------------- order_items
    op.create_table(
        "order_items",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=False),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("order_id", sa.BigInteger(), nullable=False),
        sa.Column("sku_id", sa.BigInteger(), nullable=False),
        sa.Column("spu_id", sa.BigInteger(), nullable=False),
        sa.Column("shop_id", sa.BigInteger(), nullable=False),
        sa.Column("spu_title", sa.String(length=200), nullable=False),
        sa.Column(
            "sku_specs",
            sa.JSON().with_variant(postgresql.JSONB(), "postgresql"),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
        sa.Column("sku_image", sa.String(length=255), nullable=True),
        sa.Column("unit_price_cents", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("subtotal_cents", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["order_id"],
            ["orders.id"],
            name="fk_order_items_order",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["sku_id"], ["skus.id"], name="fk_order_items_sku", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["spu_id"], ["spus.id"], name="fk_order_items_spu", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["shop_id"], ["shops.id"], name="fk_order_items_shop", ondelete="RESTRICT"
        ),
    )
    op.create_index("ix_order_items_order", "order_items", ["order_id"], unique=False)
    op.create_index("ix_order_items_sku", "order_items", ["sku_id"], unique=False)
    op.create_index("ix_order_items_spu", "order_items", ["spu_id"], unique=False)

    # ------------------------------------------------- order_status_history
    op.create_table(
        "order_status_history",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=False),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("order_id", sa.BigInteger(), nullable=False),
        sa.Column("from_status", sa.String(length=24), nullable=True),
        sa.Column("to_status", sa.String(length=24), nullable=False),
        sa.Column("actor_type", _order_status_actor_type, nullable=False),
        sa.Column("actor_id", sa.BigInteger(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["order_id"],
            ["orders.id"],
            name="fk_order_status_history_order",
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_order_status_history_order_created",
        "order_status_history",
        ["order_id", "created_at"],
        unique=False,
    )

    # ----------------------------------------------------- payment_sessions
    op.create_table(
        "payment_sessions",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=False),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("order_id", sa.BigInteger(), nullable=False),
        sa.Column("channel", _payment_channel, nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            _payment_status,
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column("external_txn_no", sa.String(length=64), nullable=True),
        sa.Column("failure_reason", sa.String(length=200), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["order_id"],
            ["orders.id"],
            name="fk_payment_sessions_order",
            ondelete="CASCADE",
        ),
    )
    op.create_index("ix_payment_sessions_order", "payment_sessions", ["order_id"], unique=False)
    op.execute(
        "CREATE UNIQUE INDEX uq_payment_sessions_pending_order_partial "
        "ON payment_sessions (order_id) WHERE status = 'pending'"
    )

    # ------------------------------------------------------ shipment_events
    op.create_table(
        "shipment_events",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=False),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("order_id", sa.BigInteger(), nullable=False),
        sa.Column("event_type", _shipment_event_type, nullable=False),
        sa.Column("description", sa.String(length=200), nullable=False),
        sa.Column("event_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["order_id"],
            ["orders.id"],
            name="fk_shipment_events_order",
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_shipment_events_order_time",
        "shipment_events",
        ["order_id", "event_time"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_shipment_events_order_time", table_name="shipment_events")
    op.drop_table("shipment_events")

    op.execute("DROP INDEX IF EXISTS uq_payment_sessions_pending_order_partial")
    op.drop_index("ix_payment_sessions_order", table_name="payment_sessions")
    op.drop_table("payment_sessions")

    op.drop_index("ix_order_status_history_order_created", table_name="order_status_history")
    op.drop_table("order_status_history")

    op.drop_index("ix_order_items_spu", table_name="order_items")
    op.drop_index("ix_order_items_sku", table_name="order_items")
    op.drop_index("ix_order_items_order", table_name="order_items")
    op.drop_table("order_items")

    op.drop_index("ix_orders_status_auto_complete", table_name="orders")
    op.drop_index("ix_orders_status_payment_deadline", table_name="orders")
    op.drop_index("ix_orders_shop_status_created", table_name="orders")
    op.drop_index("ix_orders_user_created", table_name="orders")
    op.drop_table("orders")

    op.drop_index("ix_cart_items_user", table_name="cart_items")
    op.drop_table("cart_items")

    op.execute("DROP INDEX IF EXISTS uq_addresses_user_default_partial")
    op.drop_index("ix_addresses_user_deleted", table_name="addresses")
    op.drop_index("ix_addresses_user_id", table_name="addresses")
    op.drop_table("addresses")

    bind = op.get_bind()
    _shipment_event_type.drop(bind, checkfirst=True)
    _payment_status.drop(bind, checkfirst=True)
    _payment_channel.drop(bind, checkfirst=True)
    _order_status_actor_type.drop(bind, checkfirst=True)
    _cancel_reason.drop(bind, checkfirst=True)
    _order_status.drop(bind, checkfirst=True)
