from app.models import db, User


def seed_users():
    """Creates the demo user plus 4 other users and their friendships.

    Returns the users in a fixed order (demo first) so the other seed files can
    refer to them by position (users[0] = demo) instead of hard-coding ids.
    """
    demo = User(
        username='Demouser', email='demo@aa.io', password='password', first_name='Demo', last_name='user',
        profile_picture='https://capstone-strava-clone-aktiv.s3.us-west-2.amazonaws.com/strava+pictures/profile/propic-8.jpg')
    marnie = User(
        username='marnie', email='marnie@aa.io', password='password', first_name='Marnie', last_name='Doe',
        profile_picture='https://capstone-strava-clone-aktiv.s3.us-west-2.amazonaws.com/strava+pictures/profile/marnie.jpg')
    bobbie = User(
        username='bobbie', email='bobbie@aa.io', password='password', first_name='Bobbie', last_name='Smith',
        profile_picture='https://capstone-strava-clone-aktiv.s3.us-west-2.amazonaws.com/bob-pic-jpg.jpg')
    jimmy = User(
        username='JimmysWorld', email='jimmy@aa.io', password='password', first_name='Jimmy', last_name='Nuetron',
        profile_picture='https://capstone-strava-clone-aktiv.s3.us-west-2.amazonaws.com/strava+pictures/profile/jimmy.jpg')
    tammie = User(
        username='LambdaTammie', email='tammie@aa.io', password='password', first_name='Tammie', last_name='Lambda',
        profile_picture='https://capstone-strava-clone-aktiv.s3.us-west-2.amazonaws.com/strava+pictures/profile/tammie.jpg')


    # Insert in this order so a fresh database gives the same ids as before
    # (demo=1, marnie=2, tammie=3, bobbie=4, jimmy=5). The other seed files
    # use positions in this list (users[0] = demo), never raw ids.
    users = [demo, marnie, tammie, bobbie, jimmy]
    db.session.add_all(users)
    db.session.flush()

    # Friendships (each user's "followers" list is their friends list).
    demo.followers = [marnie, bobbie, jimmy]
    marnie.followers = [demo, bobbie, tammie]
    bobbie.followers = [marnie, demo, tammie]
    jimmy.followers = [marnie, demo]
    tammie.followers = [marnie, demo]
    db.session.commit()
    return users
