"""
Flask extensions, created once here *without* an app.

`create_app()` in app/__init__.py binds them to an app with `init_app(app)`.
Keeping them here (instead of creating them next to `app = Flask(...)`) means
any module can import them without importing the app itself, and tests can
build several independent apps (for example one per test database).

The SQLAlchemy object `db` lives in app/models/db.py because the models
import it; it is re-exported here so everything can be found in one place.
"""
from flask_login import LoginManager
from flask_migrate import Migrate
from flask_wtf.csrf import CSRFProtect

from .models.db import db

login = LoginManager()
# Where @login_required sends anonymous users (returns a JSON 401).
login.login_view = 'auth.unauthorized'

migrate = Migrate()

# CSRF protection for every POST/PUT/PATCH/DELETE request. The React app reads
# the (non-httponly) csrf_token cookie and sends it back in the X-CSRFToken
# header; Flask-WTF compares it with the token stored in the signed session.
# A malicious site can make the browser send cookies, but cannot read them,
# so it cannot set the header.
csrf = CSRFProtect()

__all__ = ['db', 'login', 'migrate', 'csrf']
