from .db import db, environment, SCHEMA, add_prefix_for_prod, utcnow


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
        if self.routes:
            return {
                'id': self.id,
                'userId': self.user_id,
                'body': self.body,
                'createdAt': self.created_at,
                'routeId': self.routes.id,
                'user': {
                    'username': self.users.username,
                    'profilePicture': self.users.profile_picture
                }
            }
        return {
            'id': self.id,
            'userId': self.user_id,
            'body': self.body,
            'createdAt': self.created_at,
            'workoutId': self.workouts.id,
            'user': {
                    'username': self.users.username,
                    'profilePicture': self.users.profile_picture
                }
        }
