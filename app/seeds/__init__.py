import click
from flask.cli import AppGroup
from sqlalchemy import delete, select

from app.models import db, User, Route, Workout, Comment
from app.models.user import follows
from app.models.db import environment
from .users import seed_users
from .routes import seed_routes
from .workouts import seed_workouts
from .comments import seed_comments

# Creates a seed group to hold our commands
# So we can type `flask seed --help`
seed_commands = AppGroup('seed')


def database_has_data():
    """True if there is at least one user (the seed's first table)."""
    return db.session.execute(select(User.id).limit(1)).first() is not None


def delete_all_data():
    """
    Deletes every row from the app's tables, children before parents
    (comments -> workouts -> routes -> follows -> users) so no foreign key
    is ever violated. Uses plain DELETE (works on SQLite and Postgres); the
    seeds never depend on ids starting at 1, so ids are not reset.
    """
    for table in (Comment.__table__, Workout.__table__, Route.__table__, follows, User.__table__):
        db.session.execute(delete(table))
    db.session.commit()


def refuse_in_production(action):
    if environment == 'production':
        raise click.ClickException(
            f'{action} deletes all data and is disabled in production '
            '(APP_ENV=production). Run it only against a local database.')


def seed_demo_data():
    users = seed_users()
    routes = seed_routes(users)
    workouts = seed_workouts(users)
    seed_comments(users, routes, workouts)


# `flask seed all` - safe to run on every deploy: it only seeds an empty
# database and never deletes anything. `flask seed all --reset` wipes the
# tables first (local development only).
@seed_commands.command('all')
@click.option('--reset', is_flag=True,
              help='Delete all existing data first, then seed (refused in production).')
def seed(reset):
    if reset:
        refuse_in_production('flask seed all --reset')
        delete_all_data()
        click.echo('Deleted existing data.')
    elif database_has_data():
        click.echo('Database already has data. Skipping seed.')
        return
    seed_demo_data()
    click.echo('Seeded demo data.')


# `flask seed undo` - delete all data (local development only).
@seed_commands.command('undo')
def undo():
    refuse_in_production('flask seed undo')
    delete_all_data()
    click.echo('Deleted all data.')
