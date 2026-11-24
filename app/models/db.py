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


def iso(value):
    """
    A stored (naive, UTC) timestamp as an ISO 8601 string with a trailing "Z",
    e.g. "2026-11-24T09:30:00Z". The API used to return Flask's default
    RFC 822 date ("Tue, 24 Nov 2026 09:30:00 GMT"), which cannot be sorted as
    text and is awkward to parse in JavaScript.
    """
    if value is None:
        return None
    return value.replace(microsecond=0).isoformat() + 'Z'


def utcnow():
    """
    The current time in UTC, used as the Python-side default for created_at /
    updated_at (it used to be datetime.now, i.e. the server's local time).

    The columns are plain DateTime ("timestamp without time zone"), so the
    value is stored without tzinfo: every timestamp in the database is UTC,
    the same as the server_default CURRENT_TIMESTAMP / now() on a UTC database.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)
