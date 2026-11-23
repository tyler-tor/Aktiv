import os
import warnings

# Values that must never be used as a real SECRET_KEY.
PLACEHOLDER_SECRET_KEYS = {'', 'change-me', 'changeme', 'secret', 'dev'}


def check_secret_key(secret_key, flask_env):
    """
    Refuse to run in production without a real SECRET_KEY.

    Flask signs the session cookie (who is logged in) and the CSRF token with
    this key. If it is missing or a well-known placeholder, anyone can forge a
    session cookie and log in as any user.
    """
    if not secret_key or secret_key.strip() in PLACEHOLDER_SECRET_KEYS:
        message = ('SECRET_KEY is missing or is a placeholder. Generate one with: '
                   'python -c "import secrets; print(secrets.token_hex(32))"')
        if flask_env == 'production':
            raise RuntimeError(message)
        warnings.warn(message)


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # SQLAlchemy 1.4 no longer supports url strings that start with 'postgres'
    # (only 'postgresql') but heroku's postgres add-on automatically sets the
    # url in the hidden config vars to start with postgres.
    # so the connection uri must be updated here (for production)
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL').replace('postgres://', 'postgresql://')
    SQLALCHEMY_ECHO = True