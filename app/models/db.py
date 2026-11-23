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