from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField
from wtforms.validators import DataRequired, Email, Length, Optional, ValidationError
from app.models import User, db

# Keep in sync with the frontend hint on the sign-up page.
MIN_PASSWORD_LENGTH = 8


def user_exists(form, field):
    # Checking if user exists
    email = field.data
    user = db.session.scalar(db.select(User).where(User.email == email))
    if user:
        raise ValidationError('Email address is already in use.')


def username_exists(form, field):
    # Checking if username is already in use
    username = field.data
    user = db.session.scalar(db.select(User).where(User.username == username))
    if user:
        raise ValidationError('Username is already in use.')


# Max lengths match the column sizes in app/models/user.py, so a long value
# gets a clear validation error instead of a database error (500) on Postgres.
class SignUpForm(FlaskForm):
    username = StringField(
        'username', validators=[DataRequired(), Length(max=40), username_exists])
    email = StringField('email', validators=[DataRequired(), Length(max=255), Email(), user_exists])
    password = PasswordField('password', validators=[
        DataRequired(), Length(min=MIN_PASSWORD_LENGTH, max=255)])
    profile_picture = StringField('profile picture', validators=[Optional(), Length(max=255)])
    first_name = StringField('first name', validators=[DataRequired(), Length(max=100)])
    last_name = StringField('last name', validators=[DataRequired(), Length(max=100)])
