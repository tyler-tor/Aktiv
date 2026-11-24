"""Store distance and duration as numbers (A31)

routes:   distance (text, e.g. "16.2 km")  ->  distance_m (float, metres, NOT NULL)
                                              +  duration_s (integer seconds, nullable)
workouts: distance (text, e.g. "12 miles") ->  distance_m (float, metres, NOT NULL)
          total_time (text, "1 hr 20 min") ->  duration_s (integer seconds, NOT NULL)

Existing rows are converted by parsing the old text (see parse_distance_m /
parse_duration_s below; unparseable text becomes 0 so the NOT NULL columns can
be filled). downgrade() writes the numbers back as text ("16.2 km",
"1 hr 20 min") and drops the numeric columns.

Revision ID: d5e8b3a6c1f2
Revises: c4a1f7e2b9d8
Create Date: 2026-11-24 10:00:00
"""
import os
import re

from alembic import op
import sqlalchemy as sa

environment = (os.getenv("APP_ENV") or os.getenv("FLASK_ENV") or "development").lower()
SCHEMA = os.environ.get("SCHEMA")

# revision identifiers, used by Alembic.
revision = 'd5e8b3a6c1f2'
down_revision = 'c4a1f7e2b9d8'
branch_labels = None
depends_on = None

schema = SCHEMA if environment == "production" else None
prefix = f"{SCHEMA}." if schema else ""

_NUMBER = r'(\d[\d,]*(?:\.\d+)?|\.\d+)'
_UNITS_M = {
    'km': 1000.0, 'kms': 1000.0, 'kilometer': 1000.0, 'kilometers': 1000.0,
    'kilometre': 1000.0, 'kilometres': 1000.0,
    'mi': 1609.344, 'mile': 1609.344, 'miles': 1609.344,
    'm': 1.0, 'meter': 1.0, 'meters': 1.0, 'metre': 1.0, 'metres': 1.0,
    'ft': 0.3048, 'feet': 0.3048, 'foot': 0.3048,
}


def parse_distance_m(text):
    """'16.2 km' -> 16200.0, '12 miles' -> 19312.1, '28.8' -> 28800.0 (no unit = km), junk -> 0.0"""
    if text is None:
        return 0.0
    match = re.search(_NUMBER + r'\s*([a-zA-Z]*)', str(text))
    if not match:
        return 0.0
    value = float(match.group(1).replace(',', ''))
    unit = match.group(2).lower()
    factor = _UNITS_M.get(unit, 1000.0 if unit == '' else None)
    if factor is None:
        factor = 1000.0
    return round(value * factor, 1)


def parse_duration_s(text):
    """'1 hr 20 min' -> 4800, '40 min' -> 2400, '1h' -> 3600, '2:05:30' -> 7530, junk -> 0"""
    if text is None:
        return 0
    text = str(text).strip().lower()
    clock = re.fullmatch(r'(\d+):(\d{1,2})(?::(\d{1,2}))?', text)
    if clock:
        h, m, s = int(clock.group(1)), int(clock.group(2)), int(clock.group(3) or 0)
        return h * 3600 + m * 60 + s
    total = 0.0
    found = False
    for value, unit in re.findall(_NUMBER + r'\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b', text):
        found = True
        value = float(value.replace(',', ''))
        total += value * (3600 if unit.startswith('h') else 60 if unit.startswith('m') else 1)
    if not found and re.fullmatch(_NUMBER, text):
        total = float(text.replace(',', '')) * 60  # a bare number is minutes
    return int(round(total))


def format_distance(meters):
    return f"{(meters or 0) / 1000:.1f} km"


def format_duration(seconds):
    seconds = int(seconds or 0)
    return f"{seconds // 3600} hr {seconds % 3600 // 60} min"


def _table(name):
    return sa.table(
        name, sa.column('id', sa.Integer), sa.column('distance', sa.String),
        sa.column('total_time', sa.String), sa.column('distance_m', sa.Float),
        sa.column('duration_s', sa.Integer), schema=schema)


def upgrade():
    bind = op.get_bind()

    # 1. add the numeric columns as nullable
    with op.batch_alter_table('routes', schema=schema) as batch_op:
        batch_op.add_column(sa.Column('distance_m', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('duration_s', sa.Integer(), nullable=True))
    with op.batch_alter_table('workouts', schema=schema) as batch_op:
        batch_op.add_column(sa.Column('distance_m', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('duration_s', sa.Integer(), nullable=True))

    # 2. convert the existing text
    routes = _table('routes')
    for row in bind.execute(sa.select(routes.c.id, routes.c.distance)).all():
        bind.execute(routes.update().where(routes.c.id == row.id)
                     .values(distance_m=parse_distance_m(row.distance)))
    workouts = _table('workouts')
    for row in bind.execute(sa.select(workouts.c.id, workouts.c.distance, workouts.c.total_time)).all():
        bind.execute(workouts.update().where(workouts.c.id == row.id)
                     .values(distance_m=parse_distance_m(row.distance),
                             duration_s=parse_duration_s(row.total_time)))

    # 3. NOT NULL where the model says so, then drop the text columns
    with op.batch_alter_table('routes', schema=schema) as batch_op:
        batch_op.alter_column('distance_m', existing_type=sa.Float(), nullable=False)
        batch_op.drop_column('distance')
    with op.batch_alter_table('workouts', schema=schema) as batch_op:
        batch_op.alter_column('distance_m', existing_type=sa.Float(), nullable=False)
        batch_op.alter_column('duration_s', existing_type=sa.Integer(), nullable=False)
        batch_op.drop_column('distance')
        batch_op.drop_column('total_time')


def downgrade():
    bind = op.get_bind()

    with op.batch_alter_table('routes', schema=schema) as batch_op:
        batch_op.add_column(sa.Column('distance', sa.String(length=500), nullable=True))
    with op.batch_alter_table('workouts', schema=schema) as batch_op:
        batch_op.add_column(sa.Column('distance', sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column('total_time', sa.String(length=100), nullable=True))

    routes = _table('routes')
    for row in bind.execute(sa.select(routes.c.id, routes.c.distance_m)).all():
        bind.execute(routes.update().where(routes.c.id == row.id)
                     .values(distance=format_distance(row.distance_m)))
    workouts = _table('workouts')
    for row in bind.execute(sa.select(workouts.c.id, workouts.c.distance_m, workouts.c.duration_s)).all():
        bind.execute(workouts.update().where(workouts.c.id == row.id)
                     .values(distance=format_distance(row.distance_m),
                             total_time=format_duration(row.duration_s)))

    with op.batch_alter_table('routes', schema=schema) as batch_op:
        batch_op.drop_column('distance_m')
        batch_op.drop_column('duration_s')
    with op.batch_alter_table('workouts', schema=schema) as batch_op:
        batch_op.alter_column('total_time', existing_type=sa.String(length=100), nullable=False)
        batch_op.drop_column('distance_m')
        batch_op.drop_column('duration_s')
