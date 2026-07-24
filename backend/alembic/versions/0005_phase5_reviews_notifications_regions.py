"""phase 5: reviews + notifications + regions + shop-profile + address-codes

Revision ID: 0005_phase5_reviews_notifications_regions
Revises: 0004_phase4_aftersales
Create Date: 2026-07-24

Creates the five Phase 5 tables and 4 native enum types:

- reviews (+ partial UNIQUE(order_item_id) WHERE deleted_at IS NULL)
- review_replies (+ UNIQUE(review_id))
- review_reports (+ review_report_reason_category, review_report_status
  enums; UNIQUE(review_id, reporter_user_id))
- notifications (+ notification_recipient_type, notification_category
  enums)
- regions (natural PK on ``code``)

Plus ALTERs on addresses (3 code columns) and shops (7 storefront
profile columns).
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0005_phase5_reviews_notifications_regions"
down_revision: str | None = "0004_phase4_aftersales"
branch_labels: tuple[str, ...] | None = None
depends_on: tuple[str, ...] | None = None


# ---------------------------------------------------------------------------
# Native enum declarations
# ---------------------------------------------------------------------------
_review_report_reason_category = sa.Enum(
    "ad_spam",
    "inappropriate",
    "fake_review",
    "offensive",
    "irrelevant",
    "other",
    name="review_report_reason_category",
)
_review_report_status = sa.Enum(
    "pending",
    "upheld",
    "dismissed",
    name="review_report_status",
)
_notification_recipient_type = sa.Enum(
    "user",
    "merchant",
    "admin",
    name="notification_recipient_type",
)
_notification_category = sa.Enum(
    "system",
    "order",
    "aftersales",
    "review",
    "shop",
    "promo",
    name="notification_category",
)


def upgrade() -> None:
    bind = op.get_bind()
    _review_report_reason_category.create(bind, checkfirst=True)
    _review_report_status.create(bind, checkfirst=True)
    _notification_recipient_type.create(bind, checkfirst=True)
    _notification_category.create(bind, checkfirst=True)

    # ------------------------------------------------------- ALTER addresses
    with op.batch_alter_table("addresses") as batch_op:
        batch_op.add_column(sa.Column("province_code", sa.String(length=12), nullable=True))
        batch_op.add_column(sa.Column("city_code", sa.String(length=12), nullable=True))
        batch_op.add_column(sa.Column("district_code", sa.String(length=12), nullable=True))

    # ----------------------------------------------------------- ALTER shops
    with op.batch_alter_table("shops") as batch_op:
        batch_op.add_column(sa.Column("logo_url", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("banner_url", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("announcement", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("opened_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(
            sa.Column(
                "rating_avg",
                sa.Numeric(precision=3, scale=2),
                nullable=False,
                server_default=sa.text("5.00"),
            )
        )
        batch_op.add_column(
            sa.Column(
                "rating_count",
                sa.Integer(),
                nullable=False,
                server_default=sa.text("0"),
            )
        )
        batch_op.add_column(
            sa.Column(
                "sales_count",
                sa.Integer(),
                nullable=False,
                server_default=sa.text("0"),
            )
        )
    # Backfill opened_at from created_at where NULL (idempotent).
    op.execute("UPDATE shops SET opened_at = created_at WHERE opened_at IS NULL")

    # -------------------------------------------------------------- regions
    op.create_table(
        "regions",
        sa.Column("code", sa.String(length=12), primary_key=True, nullable=False),
        sa.Column("parent_code", sa.String(length=12), nullable=True),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("short_name", sa.String(length=20), nullable=True),
        sa.Column("level", sa.SmallInteger(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.ForeignKeyConstraint(
            ["parent_code"], ["regions.code"], name="fk_regions_parent", ondelete="RESTRICT"
        ),
    )
    op.create_index("ix_regions_parent", "regions", ["parent_code"], unique=False)
    op.create_index("ix_regions_level", "regions", ["level"], unique=False)

    # -------------------------------------------------------------- reviews
    op.create_table(
        "reviews",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=False),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("order_id", sa.BigInteger(), nullable=False),
        sa.Column("order_item_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("spu_id", sa.BigInteger(), nullable=False),
        sa.Column("sku_id", sa.BigInteger(), nullable=False),
        sa.Column("shop_id", sa.BigInteger(), nullable=False),
        sa.Column("rating", sa.SmallInteger(), nullable=False),
        sa.Column("content", sa.String(length=2000), nullable=False),
        sa.Column("images", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column(
            "is_anonymous",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "visible",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column("hidden_by_admin_id", sa.BigInteger(), nullable=True),
        sa.Column("hidden_reason", sa.Text(), nullable=True),
        sa.Column("hidden_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "edit_count",
            sa.SmallInteger(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("edit_deadline_at", sa.DateTime(timezone=True), nullable=False),
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
            ["order_id"], ["orders.id"], name="fk_reviews_order", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["order_item_id"],
            ["order_items.id"],
            name="fk_reviews_order_item",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_reviews_user", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["spu_id"], ["spus.id"], name="fk_reviews_spu", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["sku_id"], ["skus.id"], name="fk_reviews_sku", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["shop_id"], ["shops.id"], name="fk_reviews_shop", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["hidden_by_admin_id"],
            ["admin_users.id"],
            name="fk_reviews_hidden_admin",
            ondelete="SET NULL",
        ),
        sa.CheckConstraint("rating BETWEEN 1 AND 5", name="ck_reviews_rating_range"),
    )
    op.create_index(
        "ix_reviews_spu_visible_created",
        "reviews",
        ["spu_id", "visible", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_reviews_shop_visible_created",
        "reviews",
        ["shop_id", "visible", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_reviews_user_created",
        "reviews",
        ["user_id", "created_at"],
        unique=False,
    )
    # Partial UNIQUE: one review per order_item, ignoring soft-deleted rows.
    op.execute(
        "CREATE UNIQUE INDEX uq_reviews_order_item_partial "
        "ON reviews (order_item_id) "
        "WHERE deleted_at IS NULL"
    )

    # -------------------------------------------------------- review_replies
    op.create_table(
        "review_replies",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=False),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("review_id", sa.BigInteger(), nullable=False),
        sa.Column("merchant_account_id", sa.BigInteger(), nullable=False),
        sa.Column("shop_id", sa.BigInteger(), nullable=False),
        sa.Column("content", sa.String(length=500), nullable=False),
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
            ["review_id"], ["reviews.id"], name="fk_review_replies_review", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["merchant_account_id"],
            ["merchant_accounts.id"],
            name="fk_review_replies_merchant",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["shop_id"], ["shops.id"], name="fk_review_replies_shop", ondelete="RESTRICT"
        ),
        sa.UniqueConstraint("review_id", name="uq_review_replies_review"),
    )

    # -------------------------------------------------------- review_reports
    op.create_table(
        "review_reports",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=False),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("review_id", sa.BigInteger(), nullable=False),
        sa.Column("reporter_user_id", sa.BigInteger(), nullable=False),
        sa.Column("reason_category", _review_report_reason_category, nullable=False),
        sa.Column("reason_note", sa.Text(), nullable=True),
        sa.Column(
            "status",
            _review_report_status,
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column("reviewer_admin_id", sa.BigInteger(), nullable=True),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
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
            ["review_id"], ["reviews.id"], name="fk_review_reports_review", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["reporter_user_id"],
            ["users.id"],
            name="fk_review_reports_user",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["reviewer_admin_id"],
            ["admin_users.id"],
            name="fk_review_reports_admin",
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint(
            "review_id",
            "reporter_user_id",
            name="uq_review_reports_review_reporter",
        ),
    )
    op.create_index(
        "ix_review_reports_status_created",
        "review_reports",
        ["status", "created_at"],
        unique=False,
    )

    # -------------------------------------------------------- notifications
    op.create_table(
        "notifications",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=False),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("recipient_type", _notification_recipient_type, nullable=False),
        sa.Column("recipient_id", sa.BigInteger(), nullable=False),
        sa.Column("category", _notification_category, nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("action_url", sa.String(length=500), nullable=True),
        sa.Column("related_type", sa.String(length=60), nullable=True),
        sa.Column("related_id", sa.BigInteger(), nullable=True),
        sa.Column(
            "is_read",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
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
    )
    op.create_index(
        "ix_notifications_inbox",
        "notifications",
        ["recipient_type", "recipient_id", "is_read", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_inbox", table_name="notifications")
    op.drop_table("notifications")

    op.drop_index("ix_review_reports_status_created", table_name="review_reports")
    op.drop_table("review_reports")

    op.drop_table("review_replies")

    op.execute("DROP INDEX IF EXISTS uq_reviews_order_item_partial")
    op.drop_index("ix_reviews_user_created", table_name="reviews")
    op.drop_index("ix_reviews_shop_visible_created", table_name="reviews")
    op.drop_index("ix_reviews_spu_visible_created", table_name="reviews")
    op.drop_table("reviews")

    op.drop_index("ix_regions_level", table_name="regions")
    op.drop_index("ix_regions_parent", table_name="regions")
    op.drop_table("regions")

    with op.batch_alter_table("shops") as batch_op:
        batch_op.drop_column("sales_count")
        batch_op.drop_column("rating_count")
        batch_op.drop_column("rating_avg")
        batch_op.drop_column("opened_at")
        batch_op.drop_column("announcement")
        batch_op.drop_column("banner_url")
        batch_op.drop_column("logo_url")

    with op.batch_alter_table("addresses") as batch_op:
        batch_op.drop_column("district_code")
        batch_op.drop_column("city_code")
        batch_op.drop_column("province_code")

    bind = op.get_bind()
    _notification_category.drop(bind, checkfirst=True)
    _notification_recipient_type.drop(bind, checkfirst=True)
    _review_report_status.drop(bind, checkfirst=True)
    _review_report_reason_category.drop(bind, checkfirst=True)
