from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy

import os
from app.config import get_app_env

# "production" makes the models use the Postgres SCHEMA (Render setup).
environment = get_app_env()
SCHEMA = os.environ.get("SCHEMA")


db = SQLAlchemy()

# helper function for adding prefix to foreign key column references in production
def add_prefix_for_prod(attr):
    if environment == "production":
        return f"{SCHEMA}.{attr}"
    else:
        return attr


def utcnow():
    """
    The current time in UTC, used as the Python-side default for created_at /
    updated_at (it used to be datetime.now, i.e. the server's local time).

    The columns are plain DateTime ("timestamp without time zone"), so the
    value is stored without tzinfo: every timestamp in the database is UTC,
    the same as the server_default CURRENT_TIMESTAMP / now() on a UTC database.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)
