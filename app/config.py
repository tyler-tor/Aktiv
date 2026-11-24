"""Configuration classes, chosen by create_app().

Which class is used: create_app('development' | 'testing' | 'production'),
or, with no argument, the APP_ENV environment variable (default development).

Settings are read from the environment when create_app() runs (each Config
is instantiated then), not when this module is imported, so tests can change
the environment and build a fresh app.
"""
import os
import warnings

from sqlalchemy.engine import make_url


def get_app_env():
    """
    Which environment we are running in: 'development', 'testing' or 'production'.

    Read from APP_ENV. FLASK_ENV is still accepted as a fallback because
    existing deployments set it, but Flask 2.3+ removed FLASK_ENV, so new
    setups should use APP_ENV (and FLASK_DEBUG=1 for the debugger/reloader).
    """
    return (os.environ.get('APP_ENV') or os.environ.get('FLASK_ENV') or 'development').lower()


APP_ENV = get_app_env()

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


def normalize_db_url(url):
    """
    Use the psycopg 3 driver for Postgres URLs.

    SQLAlchemy only accepts 'postgresql://' (Heroku/Render style URLs start
    with 'postgres://'), and a plain 'postgresql://' means the old psycopg2
    driver, which is no longer installed. Both become 'postgresql+psycopg://'.
    """
    if not url:
        return url
    for prefix in ('postgres://', 'postgresql://'):
        if url.startswith(prefix):
            return 'postgresql+psycopg://' + url[len(prefix):]
    return url


def get_database_url():
    """DATABASE_URL from the environment (normalized), or None if it is not set."""
    return normalize_db_url(os.environ.get('DATABASE_URL'))


def with_password(url, password):
    """
    Put `password` into a Postgres URL, escaped correctly.

    RDS-generated passwords often contain characters such as @ / : # that
    break a hand-written URL. With DATABASE_PASSWORD set, DATABASE_URL can be
    written without a password (postgresql://aktiv@host:5432/aktiv).
    """
    if not url or not password or not url.startswith('postgresql'):
        return url
    return make_url(url).set(password=password).render_as_string(hide_password=False)


def _env_flag(name, default):
    value = os.environ.get(name)
    if value is None or value.strip() == '':
        return default
    return value.strip().lower() in ('1', 'true', 'yes', 'on')


def _env_int(name, default):
    value = os.environ.get(name)
    return int(value) if value not in (None, '') else default


def engine_options(url):
    """
    SQLAlchemy engine settings for the database in `url`.

    Postgres (production: AWS RDS, shared with other apps) gets a small,
    self-healing connection pool:
      * pool_pre_ping: test a pooled connection before using it, so one that
        RDS closed (restart, failover, idle timeout) is replaced instead of
        failing a request.
      * pool_recycle: replace connections older than DB_POOL_RECYCLE seconds.
      * pool_size / max_overflow: at most DB_POOL_SIZE + DB_MAX_OVERFLOW
        connections per gunicorn worker process (default 5 + 2; with 2
        workers that is at most 14 for this app on the shared instance).
      * DATABASE_SSLMODE: passed to psycopg as sslmode ("require" for RDS;
        "verify-full" also needs DATABASE_SSLROOTCERT = the RDS CA bundle).
    SQLite (local development, tests) only gets pool_pre_ping.
    """
    if not url or not url.startswith('postgresql'):
        return {'pool_pre_ping': True}
    connect_args = {
        'connect_timeout': _env_int('DB_CONNECT_TIMEOUT', 10),
        'application_name': os.environ.get('DB_APPLICATION_NAME', 'aktiv'),
    }
    sslmode = os.environ.get('DATABASE_SSLMODE')
    if sslmode:
        connect_args['sslmode'] = sslmode
    sslrootcert = os.environ.get('DATABASE_SSLROOTCERT')
    if sslrootcert:
        connect_args['sslrootcert'] = sslrootcert
    return {
        'pool_pre_ping': True,
        'pool_recycle': _env_int('DB_POOL_RECYCLE', 300),
        'pool_size': _env_int('DB_POOL_SIZE', 5),
        'max_overflow': _env_int('DB_MAX_OVERFLOW', 2),
        'connect_args': connect_args,
    }


