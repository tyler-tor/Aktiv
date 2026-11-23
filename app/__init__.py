import os
from flask import Flask, render_template, request, session, redirect
from flask_migrate import Migrate
from flask_wtf.csrf import CSRFProtect, CSRFError, generate_csrf
from flask_login import LoginManager
from .models import db, User
from .api.user_routes import user_routes
from .api.auth_routes import auth_routes
from .api.route_routes import route_routes
from .api.workout_routes import workout_routes
from .api.comments_routes import comment_routes
from .api.me_routes import me_routes
from .api.img_routes import img_routes
from .seeds import seed_commands
from .config import APP_ENV, get_config, check_secret_key
from app.models.db import db, environment, SCHEMA

app = Flask(__name__, static_folder='../react-app/build', static_url_path='/')

# Setup login manager
login = LoginManager(app)
login.login_view = 'auth.unauthorized'


@login.user_loader
def load_user(id):
    return User.query.get(int(id))


# Tell flask about our seed commands
app.cli.add_command(seed_commands)

app.config.from_object(get_config(APP_ENV))
check_secret_key(app.config.get('SECRET_KEY'), APP_ENV)
if not app.config.get('SQLALCHEMY_DATABASE_URI'):
    raise RuntimeError(
        'DATABASE_URL is not set. Add it to .env, e.g. DATABASE_URL=sqlite:///dev.db '
        '(local) or postgresql://user:password@host:5432/dbname')
app.register_blueprint(user_routes, url_prefix='/api/users')
app.register_blueprint(auth_routes, url_prefix='/api/auth')
app.register_blueprint(route_routes, url_prefix='/api/routes')
app.register_blueprint(workout_routes, url_prefix='/api/workouts')
app.register_blueprint(comment_routes, url_prefix='/api/comments')
app.register_blueprint(img_routes, url_prefix='/api/img')
app.register_blueprint(me_routes, url_prefix='/api/me')
db.init_app(app)
Migrate(app, db)

# CSRF protection for every POST/PUT/PATCH/DELETE request. The React app reads
# the (non-httponly) csrf_token cookie and sends it back in the X-CSRFToken
# header; Flask-WTF compares it with the token stored in the signed session.
# A malicious site can make the browser send cookies, but cannot read them,
# so it cannot set the header.
csrf = CSRFProtect(app)


@app.errorhandler(CSRFError)
def handle_csrf_error(e):
    return {'errors': ['CSRF token missing or invalid. Refresh the page and try again.']}, 400

# No CORS: the React app is always served from the same origin as the API
# (Flask serves the build in production; the CRA dev server proxies /api to
# Flask in development), so browsers never make cross-origin API calls.


# (The Heroku-era https_redirect hook was removed: HTTPS redirects are done
# by the proxy in front of the app - Render/CloudFront/Caddy.)


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



@app.errorhandler(413)
def request_too_large(e):
    max_mb = app.config['MAX_CONTENT_LENGTH'] // (1024 * 1024)
    return {'errors': f'File is too large (max {max_mb} MB)'}, 413


@app.errorhandler(404)
def not_found(e):
  return app.send_static_file('index.html')
