import os
import warnings


def get_app_env():
    """
    Which environment we are running in: 'development', 'testing' or 'production'.

    Read from APP_ENV. FLASK_ENV is still accepted as a fallback because
    existing deployments set it, but Flask 2.3+ removed FLASK_ENV, so new
    setups should use APP_ENV (and FLASK_DEBUG=1 for the debugger/reloader).
    """
    return (os.environ.get('APP_ENV') or os.environ.get('FLASK_ENV') or 'development').lower()


APP_ENV = get_app_env()
IS_PRODUCTION = APP_ENV == 'production'

# Values that must never be used as a real SECRET_KEY.
PLACEHOLDER_SECRET_KEYS = {'', 'change-me', 'changeme', 'secret', 'dev'}


def check_secret_key(secret_key, app_env):
    """
    Refuse to run in production without a real SECRET_KEY.

    Flask signs the session cookie (who is logged in) and the CSRF token with
    this key. If it is missing or a well-known placeholder, anyone can forge a
    session cookie and log in as any user.
    """
    if not secret_key or secret_key.strip() in PLACEHOLDER_SECRET_KEYS:
        message = ('SECRET_KEY is missing or is a placeholder. Generate one with: '
                   'python -c "import secrets; print(secrets.token_hex(32))"')
        if app_env == 'production':
            raise RuntimeError(message)
        warnings.warn(message)


def get_database_url():
    """
    DATABASE_URL from the environment, or None if it is not set.

    SQLAlchemy 1.4+ only accepts 'postgresql://' URLs, but Heroku/Render style
    URLs start with 'postgres://', so that prefix is rewritten.
    """
    url = os.environ.get('DATABASE_URL')
    if url and url.startswith('postgres://'):
        url = url.replace('postgres://', 'postgresql://', 1)
    return url


def _env_flag(name, default):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in ('1', 'true', 'yes', 'on')


class Config:
    """Settings shared by every environment."""
    SECRET_KEY = os.environ.get('SECRET_KEY')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_DATABASE_URI = get_database_url()
    SQLALCHEMY_ECHO = False
    # Test each pooled DB connection before using it, so a connection that
    # Postgres (or a restart / network blip) closed is replaced instead of
    # failing the request.
    SQLALCHEMY_ENGINE_OPTIONS = {'pool_pre_ping': True}

    # Cookie hardening. Session = "who is logged in" (signed with SECRET_KEY).
    # HttpOnly: JavaScript cannot read it (limits damage from XSS).
    # SameSite=Lax: not sent on cross-site POST/PUT/DELETE (extra CSRF layer).
    # Secure: only sent over HTTPS (production only; local dev is plain http).
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    SESSION_COOKIE_SECURE = False
    # Same for Flask-Login's "remember me" cookie. (REMEMBER_COOKIE_SAMESITE is
    # only honoured from Flask-Login 0.6, installed in Batch 2.)
    REMEMBER_COOKIE_HTTPONLY = True
    REMEMBER_COOKIE_SAMESITE = 'Lax'
    REMEMBER_COOKIE_SECURE = False

    # Reject request bodies (e.g. image uploads) bigger than 5 MB with HTTP 413.
    MAX_CONTENT_LENGTH = 5 * 1024 * 1024
    # CSRF tokens stay valid for the whole session (the SPA keeps one token
    # for hours; the default 1-hour limit caused random 400s after idling).
    WTF_CSRF_TIME_LIMIT = None

    # /api/docs lists every route; on by default except in production.
    ENABLE_API_DOCS = _env_flag('ENABLE_API_DOCS', True)


class DevelopmentConfig(Config):
    # Print every SQL statement (handy while developing). Turn off with
    # SQLALCHEMY_ECHO=0 in .env.
    SQLALCHEMY_ECHO = _env_flag('SQLALCHEMY_ECHO', True)


class TestingConfig(Config):
    TESTING = True
    # In-memory SQLite unless the tests point DATABASE_URL somewhere else.
    SQLALCHEMY_DATABASE_URI = get_database_url() or 'sqlite://'


class ProductionConfig(Config):
    SESSION_COOKIE_SECURE = True
    REMEMBER_COOKIE_SECURE = True
    ENABLE_API_DOCS = _env_flag('ENABLE_API_DOCS', False)


config_by_name = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
}


def get_config(app_env=None):
    app_env = app_env or APP_ENV
    if app_env not in config_by_name:
        raise RuntimeError(
            f"Unknown APP_ENV '{app_env}'. Use one of: {', '.join(config_by_name)}")
    return config_by_name[app_env]
