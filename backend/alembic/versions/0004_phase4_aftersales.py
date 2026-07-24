"""phase 4: aftersales + evidences + status history + messages + items

Revision ID: 0004_phase4_aftersales
Revises: 0003_phase3_cart_order_payment
Create Date: 2026-07-24

Creates the five Phase 4 tables and 8 native enum types:

- aftersales (+ aftersales_type, aftersales_status, aftersales_reason_category,
  aftersales_close_reason, aftersales_escalation_reason,
  aftersales_arbitration_outcome enums)
- aftersales_items
- aftersales_status_history (+ aftersales_actor_type enum)
- aftersales_evidences (+ aftersales_evidence_stage,
  aftersales_evidence_uploader_type enums)
- aftersales_messages (+ aftersales_message_sender_type,
  aftersales_message_kind enums)

Plus an ALTER on orders to add ``has_partial_refund`` and
``total_refunded_cents`` (contract §13).
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0004_phase4_aftersales"
down_revision: str | None = "0003_phase3_cart_order_payment"
branch_labels: tuple[str, ...] | None = None
depends_on: tuple[str, ...] | None = None


# ---------------------------------------------------------------------------
# Native enum declarations
# ---------------------------------------------------------------------------
_aftersales_type = sa.Enum(
    "refund_only",
    "return_refund",
    "exchange",
    name="aftersales_type",
)
_aftersales_status = sa.Enum(
    "pending_merchant_review",
    "merchant_rejected",
    "merchant_agreed_waiting_return",
    "return_shipped_waiting_receive",
    "merchant_agreed_waiting_ship",
    "exchange_shipped_waiting_receive",
    "refunding",
    "admin_arbitrating",
    "completed_refunded",
    "completed_exchanged",
    "user_cancelled",
    "system_closed",
    name="aftersales_status",
)
_aftersales_reason_category = sa.Enum(
    "quality_issue",
    "wrong_item",
    "damage_in_transit",
    "not_as_described",
    "no_longer_needed",
    "duplicate_purchase",
    "other",
    name="aftersales_reason_category",
)
_aftersales_close_reason = sa.Enum(
    "user_cancelled",
    "completed",
    "user_ship_timeout",
    "arbitration_closed",
    "auto_confirmed",
    "system_closed",
    name="aftersales_close_reason",
)
_aftersales_escalation_reason = sa.Enum(
    "merchant_timeout",
    "user_appeal",
    "risk_flagged",
    "manual",
    "merchant_refuse_receive",
    name="aftersales_escalation_reason",
)
_aftersales_arbitration_outcome = sa.Enum(
    "side_with_user",
    "side_with_merchant",
    "partial_refund",
    "other",
    name="aftersales_arbitration_outcome",
)
_aftersales_actor_type = sa.Enum(
    "user",
    "merchant",
    "admin",
    "system",
    name="aftersales_actor_type",
)
_aftersales_evidence_stage = sa.Enum(
    "apply",
    "merchant_review",
    "user_return",
    "merchant_receive",
    "exchange_ship",
    "appeal",
    "arbitration",
    name="aftersales_evidence_stage",
)
_aftersales_evidence_uploader_type = sa.Enum(
    "user",
    "merchant",
    "admin",
    name="aftersales_evidence_uploader_type",
)
_aftersales_message_sender_type = sa.Enum(
    "user",
    "merchant",
    "admin",
    "system",
    name="aftersales_message_sender_type",
)
_aftersales_message_kind = sa.Enum(
    "nudge",
    "appeal",
    "reply",
    "system_notice",
    name="aftersales_message_kind",
)


def upgrade() -> None:
    bind = op.get_bind()
    _aftersales_type.create(bind, checkfirst=True)
    _aftersales_status.create(bind, checkfirst=True)
    _aftersales_reason_category.create(bind, checkfirst=True)
    _aftersales_close_reason.create(bind, checkfirst=True)
    _aftersales_escalation_reason.create(bind, checkfirst=True)
    _aftersales_arbitration_outcome.create(bind, checkfirst=True)
    _aftersales_actor_type.create(bind, checkfirst=True)
    _aftersales_evidence_stage.create(bind, checkfirst=True)
    _aftersales_evidence_uploader_type.create(bind, checkfirst=True)
    _aftersales_message_sender_type.create(bind, checkfirst=True)
    _aftersales_message_kind.create(bind, checkfirst=True)

    # --------------------------------------------------------- ALTER orders
    with op.batch_alter_table("orders") as batch_op:
        batch_op.add_column(
            sa.Column(
                "has_partial_refund",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            )
        )
        batch_op.add_column(
            sa.Column(
                "total_refunded_cents",
                sa.Integer(),
                nullable=False,
                server_default=sa.text("0"),
            )
        )

    # ----------------------------------------------------------- aftersales
    op.create_table(
        "aftersales",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=False),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("aftersales_no", sa.String(length=32), nullable=False),
        sa.Column("order_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("shop_id", sa.BigInteger(), nullable=False),
        sa.Column("type", _aftersales_type, nullable=False),
        sa.Column(
            "status",
            _aftersales_status,
            nullable=False,
            server_default=sa.text("'pending_merchant_review'"),
        ),
        sa.Column("reason_category", _aftersales_reason_category, nullable=False),
        sa.Column("reason_note", sa.Text(), nullable=False),
        sa.Column("refund_amount_cents", sa.Integer(), nullable=False),
        sa.Column("actual_refund_cents", sa.Integer(), nullable=True),
        sa.Column("merchant_reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("merchant_review_note", sa.Text(), nullable=True),
        sa.Column("merchant_review_deadline", sa.DateTime(timezone=True), nullable=False),
        sa.Column("return_address", sa.Text(), nullable=True),
        sa.Column("return_carrier", sa.String(length=60), nullable=True),
        sa.Column("return_tracking_no", sa.String(length=60), nullable=True),
        sa.Column("return_shipped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("return_ship_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("merchant_received_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("merchant_receive_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "merchant_refuse_receive",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("merchant_refuse_note", sa.Text(), nullable=True),
        sa.Column("exchange_carrier", sa.String(length=60), nullable=True),
        sa.Column("exchange_tracking_no", sa.String(length=60), nullable=True),
        sa.Column("exchange_shipped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("exchange_confirm_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("exchange_confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("escalated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "escalation_reason",
            _aftersales_escalation_reason,
            nullable=True,
        ),
        sa.Column("arbitrator_admin_id", sa.BigInteger(), nullable=True),
        sa.Column("arbitrated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("arbitration_conclusion", sa.Text(), nullable=True),
        sa.Column(
            "arbitration_outcome",
            _aftersales_arbitration_outcome,
            nullable=True,
        ),
        sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("refund_txn_no", sa.String(length=64), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("close_reason", _aftersales_close_reason, nullable=True),
        sa.Column(
            "nudge_count",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("last_nudged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "appeal_count",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
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
            ["order_id"], ["orders.id"], name="fk_aftersales_order", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_aftersales_user", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["shop_id"], ["shops.id"], name="fk_aftersales_shop", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["arbitrator_admin_id"],
            ["admin_users.id"],
            name="fk_aftersales_arbitrator",
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint("aftersales_no", name="uq_aftersales_aftersales_no"),
    )
    op.create_index(
        "ix_aftersales_order_deleted",
        "aftersales",
        ["order_id", "deleted_at"],
        unique=False,
    )
    op.create_index(
        "ix_aftersales_user_status_created",
        "aftersales",
        ["user_id", "status", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_aftersales_shop_status_created",
        "aftersales",
        ["shop_id", "status", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_aftersales_status_merchant_deadline",
        "aftersales",
        ["status", "merchant_review_deadline"],
        unique=False,
    )
    op.create_index(
        "ix_aftersales_status_return_deadline",
        "aftersales",
        ["status", "return_ship_deadline"],
        unique=False,
    )
    op.create_index(
        "ix_aftersales_status_receive_deadline",
        "aftersales",
        ["status", "merchant_receive_deadline"],
        unique=False,
    )
    op.create_index(
        "ix_aftersales_status_exchange_deadline",
        "aftersales",
        ["status", "exchange_confirm_deadline"],
        unique=False,
    )
    op.create_index(
        "ix_aftersales_status_escalated",
        "aftersales",
        ["status", "escalated_at"],
        unique=False,
    )
    # Partial UNIQUE: one active aftersales per order. Only declared here.
    op.execute(
        "CREATE UNIQUE INDEX uq_aftersales_active_per_order_partial "
        "ON aftersales (order_id) "
        "WHERE deleted_at IS NULL AND status NOT IN ("
        "'completed_refunded','completed_exchanged','user_cancelled',"
        "'system_closed','merchant_rejected')"
    )

    # ---------------------------------------------------- aftersales_items
    op.create_table(
        "aftersales_items",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=False),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("aftersales_id", sa.BigInteger(), nullable=False),
        sa.Column("order_item_id", sa.BigInteger(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("refund_amount_cents", sa.Integer(), nullable=False),
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
            ["aftersales_id"],
            ["aftersales.id"],
            name="fk_aftersales_items_case",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["order_item_id"],
            ["order_items.id"],
            name="fk_aftersales_items_order_item",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint("aftersales_id", "order_item_id", name="uq_aftersales_items_row"),
    )
    op.create_index(
        "ix_aftersales_items_aftersales",
        "aftersales_items",
        ["aftersales_id"],
        unique=False,
    )

    # -------------------------------------------- aftersales_status_history
    op.create_table(
        "aftersales_status_history",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=False),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("aftersales_id", sa.BigInteger(), nullable=False),
        sa.Column("from_status", sa.String(length=48), nullable=True),
        sa.Column("to_status", sa.String(length=48), nullable=False),
        sa.Column("actor_type", _aftersales_actor_type, nullable=False),
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
            ["aftersales_id"],
            ["aftersales.id"],
            name="fk_aftersales_status_history_case",
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_aftersales_status_history_case_created",
        "aftersales_status_history",
        ["aftersales_id", "created_at"],
        unique=False,
    )

    # ------------------------------------------------ aftersales_evidences
    op.create_table(
        "aftersales_evidences",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=False),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("aftersales_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "uploader_type",
            _aftersales_evidence_uploader_type,
            nullable=False,
        ),
        sa.Column("uploader_id", sa.BigInteger(), nullable=False),
        sa.Column("stage", _aftersales_evidence_stage, nullable=False),
        sa.Column("image_url", sa.String(length=255), nullable=False),
        sa.Column("note", sa.String(length=200), nullable=True),
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
            ["aftersales_id"],
            ["aftersales.id"],
            name="fk_aftersales_evidences_case",
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_aftersales_evidences_case_stage",
        "aftersales_evidences",
        ["aftersales_id", "stage"],
        unique=False,
    )

    # ------------------------------------------------- aftersales_messages
    op.create_table(
        "aftersales_messages",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=False),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("aftersales_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "sender_type",
            _aftersales_message_sender_type,
            nullable=False,
        ),
        sa.Column("sender_id", sa.BigInteger(), nullable=True),
        sa.Column("kind", _aftersales_message_kind, nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
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
            ["aftersales_id"],
            ["aftersales.id"],
            name="fk_aftersales_messages_case",
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_aftersales_messages_case_created",
        "aftersales_messages",
        ["aftersales_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_aftersales_messages_case_created", table_name="aftersales_messages")
    op.drop_table("aftersales_messages")

    op.drop_index("ix_aftersales_evidences_case_stage", table_name="aftersales_evidences")
    op.drop_table("aftersales_evidences")

    op.drop_index(
        "ix_aftersales_status_history_case_created", table_name="aftersales_status_history"
    )
    op.drop_table("aftersales_status_history")

    op.drop_index("ix_aftersales_items_aftersales", table_name="aftersales_items")
    op.drop_table("aftersales_items")

    op.execute("DROP INDEX IF EXISTS uq_aftersales_active_per_order_partial")
    op.drop_index("ix_aftersales_status_escalated", table_name="aftersales")
    op.drop_index("ix_aftersales_status_exchange_deadline", table_name="aftersales")
    op.drop_index("ix_aftersales_status_receive_deadline", table_name="aftersales")
    op.drop_index("ix_aftersales_status_return_deadline", table_name="aftersales")
    op.drop_index("ix_aftersales_status_merchant_deadline", table_name="aftersales")
    op.drop_index("ix_aftersales_shop_status_created", table_name="aftersales")
    op.drop_index("ix_aftersales_user_status_created", table_name="aftersales")
    op.drop_index("ix_aftersales_order_deleted", table_name="aftersales")
    op.drop_table("aftersales")

    with op.batch_alter_table("orders") as batch_op:
        batch_op.drop_column("total_refunded_cents")
        batch_op.drop_column("has_partial_refund")

    bind = op.get_bind()
    _aftersales_message_kind.drop(bind, checkfirst=True)
    _aftersales_message_sender_type.drop(bind, checkfirst=True)
    _aftersales_evidence_uploader_type.drop(bind, checkfirst=True)
    _aftersales_evidence_stage.drop(bind, checkfirst=True)
    _aftersales_actor_type.drop(bind, checkfirst=True)
    _aftersales_arbitration_outcome.drop(bind, checkfirst=True)
    _aftersales_escalation_reason.drop(bind, checkfirst=True)
    _aftersales_close_reason.drop(bind, checkfirst=True)
    _aftersales_reason_category.drop(bind, checkfirst=True)
    _aftersales_status.drop(bind, checkfirst=True)
    _aftersales_type.drop(bind, checkfirst=True)
