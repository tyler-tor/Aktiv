"""Reconcile the database schema with the models (A15)

- drop workouts.route_id (created by the first migration, never in the model)
- follows: composite primary key (follower_id, followed_id), NOT NULL,
  ON DELETE CASCADE to users; removes NULL rows and self-follows
- server-side CURRENT_TIMESTAMP defaults for created_at / updated_at

Revision ID: b7c1e9a4d2f3
Revises: 0a0f8863271d
Create Date: 2026-11-23 12:00:00
"""
from alembic import op
import sqlalchemy as sa

import os
environment = (os.getenv("APP_ENV") or os.getenv("FLASK_ENV") or "development").lower()
SCHEMA = os.environ.get("SCHEMA")

# revision identifiers, used by Alembic.
revision = 'b7c1e9a4d2f3'
down_revision = '0a0f8863271d'
branch_labels = None
depends_on = None

# In production (Render-style Postgres) every table lives in SCHEMA.
schema = SCHEMA if environment == "production" else None
prefix = f"{SCHEMA}." if schema else ""

TIMESTAMP_TABLES = ['users', 'routes', 'workouts', 'comments']


def _create_follows(table_name, with_pk):
    """Create a follows-shaped table (new = PK + cascade, old = original shape)."""
    if with_pk:
        op.create_table(
            table_name,
            sa.Column('follower_id', sa.Integer(), nullable=False),
            sa.Column('followed_id', sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(['follower_id'], [f'{prefix}users.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['followed_id'], [f'{prefix}users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('follower_id', 'followed_id'),
            schema=schema,
        )
    else:
        op.create_table(
            table_name,
            sa.Column('follower_id', sa.Integer(), nullable=True),
            sa.Column('followed_id', sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(['follower_id'], [f'{prefix}users.id']),
            sa.ForeignKeyConstraint(['followed_id'], [f'{prefix}users.id']),
            sa.UniqueConstraint('follower_id', 'followed_id'),
            schema=schema,
        )


def upgrade():
    # 1. workouts.route_id: in the table since the first migration but not in
    #    the Workout model and unused by the app. (On Postgres dropping the
    #    column also drops its foreign key; on SQLite batch mode rebuilds the table.)
    with op.batch_alter_table('workouts', schema=schema) as batch_op:
        batch_op.drop_column('route_id')

    # 2. follows: rebuild with a composite primary key. Rebuilding (create new
    #    table, copy, swap) works the same on SQLite and Postgres and avoids
    #    guessing the auto-generated names of the old constraints.
    _create_follows('follows_new', with_pk=True)
    op.execute(
        f"INSERT INTO {prefix}follows_new (follower_id, followed_id) "
        f"SELECT DISTINCT follower_id, followed_id FROM {prefix}follows "
        f"WHERE follower_id IS NOT NULL AND followed_id IS NOT NULL "
        f"AND follower_id <> followed_id"
    )
    op.drop_table('follows', schema=schema)
    op.rename_table('follows_new', 'follows', schema=schema)

    # 3. Database-side defaults for timestamps, so rows inserted outside the
    #    ORM (raw SQL, psql, data fixes) still get created_at/updated_at.
    for table in TIMESTAMP_TABLES:
        with op.batch_alter_table(table, schema=schema) as batch_op:
            for column in ('created_at', 'updated_at'):
                batch_op.alter_column(column, existing_type=sa.DateTime(),
                                      existing_nullable=True,
                                      server_default=sa.func.now())


def downgrade():
    for table in TIMESTAMP_TABLES:
        with op.batch_alter_table(table, schema=schema) as batch_op:
            for column in ('created_at', 'updated_at'):
                batch_op.alter_column(column, existing_type=sa.DateTime(),
                                      existing_nullable=True,
                                      server_default=None)

    _create_follows('follows_old', with_pk=False)
    op.execute(
        f"INSERT INTO {prefix}follows_old (follower_id, followed_id) "
        f"SELECT follower_id, followed_id FROM {prefix}follows"
    )
    op.drop_table('follows', schema=schema)
    op.rename_table('follows_old', 'follows', schema=schema)

    with op.batch_alter_table('workouts', schema=schema) as batch_op:
        batch_op.add_column(sa.Column('route_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('workouts_route_id_fkey', 'routes', ['route_id'], ['id'],
                                    referent_schema=schema)
