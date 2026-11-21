"""Add refresh sessions and seed base roles.

Revision ID: 20261118_002
Revises: 20261118_001
"""

from collections.abc import Sequence
from uuid import UUID

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261118_002"
down_revision: str | Sequence[str] | None = "20261118_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ADMIN_ROLE_ID = UUID("11111111-1111-4111-8111-111111111111")
VIEWER_ROLE_ID = UUID("22222222-2222-4222-8222-222222222222")


def upgrade() -> None:
    op.create_table(
        "refresh_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_refresh_sessions_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_refresh_sessions")),
        sa.UniqueConstraint(
            "token_hash",
            name=op.f("uq_refresh_sessions_token_hash"),
        ),
    )
    op.create_index(
        "ix_refresh_sessions_user_id",
        "refresh_sessions",
        ["user_id"],
        unique=False,
    )

    roles = sa.table(
        "roles",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("name", sa.String()),
    )
    op.bulk_insert(
        roles,
        [
            {"id": ADMIN_ROLE_ID, "name": "admin"},
            {"id": VIEWER_ROLE_ID, "name": "viewer"},
        ],
    )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM roles WHERE name IN ('admin', 'viewer')"))
    op.drop_index(
        "ix_refresh_sessions_user_id",
        table_name="refresh_sessions",
    )
    op.drop_table("refresh_sessions")
