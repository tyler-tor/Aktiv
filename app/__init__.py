from flask import Flask
from flask_wtf.csrf import CSRFError, generate_csrf

from .config import APP_ENV, get_config, check_secret_key
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


def create_app(config_name=None):
    """
    Application factory: builds and returns a configured Flask app.

    config_name is 'development', 'testing' or 'production' (defaults to
    APP_ENV). `flask run` / `flask db ...` find this function automatically
    (FLASK_APP=app); gunicorn uses `gunicorn "app:create_app()"`.
    """
    config_name = config_name or APP_ENV
    app = Flask(__name__, static_folder='../react-app/build', static_url_path='/')

    app.config.from_object(get_config(config_name))
    check_secret_key(app.config.get('SECRET_KEY'), config_name)
    if not app.config.get('SQLALCHEMY_DATABASE_URI'):
        raise RuntimeError(
            'DATABASE_URL is not set. Add it to .env, e.g. DATABASE_URL=sqlite:///dev.db '
            '(local) or postgresql://user:password@host:5432/dbname')

    # Extensions
    db.init_app(app)
    migrate.init_app(app, db)
    login.init_app(app)
    csrf.init_app(app)

    # Tell flask about our seed commands (`flask seed all`, `flask seed undo`)
    app.cli.add_command(seed_commands)

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
    return app


@login.user_loader
def load_user(id):
    return User.query.get(int(id))


# No CORS: the React app is always served from the same origin as the API
# (Flask serves the build in production; the CRA dev server proxies /api to
# Flask in development), so browsers never make cross-origin API calls.

# (The Heroku-era https_redirect hook was removed: HTTPS redirects are done
# by the proxy in front of the app - Render/CloudFront/Caddy.)


def register_hooks(app):
    @app.after_request
    def inject_csrf_token(response):
        response.set_cookie(
            'csrf_token',
            generate_csrf(),
            secure=app.config['SESSION_COOKIE_SECURE'],
            samesite='Lax',
            # Must be readable by JavaScript so the frontend can copy it into the
            # X-CSRFToken header. (The session cookie itself stays httponly.)
            httponly=False)
        return response


def register_app_routes(app):
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

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def react_root(path):
        """
        This route will direct to the public directory in our
        react builds in the production environment for favicon
        or index.html requests
        """
        if path == 'favicon.ico':
            return app.send_from_directory('public', 'favicon.ico')
        return app.send_static_file('index.html')


def register_error_handlers(app):
    @app.errorhandler(CSRFError)
    def handle_csrf_error(e):
        return {'errors': ['CSRF token missing or invalid. Refresh the page and try again.']}, 400

    @app.errorhandler(413)
    def request_too_large(e):
        max_mb = app.config['MAX_CONTENT_LENGTH'] // (1024 * 1024)
        return {'errors': f'File is too large (max {max_mb} MB)'}, 413

    @app.errorhandler(404)
    def not_found(e):
        return app.send_static_file('index.html')
