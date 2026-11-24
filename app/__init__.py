"""Aktiv Flask application.

Use the app factory: `create_app()` builds a new, fully configured app.
  * `flask ...` commands find it automatically (FLASK_APP=app in .flaskenv).
  * gunicorn uses `wsgi:app` (see wsgi.py and gunicorn.conf.py).
  * tests call `create_app('testing')` to get a fresh copy with test settings.
"""
import os

from flask import Flask, request, send_from_directory
from flask_wtf.csrf import CSRFError, generate_csrf
from sqlalchemy import text
from werkzeug.exceptions import HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix

from .config import get_app_env, get_config, check_secret_key
from .extensions import db, login, migrate, csrf
from .models import User
from .api.user_routes import user_routes
from .api.auth_routes import auth_routes
from .api.route_routes import route_routes
from .api.workout_routes import workout_routes
from .api.comments_routes import comment_routes
from .api.me_routes import me_routes
from .api.img_routes import img_routes
from .seeds import seed_commands
from .services.directions import directions_commands


def create_app(config_name=None):
    """
    Application factory: builds and returns a configured Flask app.

    config_name is 'development', 'testing' or 'production' (defaults to
    APP_ENV).
    """
    config_name = config_name or get_app_env()
    # static_folder=None: the React build is served by react_root() below
    # (only when SERVE_FRONTEND is on), so Flask's own /<path> static route
    # never answers a deep link such as /routes/3 with a 404.
    app = Flask(__name__, static_folder=None)
    app.config['FRONTEND_DIST'] = os.path.abspath(
        os.path.join(app.root_path, '..', 'react-app', 'dist'))

    app.config.from_object(get_config(config_name))
    check_secret_key(app.config.get('SECRET_KEY'), config_name)
    if not app.config.get('SQLALCHEMY_DATABASE_URI'):
        raise RuntimeError(
            'DATABASE_URL is not set. Add it to .env, e.g. DATABASE_URL=sqlite:///dev.db '
            '(local) or postgresql://aktiv@host:5432/aktiv plus DATABASE_PASSWORD')

    # Flask-SQLAlchemy 3 resolves a relative SQLite path (sqlite:///dev.db)
    # against the instance/ folder; 2.x used the app/ package folder. Keep the
    # old location so an existing app/dev.db is still found.
    uri = app.config['SQLALCHEMY_DATABASE_URI']
    if uri.startswith('sqlite:///') and not uri.startswith('sqlite:////'):
        path = uri[len('sqlite:///'):]
        if path and path != ':memory:' and not os.path.isabs(path):
            app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(app.root_path, path)

    # Behind CloudFront + Caddy, trust their X-Forwarded-* headers so
    # request.scheme is "https", request.host is the public site name and
    # request.remote_addr is the visitor. Flask-WTF's CSRF check compares the
    # Referer with https://<request.host>/ on HTTPS requests, so without this
    # every POST over HTTPS would fail with "The referrer does not match the
    # host". Off unless TRUSTED_PROXY_HOPS / _FOR are set (1 by default in
    # production, 0 elsewhere).
    hops = app.config['TRUSTED_PROXY_HOPS']
    for_hops = app.config['TRUSTED_PROXY_HOPS_FOR']
    if hops or for_hops:
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=for_hops, x_proto=hops, x_host=hops)

    # Extensions
    db.init_app(app)
    migrate.init_app(app, db)
    login.init_app(app)
    csrf.init_app(app)

    # Tell flask about our seed commands (`flask seed all`, `flask seed undo`)
    app.cli.add_command(seed_commands)
    app.cli.add_command(directions_commands)

    # API blueprints
    app.register_blueprint(user_routes, url_prefix='/api/users')
    app.register_blueprint(auth_routes, url_prefix='/api/auth')
    app.register_blueprint(route_routes, url_prefix='/api/routes')
    app.register_blueprint(workout_routes, url_prefix='/api/workouts')
    app.register_blueprint(comment_routes, url_prefix='/api/comments')
    app.register_blueprint(img_routes, url_prefix='/api/img')
    app.register_blueprint(me_routes, url_prefix='/api/me')

    register_hooks(app)
    register_app_routes(app)
    register_error_handlers(app)
    # The React build is only served when SERVE_FRONTEND is on (local
    # development). In production the app is API-only: CloudFront serves the
    # site from S3 and sends only /api/* here, so any other path is a 404.
    if app.config['SERVE_FRONTEND']:
        register_frontend_routes(app)
    return app


@login.user_loader
def load_user(id):
    return db.session.get(User, int(id))


# No CORS: the React app is always served from the same origin as the API
# (CloudFront sends /api/* to this app in production; the Vite dev server
# proxies /api to Flask in development), so browsers never make cross-origin
# API calls.


