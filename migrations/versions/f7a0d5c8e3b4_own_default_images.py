"""Point old third-party image URLs at the images the project owns (A36)

- users.profile_picture: the placeholder hot-linked from a church website, and
  empty values, become /images/default-avatar.svg
- the demo data's pictures in the old `capstone-strava-clone-aktiv` S3 bucket
  (strava+pictures/profile|routes|workouts/N.jpg) become the generated SVGs in
  react-app/public/images/seed/ (see scripts/generate_seed_images.py)

Images uploaded by real users (your own S3 bucket) are not touched.
downgrade() cannot restore the old URLs (they are third-party files that may
no longer exist), so it leaves the data as it is.

Revision ID: f7a0d5c8e3b4
Revises: e6f9c4b7d2a3
Create Date: 2026-11-24 12:00:00
"""
import os
import re

from alembic import op
import sqlalchemy as sa

environment = (os.getenv("APP_ENV") or os.getenv("FLASK_ENV") or "development").lower()
SCHEMA = os.environ.get("SCHEMA")

# revision identifiers, used by Alembic.
revision = 'f7a0d5c8e3b4'
down_revision = 'e6f9c4b7d2a3'
branch_labels = None
depends_on = None

schema = SCHEMA if environment == "production" else None

DEFAULT_AVATAR = '/images/default-avatar.svg'
OLD_BUCKET = 'capstone-strava-clone-aktiv.s3.us-west-2.amazonaws.com'
PROFILE_FILES = {
    'propic-8.jpg': 'demo', 'marnie.jpg': 'marnie', 'bob-pic-jpg.jpg': 'bobbie',
    'jimmy.jpg': 'jimmy', 'tammie.jpg': 'tammie',
}


def new_url(old):
    """Local replacement for a known old URL, or None to leave it alone."""
    if not old:
        return DEFAULT_AVATAR
    if 'dovercourt.org' in old:
        return DEFAULT_AVATAR
    if OLD_BUCKET not in old:
        return None
    match = re.search(r'/(routes|workouts)/(\d+)\.jpg$', old)
    if match:
        return f'/images/seed/{match.group(1)}/{match.group(2)}.svg'
    name = old.rsplit('/', 1)[-1]
    if name in PROFILE_FILES:
        return f'/images/seed/profile/{PROFILE_FILES[name]}.svg'
    return None


def _convert(table_name, column_name, empty_means_default):
    bind = op.get_bind()
    table = sa.table(table_name, sa.column('id', sa.Integer), sa.column(column_name, sa.String), schema=schema)
    column = table.c[column_name]
    for row in bind.execute(sa.select(table.c.id, column)).all():
        old = row[1]
        replacement = new_url(old) if (old or empty_means_default) else None
        if replacement is not None and replacement != old:
            bind.execute(table.update().where(table.c.id == row[0]).values({column_name: replacement}))


def upgrade():
    _convert('users', 'profile_picture', empty_means_default=True)
    _convert('routes', 'image_url', empty_means_default=False)
    _convert('workouts', 'image_url', empty_means_default=False)


def downgrade():
    # Nothing to restore: the old files were third-party hosted.
    pass
