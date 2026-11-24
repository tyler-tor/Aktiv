from flask import Blueprint, jsonify, session, request
from app.models import User,Route, Workout, db
from flask_login import current_user, login_user, logout_user, login_required

me_routes = Blueprint('me', __name__)


@me_routes.route('/friends/activity')
@login_required
def friend_activity():
    user = db.session.get(User, current_user.id)

    if user:
        friends = [friend.to_friend() for friend in user.followers]
        act_dict = {}
        route_list = []
        workout_list = []

        for i in range(len(friends)):
            routes = db.session.scalars(db.select(Route).where(Route.user_id == friends[i]['userId']).order_by(Route.created_at.desc())).all()
            workouts = db.session.scalars(db.select(Workout).where(Workout.user_id == friends[i]['userId']).order_by(Workout.created_at.desc())).all()
            [workout_list.append(workout.to_dict()) for workout in workouts]
            [route_list.append(route.to_dict()) for route in routes]
        act_dict = {'routes': route_list, 'workouts': workout_list}
        return act_dict
    return {'errors': 'This user does not exist!'}
