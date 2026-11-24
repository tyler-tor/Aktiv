from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from sqlalchemy.orm import joinedload
from app.models import Workout, Comment, db
from ..forms.workout_form import CreateWorkoutForm
from ..forms.comment_form import CreateCommentForm
from .pagination import PaginationError, get_limit, paginate


workout_routes = Blueprint('workouts', __name__)


def validation_errors_to_error_messages(validation_errors):
    """
    Simple function that turns the WTForms validation errors into a simple list
    """
    errorMessages = []
    for field in validation_errors:
        for error in validation_errors[field]:
            errorMessages.append(f'{field} : {error}')
    return errorMessages


def workout_not_found():
    return {'errors': ['Workout not found']}, 404


# get all workouts
@workout_routes.route('/')
@login_required
def all_workouts():
    """
    Returns workouts as a list of workout dictionaries.

    Without parameters: every workout, ordered by id. `?limit=20&cursor=...`:
    one page, newest first, with `nextCursor` (null on the last page).
    """
    try:
        limit = get_limit(request.args)
        workouts, next_cursor = paginate(
            db.session, db.select(Workout).options(joinedload(Workout.users)),
            Workout, limit, request.args.get('cursor'))
    except PaginationError as error:
        return {'errors': [str(error)]}, 400
    return {'workouts': [workout.to_dict() for workout in workouts], 'nextCursor': next_cursor}


# add a new workout
@workout_routes.route('/', methods=['POST'])
@login_required
def add_workout():
    """
    Creates a workout owned by the current user and returns it
    """
    form = CreateWorkoutForm()

    if form.validate_on_submit():
        workout = Workout(
            user_id=current_user.id,
            title=form.data['title'],
            description=form.data['description'],
            type=form.data['type'],
            total_time=form.data['total_time'],
            image_url=form.data['image_url'],
            distance=form.data['distance']
        )
        db.session.add(workout)
        db.session.commit()
        # Return the object we just created, not "the newest row in the table"
        # (which could belong to another user posting at the same moment).
        return workout.to_dict()
    return {'errors': validation_errors_to_error_messages(form.errors)}, 400


# get information about a specific workout
@workout_routes.route('/<int:id>')
@login_required
def one_workout(id):
    """
    Returns one workout by id (404 if it does not exist)
    """
    workout = db.session.get(Workout, id, options=[joinedload(Workout.users)])
    if workout is None:
        return workout_not_found()
    return workout.to_dict()


# update a specific workout
@workout_routes.route('/<int:id>', methods=['PUT'])
@login_required
def update_workout(id):
    """
    Updates one of the current user's workouts (404 missing, 403 not yours)
    """
    workout = db.session.get(Workout, id)
    if workout is None:
        return workout_not_found()
    if workout.user_id != current_user.id:
        return {'errors': ['You can only edit your own workouts']}, 403
    form = CreateWorkoutForm()
    if form.validate_on_submit():
        workout.set_kwargs(**{field: form.data[field] for field in Workout.EDITABLE_FIELDS})
        db.session.commit()
        return workout.to_dict()
    return {'errors': validation_errors_to_error_messages(form.errors)}, 400


# delete a specific workout
@workout_routes.route('/<int:id>', methods=['DELETE'])
@login_required
def delete_workout(id):
    """
    Deletes one of the current user's workouts (404 missing, 403 not yours)
    """
    workout = db.session.get(Workout, id)
    if workout is None:
        return workout_not_found()
    if workout.user_id != current_user.id:
        return {'errors': ['You can only delete your own workouts']}, 403
    db.session.delete(workout)
    db.session.commit()
    return {'message': 'Success'}


# add a comment to a specific workout
@workout_routes.route('/<int:id>/comments', methods=['POST'])
@login_required
def add_comment_to_workout(id):
    """
    Adds a comment by the current user to a workout (404 if it does not exist)
    """
    workout = db.session.get(Workout, id)
    if workout is None:
        return workout_not_found()
    form = CreateCommentForm()

    if form.validate_on_submit():
        comment = Comment(
            user_id=current_user.id,
            body=form.data['body'],
            workout_id=workout.id
        )
        db.session.add(comment)
        db.session.commit()
        return comment.to_dict()
    return {'errors': validation_errors_to_error_messages(form.errors)}, 400
