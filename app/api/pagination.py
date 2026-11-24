"""
Cursor ("keyset") pagination helpers for the list endpoints.

Offset pagination (`?page=3`) skips rows by counting them, which gets slower on
every page and shows duplicates/misses when rows are added while someone is
scrolling. A cursor instead remembers *the last row seen* (its created_at and
id) and asks for "rows older than that", which uses the created_at index and
stays stable.

Usage in an endpoint:
    limit = get_limit(request.args)                    # None = not paginated
    rows, next_cursor = paginate(stmt, Route, limit, request.args.get('cursor'))
Paginated lists are newest first (created_at desc, id desc).
"""
import base64
from datetime import datetime

from sqlalchemy import and_, or_

MAX_LIMIT = 100


class PaginationError(ValueError):
    """Bad `limit` or `cursor` query parameter (the endpoint answers 400)."""


def get_limit(args, default=None, max_limit=MAX_LIMIT):
    """`?limit=N` as an int (1..max_limit), or `default` when it is missing."""
    raw = args.get('limit')
    if raw in (None, ''):
        return default
    try:
        limit = int(raw)
    except ValueError:
        raise PaginationError('limit must be a whole number')
    if limit < 1 or limit > max_limit:
        raise PaginationError(f'limit must be between 1 and {max_limit}')
    return limit


def encode_cursor(created_at, row_id, rank=0):
    raw = f'{created_at.isoformat()}|{rank}|{row_id}'
    return base64.urlsafe_b64encode(raw.encode()).decode().rstrip('=')


def decode_cursor(cursor):
    """-> (created_at, rank, id) or raises PaginationError."""
    try:
        padded = cursor + '=' * (-len(cursor) % 4)
        stamp, rank, row_id = base64.urlsafe_b64decode(padded.encode()).decode().split('|')
        return datetime.fromisoformat(stamp), int(rank), int(row_id)
    except Exception:
        raise PaginationError('cursor is not valid')


def older_than(model, created_at, row_id):
    """WHERE clause: rows strictly after (created_at, id) in newest-first order."""
    return or_(model.created_at < created_at,
               and_(model.created_at == created_at, model.id < row_id))


def paginate(session, stmt, model, limit, cursor):
    """
    Runs `stmt` (a select(model) with its filters and options) and returns
    (rows, next_cursor). Without `limit` it returns every row ordered by id
    and next_cursor None (the home map needs all routes).
    """
    if limit is None:
        return session.scalars(stmt.order_by(model.id)).all(), None
    if cursor:
        created_at, _, row_id = decode_cursor(cursor)
        stmt = stmt.where(older_than(model, created_at, row_id))
    stmt = stmt.order_by(model.created_at.desc(), model.id.desc()).limit(limit + 1)
    rows = session.scalars(stmt).all()
    next_cursor = None
    if len(rows) > limit:
        rows = rows[:limit]
        next_cursor = encode_cursor(rows[-1].created_at, rows[-1].id)
    return rows, next_cursor
