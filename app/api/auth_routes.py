from flask import Blueprint, jsonify, session, request
from sqlalchemy import func
from app.models import User, Route, Workout, db
from app.forms import LoginForm
from app.forms import SignUpForm
from flask_login import current_user, login_user, logout_user, login_required
from werkzeug.security import generate_password_hash, check_password_hash
from app.s3_helpers import S3_LOCATION, UPLOAD_PREFIX

auth_routes = Blueprint('auth', __name__)

# Used to equalize login timing for unknown emails (see login()).
_DUMMY_PASSWORD_HASH = generate_password_hash('not-a-real-password')


def validation_errors_to_error_messages(validation_errors):
    """
    Simple function that turns the WTForms validation errors into a simple list
    """
    errorMessages = []
    for field in validation_errors:
        for error in validation_errors[field]:
            errorMessages.append(f'{field} : {error}')
    return errorMessages


def session_payload(user):
    """
    What the frontend keeps in `state.session.user`: the user's own profile
    (with email), their friends, how many routes/workouts they have, and
    `nonFriends` = other users they could add (small summaries only, filtered
    in SQL instead of loading and serializing every user in Python).
    """
    data = user.to_dict(private=True)
    friend_ids = [friend['id'] for friend in data['friends']]
    non_friends = db.session.scalars(
        db.select(User)
        .where(User.id.not_in(friend_ids + [user.id]))
        .order_by(User.username)).all()
    data['nonFriends'] = [other.to_summary() for other in non_friends]
    data['routeCount'] = db.session.scalar(
        db.select(func.count(Route.id)).where(Route.user_id == user.id))
    data['workoutCount'] = db.session.scalar(
        db.select(func.count(Workout.id)).where(Workout.user_id == user.id))
    return data


@auth_routes.route('/')
def authenticate():
    """
    Authenticates a user.
    """
    if current_user.is_authenticated:
        return session_payload(current_user)
    return {'errors': ['Unauthorized']}


@auth_routes.route('/login', methods=['POST'])
def login():
    """
    Logs a user in
    """
    form = LoginForm()
    if not form.validate_on_submit():
        return {'errors': validation_errors_to_error_messages(form.errors)}, 401
    user = db.session.scalar(db.select(User).where(User.email == form.data['email']))
    if user is None:
        # Still run a password hash check so "unknown email" takes about as
        # long as "wrong password" (timing would otherwise reveal accounts).
        check_password_hash(_DUMMY_PASSWORD_HASH, form.data['password'])
    if user is None or not user.check_password(form.data['password']):
        # Same message for unknown email and wrong password.
        return {'errors': ['Invalid email or password']}, 401
    # Add the user to the session, we are logged in!
    login_user(user)
    return session_payload(user)


@auth_routes.route('/logout')
def logout():
    """
    Logs a user out
    """
    logout_user()
    return {'message': 'User logged out'}


@auth_routes.route('/signup', methods=['POST'])
def sign_up():
    """
    Creates a new user and logs them in
    """
    form = SignUpForm()
    if form.validate_on_submit():
        user = User(
            username=form.data['username'],
            email=form.data['email'],
            password=form.data['password'],
            first_name=form.data['first_name'],
            last_name=form.data['last_name']
        )
        # Only set a picture if one was given; otherwise the column default
        # (placeholder avatar) is used instead of an empty string.
        if form.data['profile_picture']:
            user.profile_picture = form.data['profile_picture']
        db.session.add(user)
        db.session.commit()
        login_user(user)
        return session_payload(user)
    return {'errors': validation_errors_to_error_messages(form.errors)}, 400


@auth_routes.route('/profile-picture', methods=['PUT'])
@login_required
def set_profile_picture():
    """
    Sets the current user's profile picture. Only accepts a URL that was
    returned by /api/img/upload (our bucket, uploads/ prefix). Used by the
    sign-up page, which uploads the picture right after the account exists
    (uploads require login).
    """
    data = request.get_json(silent=True) or {}
    url = data.get('profile_picture') or ''
    if not isinstance(url, str) or len(url) > 255 or not url.startswith(S3_LOCATION + UPLOAD_PREFIX):
        return {'errors': ['profile_picture must be an image uploaded through /api/img/upload']}, 400
    current_user.profile_picture = url
    db.session.commit()
    return {'profilePicture': url}


@auth_routes.route('/unauthorized')
def unauthorized():
    """
    Returns unauthorized JSON when flask-login authentication fails
    """
    return {'errors': ['Unauthorized']}, 401
