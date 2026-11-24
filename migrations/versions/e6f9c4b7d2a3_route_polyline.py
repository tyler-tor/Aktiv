"""Store the Google Directions polyline on routes (A28)

routes.encoded_polyline (text, nullable): the encoded path between the start and
end point, computed once by the server when a route is created or edited
(see app/services/directions.py). Existing routes stay NULL until
`flask directions backfill` is run.

Revision ID: e6f9c4b7d2a3
Revises: d5e8b3a6c1f2
Create Date: 2026-11-24 11:00:00
"""
import os

from alembic import op
import sqlalchemy as sa

environment = (os.getenv("APP_ENV") or os.getenv("FLASK_ENV") or "development").lower()
SCHEMA = os.environ.get("SCHEMA")

# revision identifiers, used by Alembic.
revision = 'e6f9c4b7d2a3'
down_revision = 'd5e8b3a6c1f2'
branch_labels = None
depends_on = None

schema = SCHEMA if environment == "production" else None


def upgrade():
    with op.batch_alter_table('routes', schema=schema) as batch_op:
        batch_op.add_column(sa.Column('encoded_polyline', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('routes', schema=schema) as batch_op:
        batch_op.drop_column('encoded_polyline')
