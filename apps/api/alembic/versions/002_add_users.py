"""add users and workspace user_id

Revision ID: 002
Revises: 001
Create Date: 2026-05-14
"""

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.add_column(
        "workspaces",
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
    )
    op.create_index("ix_workspaces_user_id", "workspaces", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_workspaces_user_id", "workspaces")
    op.drop_column("workspaces", "user_id")
    op.drop_index("ix_users_email", "users")
    op.drop_table("users")