def register_hooks(app):
    @app.after_request
    def inject_csrf_token(response):
        # Health checks run every few seconds from Docker/monitoring and need
        # no session, so they get no cookies (and no session work).
        if request.path.startswith('/api/health'):
            return response
        response.set_cookie(
            'csrf_token',
            generate_csrf(),
            secure=app.config['SESSION_COOKIE_SECURE'],
            samesite='Lax',
            # Must be readable by JavaScript so the frontend can copy it into the
            # X-CSRFToken header. (The session cookie itself stays httponly.)
            httponly=False)
        return response

    @app.after_request
    def cache_headers(response):
        # API answers are per-user data: never let a browser or CDN keep them.
        if request.path.startswith('/api/'):
            response.headers.setdefault('Cache-Control', 'no-store')
        return response

    @app.after_request
    def security_headers(response):
        # The React site's own headers (its Content-Security-Policy etc.) are
        # set by CloudFront, which serves it from S3; these cover what Flask
        # answers, mostly JSON.
        headers = response.headers
        headers.setdefault('X-Content-Type-Options', 'nosniff')
        # Full URL to our own origin (Flask-WTF checks it on HTTPS), only the
        # origin to other sites. Never "no-referrer": that breaks CSRF checks.
        headers.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
        headers.setdefault('X-Frame-Options', 'DENY')
        if request.path.startswith('/api/'):
            # JSON never needs to load anything or be framed.
            headers.setdefault('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
            headers.setdefault('Cross-Origin-Resource-Policy', 'same-origin')
        if app.config['IS_PRODUCTION'] and app.config['HSTS_SECONDS']:
            headers.setdefault('Strict-Transport-Security', f"max-age={app.config['HSTS_SECONDS']}")
        return response


def register_app_routes(app):
    @app.route('/api/health')
    def health():
        """
        Liveness check for Docker / Caddy / CloudFront: the process answers.
        No login, no database, no cookies, so a database hiccup never makes
        Docker restart a healthy container.
        """
        return {'status': 'ok'}

    @app.route('/api/health/db')
    def health_db():
        """
        Readiness check: one trivial query. For monitoring and deploy
        scripts, not for the Docker HEALTHCHECK.
        """
        try:
            db.session.execute(text('SELECT 1'))
        except Exception:
            app.logger.exception('Database health check failed')
            db.session.rollback()
            return {'status': 'error', 'database': 'unreachable'}, 503
        return {'status': 'ok', 'database': 'ok'}

    @app.route("/api/docs")
    def api_help():
        """
        Returns all API routes and their doc strings
        """
        if not app.config['ENABLE_API_DOCS']:
            return {'errors': ['Not found']}, 404
        acceptable_methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
        route_list = { rule.rule: [[ method for method in rule.methods if method in acceptable_methods ],
                        app.view_functions[rule.endpoint].__doc__ ]
                        for rule in app.url_map.iter_rules() if rule.endpoint != 'static' }
        return route_list


def register_frontend_routes(app):
    """Serve react-app/dist: real files as-is, every other URL gets index.html."""

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def react_root(path):
        # Unknown /api/... URLs are real JSON 404s, not the React page.
        if path.startswith('api/') or path == 'api':
            return {'errors': ['Not found']}, 404
        dist = app.config['FRONTEND_DIST']
        # Real files from the build (assets/*.js, favicon, images) are sent
        # as-is; send_from_directory refuses paths that try to leave the folder.
        if path and os.path.isfile(os.path.join(dist, path)):
            # assets/ files have a content hash in their name (index-3f9a2c.js),
            # so they can be cached for a year; other files for an hour.
            if path.startswith('assets/'):
                response = send_from_directory(dist, path, max_age=31536000)
                response.headers['Cache-Control'] = 'public, max-age=31536000, immutable'
                return response
            return send_from_directory(dist, path, max_age=3600)
        # A missing *file* (an old /assets/index-abc123.js) is a real 404;
        # serving index.html there would confuse the browser.
        if '.' in path.rsplit('/', 1)[-1]:
            return {'errors': ['Not found']}, 404
        index = os.path.join(dist, 'index.html')
        if not os.path.isfile(index):
            return {'errors': ['The React build is missing: run `npm run build` in react-app/, '
                               'or use the Vite dev server (npm run dev).']}, 404
        # Every other URL (/, /routes/3, /no-such-page) gets index.html and
        # React Router decides what to show. no-cache = always re-check, so a
        # new deploy is picked up at once.
        response = send_from_directory(dist, 'index.html', max_age=0)
        response.headers['Cache-Control'] = 'no-cache'
        return response


def register_error_handlers(app):
    @app.errorhandler(CSRFError)
    def handle_csrf_error(e):
        return {'errors': ['CSRF token missing or invalid. Refresh the page and try again.']}, 400

    @app.errorhandler(413)
    def request_too_large(e):
        max_mb = app.config['MAX_CONTENT_LENGTH'] // (1024 * 1024)
        return {'errors': f'File is too large (max {max_mb} MB)'}, 413

    @app.errorhandler(HTTPException)
    def http_error(e):
        # Every other HTTP error (404 unknown URL, 405 wrong method, ...) is
        # JSON, so the frontend always gets something it can parse.
        return {'errors': [e.description or e.name]}, e.code
