from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField
from wtforms.validators import DataRequired, Length


# The email/password check itself happens in the login view (auth_routes.py)
# so that a wrong email and a wrong password return the *same* message.
# Telling them apart lets anyone find out which emails have accounts.
class LoginForm(FlaskForm):
    email = StringField('email', validators=[DataRequired(), Length(max=255)])
    password = PasswordField('password', validators=[DataRequired(), Length(max=255)])
