from flask import Blueprint, jsonify
from flask_login import login_required, current_user
from app.models import User, Route, Workout, Comment, db

user_routes = Blueprint('users', __name__)


# get all users
@user_routes.route('/')
@login_required
def users():

    users = db.session.scalars(db.select(User).order_by(User.username)).all()
    return {'users': [user.to_summary() for user in users]}


# get info on a specific user
@user_routes.route('/<int:id>')
@login_required
def user(id):
    user = db.session.get(User, id)
    if user:
        return user.to_dict(include_activity=True)
    return {'errors': ['This user does not exist!']}, 404


# get routes from a selected user
@user_routes.route('/<int:id>/routes')
@login_required
def user_route(id):
    user = db.session.get(User, id)
    if user:
        routes = [route.to_dict() for route in db.session.scalars(
            db.select(Route).where(Route.user_id == user.id).order_by(Route.id)).all()]
        return {'routes': routes}
    return {'errors': ['This user does not exist!']}, 404


# get comments from a selected user
@user_routes.route('/<int:id>/comments')
@login_required
def user_comments(id):
    user = db.session.get(User, id)
    if user:
        comments = [comment.to_dict() for comment in db.session.scalars(
            db.select(Comment).where(Comment.user_id == user.id).order_by(Comment.id)).all()]
        return {'comments': comments}
    return {'errors': ['This user does not exist!']}, 404


# get workouts from a selected user
@user_routes.route('/<int:id>/workouts')
@login_required
def user_workouts(id):
    user = db.session.get(User, id)
    if user:
        workouts = [workout.to_dict() for workout in db.session.scalars(
            db.select(Workout).where(Workout.user_id == user.id).order_by(Workout.id)).all()]
        return {'workouts': workouts}
    return {'errors': ['This user does not exist!']}, 404


# get friends of selected user
@user_routes.route('/<int:id>/friends')
@login_required
def user_friends(id):
    user = db.session.get(User, id)
    if user:
        return {'friends': [friend.to_friend() for friend in user.followers]}
    return {'errors': ['This user does not exist!']}, 404


def _is_follower(user, other):
    """True if `other` is in `user`'s followers ("friends") list."""
    return user.followers.filter(User.id == other.id).first() is not None


# adding friend to current user friends list
@user_routes.route('/<int:id>/friends', methods=['POST'])
@login_required
def add_user_friends(id):
    curr_user = db.session.get(User, current_user.id)
    user = db.session.get(User, id)
    if user is None:
        return {'errors': ['This user does not exist!']}, 404
    if user.id == curr_user.id:
        return {'errors': ['You cannot add yourself as a friend!']}, 400
    if _is_follower(curr_user, user):
        return {'errors': ['This user is already your friend!']}, 409

    # A friendship is stored as two rows in `follows` (one per direction).
    # Only add the directions that are missing, so a half-existing friendship
    # (possible in old seed data) does not hit the unique constraint.
    curr_user.followers.append(user)
    if not _is_follower(user, curr_user):
        user.followers.append(curr_user)
    db.session.commit()
    return {'friend': user.to_summary(), 'currUser': curr_user.to_dict(private=True)}


# unfriending a user
@user_routes.route('/<int:id>/friends', methods=['DELETE'])
@login_required
def unfriend_user(id):
    curr_user = db.session.get(User, current_user.id)
    user = db.session.get(User, id)
    if user is None:
        return {'errors': ['This user does not exist!']}, 404
    if not _is_follower(curr_user, user):
        return {'errors': ['user is not a friend of current user!']}, 404

    curr_user.followers.remove(user)
    if _is_follower(user, curr_user):
        user.followers.remove(curr_user)
    db.session.commit()
    return {'unFriended': user.to_summary(), 'currUser': [friend.to_friend() for friend in curr_user.followers]}
