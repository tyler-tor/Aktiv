from flask_wtf import FlaskForm
from wtforms import StringField, FloatField
from wtforms.validators import DataRequired, Length

# Max lengths match the column sizes in app/models/route.py (e.g. title is
# String(30)); without them a long title is a 500 error on Postgres.
class CreateRouteForm(FlaskForm):
    title = StringField('title', validators=[DataRequired(), Length(max=30)])
    description = StringField('description', validators=[DataRequired(), Length(max=1000)])
    start_lat = FloatField('starting lat', validators=[DataRequired()])
    start_lng = FloatField('starting lng', validators=[DataRequired()])
    end_lat = FloatField('ending lat', validators=[DataRequired()])
    end_lng = FloatField('ending lng', validators=[DataRequired()])
    traveling_mode = StringField('travel mode', validators=[DataRequired(), Length(max=50)])
    distance = StringField('distance', validators=[DataRequired(), Length(max=500)])
    image_url = StringField('image', validators=[DataRequired(), Length(max=255)])
