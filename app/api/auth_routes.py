from flask import Blueprint, jsonify, session, request
from app.models import User, db
import os
from app.forms import LoginForm
from app.forms import SignUpForm
from flask_login import current_user, login_user, logout_user, login_required
from app.s3_helpers import S3_LOCATION, UPLOAD_PREFIX

auth_routes = Blueprint('auth', __name__)


def validation_errors_to_error_messages(validation_errors):
    """
    Simple function that turns the WTForms validation errors into a simple list
    """
    errorMessages = []
    for field in validation_errors:
        for error in validation_errors[field]:
            errorMessages.append(f'{field} : {error}')
    return errorMessages


@auth_routes.route('/')
def authenticate():
    """
    Authenticates a user.
    """
    if current_user.is_authenticated:
        user_dict = current_user.to_dict()
        #getting list of friends
        friends = user_dict['friends']
        #query to exclude friends from user table
        non_friends = User.query.filter(User.username.notin_([dict(friend)['username'] for friend in friends])).all()
        #only allow users that are not the current user
        user_dict['nonFriends'] = [user.to_dict() for user in non_friends if user.id != current_user.id]
        user_dict['mapKey'] = os.environ.get('REACT_APP_NEXT_PUBLIC_GOOGLE_MAPS_API_KEY')
        return user_dict
    return {'errors': ['Unauthorized']}


@auth_routes.route('/login', methods=['POST'])
def login():
    """
    Logs a user in
    """
    form = LoginForm()
    if form.validate_on_submit():
        # Add the user to the session, we are logged in!
        user = User.query.filter(User.email == form.data['email']).first()
        login_user(user)
        user_dict = user.to_dict()
        #getting list of friends
        friends = user_dict['friends']
        #query to exclude friends from user table
        non_friends = User.query.filter(User.username.notin_([dict(friend)['username'] for friend in friends])).all()
        #only allow users that are not the current user
        user_dict['nonFriends'] = [user.to_dict() for user in non_friends if user.id != current_user.id]
        user_dict['mapKey'] = os.environ.get('REACT_APP_NEXT_PUBLIC_GOOGLE_MAPS_API_KEY')
        return user_dict
    return {'errors': validation_errors_to_error_messages(form.errors)}, 401


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
    # print('formData-------', form.data)
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
        # print('user------', user)
        db.session.add(user)
        db.session.commit()
        login_user(user)
        user_dict = user.to_dict()
        user_dict['mapKey'] = os.environ.get('REACT_APP_NEXT_PUBLIC_GOOGLE_MAPS_API_KEY')
        return user_dict
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
