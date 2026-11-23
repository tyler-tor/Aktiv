from flask_wtf import FlaskForm
from wtforms import StringField
from wtforms.validators import DataRequired, Length


class CreateCommentForm(FlaskForm):
    # comments.body is String(255)
    body = StringField('body', validators=[DataRequired(), Length(max=255)])
