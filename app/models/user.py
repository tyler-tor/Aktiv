from .db import db, environment, SCHEMA, add_prefix_for_prod, utcnow, iso
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin

# Association table for friendships ("followed_id is followed by follower_id").
# The two ids together are the primary key (no duplicates, never NULL), and
# deleting a user deletes their rows here (ON DELETE CASCADE).
follows = db.Table('follows',
    db.Column('follower_id', db.Integer,
              db.ForeignKey(add_prefix_for_prod('users.id'), ondelete='CASCADE'),
              primary_key=True),
    db.Column('followed_id', db.Integer,
              db.ForeignKey(add_prefix_for_prod('users.id'), ondelete='CASCADE'),
              primary_key=True, index=True)
)

if environment == "production":
    follows.schema = SCHEMA

class User(db.Model, UserMixin):
    __tablename__ = 'users'

    if environment == "production":
        __table_args__ = {'schema': SCHEMA}

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(40), nullable=False, unique=True)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(255), nullable=False, unique=True)
    profile_picture = db.Column(db.String(255), default='https://www.dovercourt.org/wp-content/uploads/2019/11/610-6104451_image-placeholder-png-user-profile-placeholder-image-png.jpg')
    hashed_password = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow, server_default=db.func.now())
    updated_at = db.Column(
        db.DateTime, default=utcnow, onupdate=utcnow, server_default=db.func.now())

    routes = db.relationship('Route', back_populates='users', cascade='all, delete-orphan')
    workouts = db.relationship('Workout', back_populates='users', cascade='all, delete-orphan')
    comments = db.relationship('Comment', back_populates='users', cascade='all, delete-orphan')

    followers = db.relationship(
        'User', secondary=follows,
        primaryjoin=(follows.c.followed_id == id),
        secondaryjoin=(follows.c.follower_id == id),
        backref=db.backref('follows', lazy='dynamic'), lazy='dynamic')

    @property
    def password(self):
        return self.hashed_password

    @password.setter
    def password(self, password):
        self.hashed_password = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password, password)

    def to_summary(self):
        """The small public view of a user (lists, owner info, friends)."""
        return {
            'id': self.id,
            'username': self.username,
            'firstName': self.first_name,
            'lastName': self.last_name,
            'profilePicture': self.profile_picture,
        }

    def to_friend(self):
        """Summary used in friends lists. `userId` is kept for the frontend."""
        return {**self.to_summary(), 'userId': self.id}

    def to_dict(self, private=False, include_activity=False):
        """
        Profile view of a user. It no longer embeds the user's routes,
        workouts, comments (each with their comments) by default: that made
        /api/auth/ and the user list grow with the whole database.

        private=True   adds the email (only for the logged-in user's own data)
        include_activity=True adds the user's routes and workouts (profile page)
        """
        data = {
            **self.to_summary(),
            'createdAt': iso(self.created_at),
            'friends': [friend.to_friend() for friend in self.followers],
        }
        if private:
            data['email'] = self.email
        if include_activity:
            data['routes'] = [route.to_dict() for route in sorted(self.routes, key=lambda r: r.id)]
            data['workouts'] = [workout.to_dict() for workout in sorted(self.workouts, key=lambda w: w.id)]
        return data
