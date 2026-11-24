from sqlalchemy import func, select
from sqlalchemy.orm import column_property

from .db import db
from .user import User
from .db import environment, SCHEMA
from .route import Route
from .comment import Comment
from .workout import Workout

# Number of comments on a route / workout, computed by the database as a
# correlated subquery that is part of the same SELECT that loads the row. List
# endpoints can therefore show "3 comments" without loading the comments
# themselves (one query for N routes instead of N+1, and no comment bodies in
# the response). Defined here because it needs both Route and Comment.
Route.comment_count = column_property(
    select(func.count(Comment.id))
    .where(Comment.route_id == Route.id)
    .correlate_except(Comment)
    .scalar_subquery(),
    deferred=False)
Workout.comment_count = column_property(
    select(func.count(Comment.id))
    .where(Comment.workout_id == Workout.id)
    .correlate_except(Comment)
    .scalar_subquery(),
    deferred=False)
