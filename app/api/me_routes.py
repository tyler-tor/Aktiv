from flask import Blueprint, request
from flask_login import login_required, current_user
from sqlalchemy import and_, false, or_, true
from sqlalchemy.orm import joinedload
from app.models import Route, Workout, db
from app.models.user import follows
from .pagination import PaginationError, decode_cursor, encode_cursor, get_limit

me_routes = Blueprint('me', __name__)

FEED_DEFAULT_LIMIT = 20
FEED_MAX_LIMIT = 50
# When a route and a workout have the same created_at, routes come first
# (newest first). The rank is part of the cursor so pages never repeat an item.
RANKS = {'route': 1, 'workout': 0}


def _friend_ids(user_id):
    """
    Ids of `user_id`'s friends (one query). `user.followers` is the set of
    users X with a row (follower_id=X, followed_id=user), so friends are read
    from follower_id where followed_id is the user.
    """
    return db.session.scalars(
        db.select(follows.c.follower_id).where(follows.c.followed_id == user_id)).all()


def _after_cursor(model, rank, cursor):
    """WHERE clause for "after the cursor item" in (created_at, rank, id) desc order."""
    created_at, cursor_rank, cursor_id = cursor
    if rank == cursor_rank:
        tie = model.id < cursor_id
    else:
        tie = true() if rank < cursor_rank else false()
    return or_(model.created_at < created_at, and_(model.created_at == created_at, tie))


@me_routes.route('/friends/activity')
@login_required
def friend_activity():
    """
    The activity feed: routes and workouts mixed, newest first.

    `?scope=friends` (default) = your friends' posts, `?scope=all` = everyone's.
    `?limit=` (default 20, max 50) and `?cursor=` page through it; the answer is
    `{items: [{kind: 'route' | 'workout', ...}], nextCursor}`.

    Per page: one query for the friend ids, one for routes, one for workouts
    (`user_id IN (...)` with the owner joined in), however many friends there are.
    """
    scope = request.args.get('scope', 'friends')
    if scope not in ('friends', 'all'):
        return {'errors': ['scope must be friends or all']}, 400
    try:
        limit = get_limit(request.args, default=FEED_DEFAULT_LIMIT, max_limit=FEED_MAX_LIMIT)
        raw_cursor = request.args.get('cursor')
        cursor = decode_cursor(raw_cursor) if raw_cursor else None
    except PaginationError as error:
        return {'errors': [str(error)]}, 400

    friend_ids = _friend_ids(current_user.id) if scope == 'friends' else None
    candidates = []
    for kind, model in (('route', Route), ('workout', Workout)):
        stmt = db.select(model).options(joinedload(model.users))
        if friend_ids is not None:
            stmt = stmt.where(model.user_id.in_(friend_ids))
        if cursor:
            stmt = stmt.where(_after_cursor(model, RANKS[kind], cursor))
        stmt = stmt.order_by(model.created_at.desc(), model.id.desc()).limit(limit + 1)
        candidates += [(kind, row) for row in db.session.scalars(stmt).all()]

    candidates.sort(key=lambda item: (item[1].created_at, RANKS[item[0]], item[1].id), reverse=True)
    has_more = len(candidates) > limit
    page = candidates[:limit]
    next_cursor = None
    if has_more and page:
        kind, last = page[-1]
        next_cursor = encode_cursor(last.created_at, last.id, RANKS[kind])
    return {'items': [{'kind': kind, **row.to_dict()} for kind, row in page],
            'nextCursor': next_cursor}
