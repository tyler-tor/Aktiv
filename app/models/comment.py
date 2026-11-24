from .db import db, environment, SCHEMA, add_prefix_for_prod, utcnow, iso


class Comment(db.Model):
    __tablename__ = 'comments'

    if environment == "production":
        __table_args__ = {'schema': SCHEMA}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("users.id")), nullable=False, index=True)
    route_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod('routes.id')), index=True)
    workout_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod('workouts.id')), index=True)
    body = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow, server_default=db.func.now())
    updated_at = db.Column(
        db.DateTime, default=utcnow, onupdate=utcnow, server_default=db.func.now())

    users = db.relationship("User", back_populates="comments", single_parent=True)
    routes = db.relationship("Route", back_populates="comments", single_parent=True)
    workouts = db.relationship('Workout', back_populates='comments', single_parent=True)

    def to_dict(self):
        """
        A comment belongs to a route (routeId) or a workout (workoutId). The
        ids come from the comment's own columns, so building this does not
        load the route / workout.
        """
        data = {
            'id': self.id,
            'userId': self.user_id,
            'body': self.body,
            'createdAt': iso(self.created_at),
            'user': {
                'username': self.users.username,
                'profilePicture': self.users.profile_picture,
            },
        }
        if self.route_id is not None:
            data['routeId'] = self.route_id
        else:
            data['workoutId'] = self.workout_id
        return data
