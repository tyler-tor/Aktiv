from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from sqlalchemy.orm import joinedload
from app.models import Comment, Route, db
from ..forms.route_form import CreateRouteForm
from ..forms.comment_form import CreateCommentForm
from .pagination import PaginationError, get_limit, paginate

route_routes = Blueprint('routes', __name__)


def validation_errors_to_error_messages(validation_errors):
    """
    Simple function that turns the WTForms validation errors into a simple list
    """
    errorMessages = []
    for field in validation_errors:
        for error in validation_errors[field]:
            errorMessages.append(f'{field} : {error}')
    return errorMessages


def route_not_found():
    return {'errors': ['Route not found']}, 404


# get all routes
@route_routes.route('/')
@login_required
def all_routes():
    """
    Returns routes as a list of route dictionaries.

    Without parameters: every route (the home map needs them all), ordered by id.
    `?limit=20&cursor=...`: one page, newest first; `nextCursor` in the answer
    is the cursor for the next page (null on the last page).
    """
    try:
        limit = get_limit(request.args)
        # joinedload: the owner is fetched in the same query (no query per route)
        routes, next_cursor = paginate(
            db.session, db.select(Route).options(joinedload(Route.users)),
            Route, limit, request.args.get('cursor'))
    except PaginationError as error:
        return {'errors': [str(error)]}, 400
    return {'routes': [route.to_dict() for route in routes], 'nextCursor': next_cursor}


# add a new route
@route_routes.route('/', methods=['POST'])
@login_required
def add_route():
    """
    Creates a route owned by the current user and returns it
    """
    form = CreateRouteForm()

    if form.validate_on_submit():
        route = Route(
            user_id=current_user.id,
            title=form.data['title'],
            description=form.data['description'],
            image_url=form.data['image_url'],
            start_lat=form.data['start_lat'],
            start_lng=form.data['start_lng'],
            end_lat=form.data['end_lat'],
            end_lng=form.data['end_lng'],
            distance=form.data['distance'],
            traveling_mode=form.data['traveling_mode']
        )
        db.session.add(route)
        db.session.commit()
        # Return the object we just created (it has its id after commit).
        # The old code returned "the newest row in the table", which could be
        # another user's route if two people posted at the same time.
        return route.to_dict()
    return {'errors': validation_errors_to_error_messages(form.errors)}, 400


# get information on a selected route
@route_routes.route('/<int:id>')
@login_required
def one_route(id):
    """
    Returns one route by id (404 if it does not exist)
    """
    route = db.session.get(Route, id, options=[joinedload(Route.users)])
    if route is None:
        return route_not_found()
    return route.to_dict()


# update a specific route
@route_routes.route('/<int:id>', methods=['PUT'])
@login_required
def update_route(id):
    """
    Updates one of the current user's routes (404 missing, 403 not yours)
    """
    route = db.session.get(Route, id)
    if route is None:
        return route_not_found()
    if route.user_id != current_user.id:
        return {'errors': ['You can only edit your own routes']}, 403
    form = CreateRouteForm()
    if form.validate_on_submit():
        route.set_kwargs(**{field: form.data[field] for field in Route.EDITABLE_FIELDS})
        db.session.commit()
        return route.to_dict()
    return {'errors': validation_errors_to_error_messages(form.errors)}, 400


# delete a specific route
@route_routes.route('/<int:id>', methods=['DELETE'])
@login_required
def delete_route(id):
    """
    Deletes one of the current user's routes (404 missing, 403 not yours)
    """
    route = db.session.get(Route, id)
    if route is None:
        return route_not_found()
    if route.user_id != current_user.id:
        return {'errors': ['You can only delete your own routes']}, 403
    db.session.delete(route)
    db.session.commit()
    return {'message': 'Success'}


#get all comments on a route
@route_routes.route('/<int:id>/comments')
@login_required
def get_comments_to_route(id):
    """
    Returns all comments on a route (404 if the route does not exist)
    """
    route = db.session.get(Route, id)
    if route is None:
        return route_not_found()
    comments = db.session.scalars(
        db.select(Comment)
        .where(Comment.route_id == route.id)
        .options(joinedload(Comment.users))
        .order_by(Comment.id)).all()
    return {'comments': [comment.to_dict() for comment in comments]}


# add a comment to a route
@route_routes.route('/<int:id>/comments', methods=['POST'])
@login_required
def add_comment_to_route(id):
    """
    Adds a comment by the current user to a route (404 if the route does not exist)
    """
    route = db.session.get(Route, id)
    if route is None:
        return route_not_found()
    form = CreateCommentForm()

    if form.validate_on_submit():
        comment = Comment(
            user_id=current_user.id,
            body=form.data['body'],
            route_id=route.id
        )
        db.session.add(comment)
        db.session.commit()
        return comment.to_dict()
    return {'errors': validation_errors_to_error_messages(form.errors)}, 400