class Config:
    """Settings shared by every environment."""
    IS_PRODUCTION = False
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = False

    # Cookie hardening. Session = "who is logged in" (signed with SECRET_KEY).
    # HttpOnly: JavaScript cannot read it (limits damage from XSS).
    # SameSite=Lax: not sent on cross-site POST/PUT/DELETE (extra CSRF layer).
    # Secure: only sent over HTTPS (production only; local dev is plain http).
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    SESSION_COOKIE_SECURE = False
    # Same for Flask-Login's "remember me" cookie.
    REMEMBER_COOKIE_HTTPONLY = True
    REMEMBER_COOKIE_SAMESITE = 'Lax'
    REMEMBER_COOKIE_SECURE = False

    # Reject request bodies (e.g. image uploads) bigger than 5 MB with HTTP 413.
    MAX_CONTENT_LENGTH = 5 * 1024 * 1024
    # CSRF tokens stay valid for the whole session (the SPA keeps one token
    # for hours; the default 1-hour limit caused random 400s after idling).
    WTF_CSRF_TIME_LIMIT = None

    def __init__(self):
        self.SECRET_KEY = os.environ.get('SECRET_KEY')
        self.SQLALCHEMY_DATABASE_URI = get_database_url()

        # Google Maps *server* key for the Directions API. Optional: without
        # it routes are saved without a stored polyline. Never sent to the browser.
        self.GOOGLE_MAPS_SERVER_KEY = os.environ.get('GOOGLE_MAPS_SERVER_KEY')

        # /api/docs lists every route; on by default except in production.
        self.ENABLE_API_DOCS = _env_flag('ENABLE_API_DOCS', not self.IS_PRODUCTION)

        # Serve the React build (react-app/dist) from Flask? On by default for
        # local development; OFF in production, where the frontend is static
        # files on S3 + CloudFront and this app is API-only (the Docker image
        # does not contain the build). SERVE_FRONTEND=true turns it back on.
        self.SERVE_FRONTEND = _env_flag('SERVE_FRONTEND', not self.IS_PRODUCTION)

        # Uploaded images. boto3 finds credentials by itself (default chain):
        # the EC2 instance role in production, AWS_PROFILE / `aws sso login`
        # locally. There are deliberately no access-key settings here.
        self.S3_BUCKET = os.environ.get('S3_BUCKET') or None
        self.AWS_REGION = (os.environ.get('AWS_REGION')
                           or os.environ.get('AWS_DEFAULT_REGION') or 'us-east-2')
        # Public base URL of the bucket's files, e.g.
        # https://aktiv.tylertorrero.dev/media (CloudFront sends /media/* to
        # the private bucket and strips "/media"). S3_PUBLIC_URL is the older
        # name and still accepted. Empty = the bucket's own S3 URL.
        self.MEDIA_BASE_URL = (os.environ.get('MEDIA_BASE_URL')
                               or os.environ.get('S3_PUBLIC_URL') or '').strip().rstrip('/')

        # Reverse proxies in front of the app. In production a request goes
        # browser -> CloudFront -> Caddy (on the EC2) -> gunicorn, and Caddy
        # sets X-Forwarded-Proto / X-Forwarded-Host / X-Forwarded-For.
        # TRUSTED_PROXY_HOPS = how many proxies to believe for Proto and Host
        # (default 1 in production = Caddy; 0 = ignore them, e.g. locally,
        # where nobody is in front and anyone could send fake headers).
        # TRUSTED_PROXY_HOPS_FOR = the same for X-Forwarded-For (client IP),
        # which can have more entries (CloudFront appends one too).
        default_hops = 1 if self.IS_PRODUCTION else 0
        self.TRUSTED_PROXY_HOPS = _env_int('TRUSTED_PROXY_HOPS', default_hops)
        self.TRUSTED_PROXY_HOPS_FOR = _env_int('TRUSTED_PROXY_HOPS_FOR', self.TRUSTED_PROXY_HOPS)
        # Strict-Transport-Security max-age in production (0 = do not send).
        self.HSTS_SECONDS = _env_int('HSTS_SECONDS', 31536000)


class DevelopmentConfig(Config):
    def __init__(self):
        super().__init__()
        # Off by default: echoing every SQL statement floods the terminal.
        # Turn it on with SQLALCHEMY_ECHO=1 in .env while debugging queries.
        self.SQLALCHEMY_ECHO = _env_flag('SQLALCHEMY_ECHO', False)


class TestingConfig(Config):
    TESTING = True
    # Tests post JSON without a CSRF header; CSRF itself is tested separately
    # by turning this back on.
    WTF_CSRF_ENABLED = False

    def __init__(self):
        super().__init__()
        self.SECRET_KEY = self.SECRET_KEY or 'test-only-secret-key'
        # In-memory SQLite unless TEST_DATABASE_URL points somewhere else.
        self.SQLALCHEMY_DATABASE_URI = normalize_db_url(
            os.environ.get('TEST_DATABASE_URL', 'sqlite://'))
        # Never call real map services from tests.
        self.GOOGLE_MAPS_SERVER_KEY = None


class ProductionConfig(Config):
    IS_PRODUCTION = True
    SESSION_COOKIE_SECURE = True
    REMEMBER_COOKIE_SECURE = True


config_by_name = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
}


def get_config(app_env=None):
    """A config object for `app_env` (default APP_ENV), read from the environment now."""
    app_env = app_env or get_app_env()
    if app_env not in config_by_name:
        raise RuntimeError(
            f"Unknown APP_ENV '{app_env}'. Use one of: {', '.join(config_by_name)}")
    config = config_by_name[app_env]()
    # Done after the class has picked its final database URL, so the password
    # and pool options match the database actually used.
    config.SQLALCHEMY_DATABASE_URI = with_password(
        config.SQLALCHEMY_DATABASE_URI, os.environ.get('DATABASE_PASSWORD'))
    config.SQLALCHEMY_ENGINE_OPTIONS = engine_options(config.SQLALCHEMY_DATABASE_URI)
    return config
