from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from sqlalchemy.orm import joinedload
from app.models import Comment, db
from ..forms.comment_form import CreateCommentForm
from .pagination import PaginationError, get_limit, paginate

comment_routes = Blueprint('comments', __name__)


def validation_errors_to_error_messages(validation_errors):
    """
    Simple function that turns the WTForms validation errors into a simple list
    """
    errorMessages = []
    for field in validation_errors:
        for error in validation_errors[field]:
            errorMessages.append(f'{field} : {error}')
    return errorMessages


# get all comments
@comment_routes.route('/')
@login_required
def all_comments():
    """
    Returns comments as a list of comment dictionaries.

    Without parameters: every comment, ordered by id. `?limit=20&cursor=...`:
    one page, newest first, with `nextCursor` (null on the last page).
    """
    try:
        limit = get_limit(request.args)
        comments, next_cursor = paginate(
            db.session, db.select(Comment).options(joinedload(Comment.users)),
            Comment, limit, request.args.get('cursor'))
    except PaginationError as error:
        return {'errors': [str(error)]}, 400
    return {'comments': [comment.to_dict() for comment in comments], 'nextCursor': next_cursor}


def comment_not_found():
    return {'errors': ['Comment not found']}, 404


# get information about a specific comment
@comment_routes.route('/<int:id>')
@login_required
def one_comment(id):
    """
    Returns one comment by id (404 if it does not exist)
    """
    comment = db.session.get(Comment, id)
    if comment is None:
        return comment_not_found()
    return comment.to_dict()


# update a specific comment
@comment_routes.route('/<int:id>', methods=['PUT'])
@login_required
def update_comment(id):
    """
    Updates one of the current user's comments (404 missing, 403 not yours)
    """
    comment = db.session.get(Comment, id)
    if comment is None:
        return comment_not_found()
    if comment.user_id != current_user.id:
        return {'errors': ['This comment does not belong to you!']}, 403
    form = CreateCommentForm()
    if form.validate_on_submit():
        comment.body = form.data['body']
        db.session.commit()
        return comment.to_dict()
    return {'errors': validation_errors_to_error_messages(form.errors)}, 400


# delete a specific comment
@comment_routes.route('/<int:id>', methods=['DELETE'])
@login_required
def delete_comment(id):
    """
    Deletes one of the current user's comments (404 missing, 403 not yours)
    """
    comment = db.session.get(Comment, id)
    if comment is None:
        return comment_not_found()
    if comment.user_id != current_user.id:
        return {'errors': ['This comment does not belong to you!']}, 403
    db.session.delete(comment)
    db.session.commit()
    return {'message': 'Success'}
