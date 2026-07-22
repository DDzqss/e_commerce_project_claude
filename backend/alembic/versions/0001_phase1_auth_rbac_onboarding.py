"""phase 1: auth, rbac, merchant onboarding

Revision ID: 0001_phase1_auth_rbac_onboarding
Revises:
Create Date: 2026-07-22

Creates the seven Phase 1 tables:

- users
- shops
- merchant_accounts
- merchant_applications
- admin_users
- refresh_tokens
- audit_logs

Enums are declared as native Postgres enum types so alter/rename is
manageable through Alembic in later phases.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0001_phase1_auth_rbac_onboarding"
down_revision: str | None = None
branch_labels: tuple[str, ...] | None = None
depends_on: tuple[str, ...] | None = None


# ---------------------------------------------------------------------------
# Enums (created explicitly so downgrade can drop them cleanly)
# ---------------------------------------------------------------------------
_user_status = sa.Enum("active", "disabled", name="user_status")
_shop_status = sa.Enum("active", "frozen", name="shop_status")
_merchant_account_status = sa.Enum("active", "frozen", name="merchant_account_status")
_merchant_role = sa.Enum(
    "SHOP_OWNER", "SHOP_OPERATOR", "SHOP_SUPPORT", name="merchant_role"
)
_merchant_application_status = sa.Enum(
    "pending", "approved", "rejected", "withdrawn", name="merchant_application_status"
)
_admin_role = sa.Enum(
    "SUPER_ADMIN",
    "BUSINESS_ADMIN",
    "CUSTOMER_SERVICE_ADMIN",
    "TECH_ADMIN",
    name="admin_role",
)
_admin_status = sa.Enum("active", "disabled", name="admin_status")
_refresh_subject = sa.Enum(
    "user", "merchant", "admin", name="refresh_token_subject_type"
)
_audit_actor = sa.Enum(
    "user", "merchant", "admin", "system", "anonymous", name="audit_actor_type"
)


def upgrade() -> None:
    bind = op.get_bind()
    _user_status.create(bind, checkfirst=True)
    _shop_status.create(bind, checkfirst=True)
    _merchant_account_status.create(bind, checkfirst=True)
    _merchant_role.create(bind, checkfirst=True)
    _merchant_application_status.create(bind, checkfirst=True)
    _admin_role.create(bind, checkfirst=True)
    _admin_status.create(bind, checkfirst=True)
    _refresh_subject.create(bind, checkfirst=True)
    _audit_actor.create(bind, checkfirst=True)

    # ------------------------------------------------------------------ users
    op.create_table(
        "users",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=False),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("email", sa.String(length=120), nullable=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("nickname", sa.String(length=60), nullable=False),
        sa.Column("avatar_url", sa.String(length=255), nullable=True),
        sa.Column(
            "status",
            _user_status,
            nullable=False,
            server_default=sa.text("'active'"),
        ),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.UniqueConstraint("phone", name="uq_users_phone"),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.CheckConstraint(
            "(phone IS NOT NULL) OR (email IS NOT NULL)",
            name="ck_users_phone_or_email_required",
        ),
    )

    # ------------------------------------------------------------------ shops
    op.create_table(
        "shops",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=False),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("contact_name", sa.String(length=60), nullable=False),
        sa.Column("contact_phone", sa.String(length=20), nullable=False),
        sa.Column(
            "status",
            _shop_status,
            nullable=False,
            server_default=sa.text("'active'"),
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
        sa.UniqueConstraint("name", name="uq_shops_name"),
    )

    # ------------------------------------------------------ merchant_accounts
    op.create_table(
        "merchant_accounts",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=False),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("login_name", sa.String(length=60), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("shop_id", sa.BigInteger(), nullable=False),
        sa.Column("role", _merchant_role, nullable=False),
        sa.Column(
            "status",
            _merchant_account_status,
            nullable=False,
            server_default=sa.text("'active'"),
        ),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
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
            ["user_id"],
            ["users.id"],
            name="fk_merchant_accounts_user",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["shop_id"],
            ["shops.id"],
            name="fk_merchant_accounts_shop",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint("login_name", name="uq_merchant_accounts_login_name"),
        sa.UniqueConstraint(
            "user_id", "shop_id", name="uq_merchant_accounts_user_shop"
        ),
    )
    op.create_index(
        "ix_merchant_accounts_user_id", "merchant_accounts", ["user_id"], unique=False
    )
    op.create_index(
        "ix_merchant_accounts_shop_id", "merchant_accounts", ["shop_id"], unique=False
    )

    # ------------------------------------------------------------ admin_users
    op.create_table(
        "admin_users",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=False),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("username", sa.String(length=60), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=60), nullable=False),
        sa.Column("role", _admin_role, nullable=False),
        sa.Column(
            "status",
            _admin_status,
            nullable=False,
            server_default=sa.text("'active'"),
        ),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.UniqueConstraint("username", name="uq_admin_users_username"),
    )

    # -------------------------------------------------- merchant_applications
    op.create_table(
        "merchant_applications",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=False),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("applicant_user_id", sa.BigInteger(), nullable=False),
        sa.Column("shop_name", sa.String(length=120), nullable=False),
        sa.Column("contact_name", sa.String(length=60), nullable=False),
        sa.Column("contact_phone", sa.String(length=20), nullable=False),
        sa.Column("business_license_no", sa.String(length=50), nullable=False),
        sa.Column("business_license_url", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            _merchant_application_status,
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column("reviewer_admin_id", sa.BigInteger(), nullable=True),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "approved_merchant_account_id", sa.BigInteger(), nullable=True
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
            ["applicant_user_id"],
            ["users.id"],
            name="fk_merchant_applications_user",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["reviewer_admin_id"],
            ["admin_users.id"],
            name="fk_merchant_applications_reviewer",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["approved_merchant_account_id"],
            ["merchant_accounts.id"],
            name="fk_merchant_applications_approved_account",
            ondelete="SET NULL",
        ),
    )
    op.create_index(
        "ix_merchant_applications_applicant_user_id",
        "merchant_applications",
        ["applicant_user_id"],
        unique=False,
    )
    op.create_index(
        "ix_merchant_applications_reviewer_admin_id",
        "merchant_applications",
        ["reviewer_admin_id"],
        unique=False,
    )
    op.create_index(
        "ix_merchant_applications_approved_merchant_account_id",
        "merchant_applications",
        ["approved_merchant_account_id"],
        unique=False,
    )
    op.create_index(
        "ix_merchant_applications_status",
        "merchant_applications",
        ["status"],
        unique=False,
    )

    # ---------------------------------------------------------- refresh_tokens
    op.create_table(
        "refresh_tokens",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=False),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("subject_type", _refresh_subject, nullable=False),
        sa.Column("subject_id", sa.BigInteger(), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.UniqueConstraint("token_hash", name="uq_refresh_tokens_token_hash"),
    )
    op.create_index(
        "ix_refresh_tokens_subject",
        "refresh_tokens",
        ["subject_type", "subject_id"],
        unique=False,
    )

    # -------------------------------------------------------------- audit_logs
    op.create_table(
        "audit_logs",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=False),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("actor_type", _audit_actor, nullable=False),
        sa.Column("actor_id", sa.BigInteger(), nullable=True),
        sa.Column("action", sa.String(length=80), nullable=False),
        sa.Column("target_type", sa.String(length=60), nullable=True),
        sa.Column("target_id", sa.BigInteger(), nullable=True),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("extra", sa.JSON(), nullable=True),
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
        "ix_audit_logs_actor", "audit_logs", ["actor_type", "actor_id"], unique=False
    )
    op.create_index(
        "ix_audit_logs_action", "audit_logs", ["action"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_index("ix_audit_logs_actor", table_name="audit_logs")
    op.drop_table("audit_logs")

    op.drop_index("ix_refresh_tokens_subject", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")

    op.drop_index(
        "ix_merchant_applications_status", table_name="merchant_applications"
    )
    op.drop_index(
        "ix_merchant_applications_approved_merchant_account_id",
        table_name="merchant_applications",
    )
    op.drop_index(
        "ix_merchant_applications_reviewer_admin_id",
        table_name="merchant_applications",
    )
    op.drop_index(
        "ix_merchant_applications_applicant_user_id",
        table_name="merchant_applications",
    )
    op.drop_table("merchant_applications")

    op.drop_table("admin_users")

    op.drop_index("ix_merchant_accounts_shop_id", table_name="merchant_accounts")
    op.drop_index("ix_merchant_accounts_user_id", table_name="merchant_accounts")
    op.drop_table("merchant_accounts")

    op.drop_table("shops")
    op.drop_table("users")

    bind = op.get_bind()
    _audit_actor.drop(bind, checkfirst=True)
    _refresh_subject.drop(bind, checkfirst=True)
    _admin_status.drop(bind, checkfirst=True)
    _admin_role.drop(bind, checkfirst=True)
    _merchant_application_status.drop(bind, checkfirst=True)
    _merchant_role.drop(bind, checkfirst=True)
    _merchant_account_status.drop(bind, checkfirst=True)
    _shop_status.drop(bind, checkfirst=True)
    _user_status.drop(bind, checkfirst=True)
