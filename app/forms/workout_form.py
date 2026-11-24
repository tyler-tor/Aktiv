from flask_wtf import FlaskForm
from wtforms import StringField
from wtforms.validators import DataRequired, Length, NumberRange
from .fields import SafeFloatField as FloatField, SafeIntegerField as IntegerField

# Max lengths match the column sizes in app/models/workout.py.
class CreateWorkoutForm(FlaskForm):
    title = StringField('title', validators=[DataRequired(), Length(max=30)])
    description = StringField('description', validators=[DataRequired(), Length(max=1000)])
    type = StringField('type', validators=[DataRequired(), Length(max=50)])
    # Seconds (up to 30 days) and metres (up to once around the Earth).
    duration_s = IntegerField('duration', validators=[DataRequired(), NumberRange(min=1, max=30 * 24 * 3600)])
    image_url = StringField('image', validators=[DataRequired(), Length(max=255)])
    distance_m = FloatField('distance', validators=[DataRequired(), NumberRange(min=1, max=40_000_000)])
