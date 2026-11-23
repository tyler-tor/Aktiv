from flask_wtf import FlaskForm
from wtforms import StringField
from wtforms.validators import DataRequired, Length

# Max lengths match the column sizes in app/models/workout.py.
class CreateWorkoutForm(FlaskForm):
    title = StringField('title', validators=[DataRequired(), Length(max=30)])
    description = StringField('description', validators=[DataRequired(), Length(max=1000)])
    type = StringField('type', validators=[DataRequired(), Length(max=50)])
    total_time = StringField('total time', validators=[DataRequired(), Length(max=100)])
    image_url = StringField('image', validators=[DataRequired(), Length(max=255)])
    distance = StringField('distance', validators=[DataRequired(), Length(max=500)])
