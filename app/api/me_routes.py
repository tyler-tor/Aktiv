from flask import Blueprint
from flask_login import login_required, current_user
from sqlalchemy.orm import joinedload
from app.models import Route, Workout, db
from app.models.user import follows

me_routes = Blueprint('me', __name__)


@me_routes.route('/friends/activity')
@login_required
def friend_activity():
    """
    Routes and workouts of the current user's friends, newest first.

    Two queries in total (routes, workouts) with `user_id IN (friend ids)`,
    plus one for the friend ids. It used to run two queries per friend in a
    Python loop (and one more per route/workout for its owner).
    """
    friend_ids = _friend_ids(current_user.id)
    routes = db.session.scalars(
        db.select(Route).where(Route.user_id.in_(friend_ids))
        .options(joinedload(Route.users))
        .order_by(Route.created_at.desc(), Route.id.desc())).all()
    workouts = db.session.scalars(
        db.select(Workout).where(Workout.user_id.in_(friend_ids))
        .options(joinedload(Workout.users))
        .order_by(Workout.created_at.desc(), Workout.id.desc())).all()
    return {'routes': [route.to_dict() for route in routes],
            'workouts': [workout.to_dict() for workout in workouts]}


def _friend_ids(user_id):
    """
    Ids of `user_id`'s friends (one query). `user.followers` is the set of users
    X with a row (follower_id=X, followed_id=user), so friends are read from
    follower_id where followed_id is the user.
    """
    return db.session.scalars(
        db.select(follows.c.follower_id).where(follows.c.followed_id == user_id)).all()
