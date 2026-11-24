from .db import db, environment, SCHEMA, add_prefix_for_prod, utcnow, iso


class Workout(db.Model):
    __tablename__ = 'workouts'

    if environment == "production":
        __table_args__ = {'schema': SCHEMA}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("users.id")), nullable=False, index=True)
    title = db.Column(db.String(30), nullable=False)
    description = db.Column(db.String(1000), nullable=False)
    type = db.Column(db.String(50), nullable=False)
    # Length in metres and moving time in seconds (formatted in the browser).
    distance_m = db.Column(db.Float(), nullable=False)
    duration_s = db.Column(db.Integer(), nullable=False)
    image_url = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow, server_default=db.func.now(), index=True)
    updated_at = db.Column(
        db.DateTime, default=utcnow, onupdate=utcnow, server_default=db.func.now())

    users = db.relationship("User", back_populates="workouts", single_parent=True)
    comments = db.relationship('Comment', back_populates='workouts', cascade='all, delete-orphan', single_parent=True)


    # Only these columns may be changed through the edit endpoint. Anything else
    # (id, user_id, created_at, csrf_token, ...) is silently ignored so a
    # request can never re-assign a workout to another user.
    EDITABLE_FIELDS = ('title', 'description', 'type', 'duration_s',
                       'image_url', 'distance_m')

    def set_kwargs(self, **kwargs):
        for key, value in kwargs.items():
            if key in self.EDITABLE_FIELDS:
                setattr(self, key, value)
        return self


    def to_dict(self):
        """The one workout shape used by every endpoint (see Route.to_dict)."""
        return {
            'id': self.id,
            'userId': self.user_id,
            'title': self.title,
            'description': self.description,
            'type': self.type,
            'durationS': self.duration_s,
            'distanceM': self.distance_m,
            'imageUrl': self.image_url,
            'createdAt': iso(self.created_at),
            'updatedAt': iso(self.updated_at),
            'commentCount': self.comment_count,
            'ownerInfo': self.users.to_summary(),
        }
