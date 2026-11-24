"""Add indexes on foreign keys and sort columns (A26)

Postgres does not index foreign keys automatically, and the feed / profile
queries filter and sort on these columns:
routes.user_id, routes.created_at, workouts.user_id, workouts.created_at,
comments.user_id, comments.route_id, comments.workout_id, follows.followed_id.
(follows.follower_id is already the first column of the composite primary key.)

Revision ID: c4a1f7e2b9d8
Revises: b7c1e9a4d2f3
Create Date: 2026-11-24 09:00:00
"""
from alembic import op

import os
environment = (os.getenv("APP_ENV") or os.getenv("FLASK_ENV") or "development").lower()
SCHEMA = os.environ.get("SCHEMA")

# revision identifiers, used by Alembic.
revision = 'c4a1f7e2b9d8'
down_revision = 'b7c1e9a4d2f3'
branch_labels = None
depends_on = None

schema = SCHEMA if environment == "production" else None

# (table, column) pairs; the index name matches what SQLAlchemy generates for
# `index=True` on the model column, so the models and the database agree.
INDEXES = [
    ('routes', 'user_id'),
    ('routes', 'created_at'),
    ('workouts', 'user_id'),
    ('workouts', 'created_at'),
    ('comments', 'user_id'),
    ('comments', 'route_id'),
    ('comments', 'workout_id'),
    ('follows', 'followed_id'),
]


def upgrade():
    for table, column in INDEXES:
        op.create_index(op.f(f'ix_{table}_{column}'), table, [column], unique=False, schema=schema)


def downgrade():
    for table, column in reversed(INDEXES):
        op.drop_index(op.f(f'ix_{table}_{column}'), table_name=table, schema=schema)
