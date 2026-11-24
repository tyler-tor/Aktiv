from .db import db, environment, SCHEMA, add_prefix_for_prod, utcnow, iso


class Route(db.Model):
    __tablename__ = 'routes'

    if environment == "production":
        __table_args__ = {'schema': SCHEMA}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey(
        add_prefix_for_prod("users.id")), nullable=False, index=True)
    title = db.Column(db.String(30), nullable=False)
    description = db.Column(db.String(1000), nullable=False)
    image_url = db.Column(db.String(255), nullable=False)
    start_lat = db.Column(db.Float(), nullable=False)
    start_lng = db.Column(db.Float(), nullable=False)
    end_lat = db.Column(db.Float(), nullable=False)
    end_lng = db.Column(db.Float(), nullable=False)
    optimize_waypoints = db.Column(db.Boolean(), default=True)
    stopover = db.Column(db.Boolean(), default=False)
    traveling_mode = db.Column(db.String(50), nullable=False)
    distance = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=utcnow, server_default=db.func.now(), index=True)
    updated_at = db.Column(
        db.DateTime, default=utcnow, onupdate=utcnow, server_default=db.func.now())

    users = db.relationship(
        "User", back_populates="routes", single_parent=True)
    # workouts = db.relationship("Workout", back_populates="routes")
    comments = db.relationship(
        'Comment', back_populates='routes', cascade='all, delete-orphan')

    # Only these columns may be changed through the edit endpoint. Anything else
    # (id, user_id, created_at, csrf_token, ...) is silently ignored so a
    # request can never re-assign a route to another user.
    EDITABLE_FIELDS = ('title', 'description', 'image_url', 'start_lat',
                       'start_lng', 'end_lat', 'end_lng', 'distance',
                       'traveling_mode')

    def set_kwargs(self, **kwargs):
        for key, value in kwargs.items():
            if key in self.EDITABLE_FIELDS:
                setattr(self, key, value)
        return self

    def to_dict(self):
        """
        The one route shape used by every endpoint. Comments are NOT embedded
        (fetch them from /api/routes/<id>/comments); only their count is, and
        the owner is the small public summary (no email).
        """
        return {
            'id': self.id,
            'userId': self.user_id,
            'title': self.title,
            'description': self.description,
            'imageUrl': self.image_url,
            'startingPoint': {'lat': self.start_lat, 'lng': self.start_lng},
            'endingPoint': {'lat': self.end_lat, 'lng': self.end_lng},
            'travelMode': self.traveling_mode,
            'distance': self.distance,
            'createdAt': iso(self.created_at),
            'updatedAt': iso(self.updated_at),
            'commentCount': self.comment_count,
            'ownerInfo': self.users.to_summary(),
        }
