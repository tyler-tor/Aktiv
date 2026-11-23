from app.models import db, Workout


def seed_workouts(users):
    """Creates 10 workouts owned by the seeded users; returns them in order."""
    workout1 = Workout(
        user_id=users[2].id, title="Motivated", description="I love pushing my limits and seeing how far I can go! There's nothing like a good workout to get my adrenaline pumping and my heart racing.", image_url='https://capstone-strava-clone-aktiv.s3.us-west-2.amazonaws.com/strava+pictures/workouts/1.jpg', type='running',
        total_time='40 min', distance='12 miles')
    workout2 = Workout(
        user_id=users[1].id, title="This is it", description="Great time to be alive got to keep going", image_url='https://capstone-strava-clone-aktiv.s3.us-west-2.amazonaws.com/strava+pictures/workouts/2.jpg', type='hiking',
        total_time='1 hour 20 min', distance='8 miles')
    workout3 = Workout(
        user_id=users[0].id, title="Not Easy", description="Hit the gym and break a sweat - nothing feels as good as putting in hard work and achieving your goals", image_url='https://capstone-strava-clone-aktiv.s3.us-west-2.amazonaws.com/strava+pictures/workouts/3.jpg', type='running',
        total_time='56 min', distance='23 miles')
    workout4 = Workout(
        user_id=users[3].id, title="New year", description="Staying active and getting fit! Going to the gym, stretching, and running are all great ways to keep my body healthy", image_url='https://capstone-strava-clone-aktiv.s3.us-west-2.amazonaws.com/strava+pictures/workouts/4.jpg', type='running',
        total_time='1 hr 30 min', distance='23 miles')
    workout5 = Workout(
        user_id=users[4].id, title="Enjoyable Ride", description="The wind in my hair makes me feel free!", image_url='https://capstone-strava-clone-aktiv.s3.us-west-2.amazonaws.com/strava+pictures/workouts/5.jpg', type='biking',
        total_time='40 min', distance='12 miles')
    workout6 = Workout(
        user_id=users[0].id, title="Lunch mind reset", description="Riding my bike gives me time to think about things that matter most to me!", image_url='https://capstone-strava-clone-aktiv.s3.us-west-2.amazonaws.com/strava+pictures/workouts/6.jpg', type='biking',
        total_time='1 hr 12 min', distance='22 miles')
    workout7 = Workout(
        user_id=users[1].id, title="Unknown trail", description="Not sure why I've never come across this trail before but so fun.", image_url='https://capstone-strava-clone-aktiv.s3.us-west-2.amazonaws.com/strava+pictures/workouts/7.jpg', type='biking',
        total_time='1 hr 40 min', distance='26 miles')
    workout8 = Workout(
        user_id=users[2].id, title="Lost", description="A little bit of hiking never hurt anybody... right?", image_url='https://capstone-strava-clone-aktiv.s3.us-west-2.amazonaws.com/strava+pictures/workouts/8.jpg', type='hiking',
        total_time='2 hr 45 min', distance='16 miles')
    workout9 = Workout(
        user_id=users[3].id, title="Great outdoors", description="#outdoors #hiking #nature ##adventuretime ##camping ##getoutside ##explore ##adventuresofalifetime", image_url='https://capstone-strava-clone-aktiv.s3.us-west-2.amazonaws.com/strava+pictures/workouts/9.jpg', type='hiking',
        total_time='3 hr 14 min', distance='19 miles')
    workout10 = Workout(
        user_id=users[4].id, title="Doggo adventure", description="My dog loves exploring nature too! hehehe", image_url='https://capstone-strava-clone-aktiv.s3.us-west-2.amazonaws.com/strava+pictures/workouts/10.jpg', type='hiking',
        total_time='1 hr 12 min', distance='10 miles')

    workouts = [workout1, workout2, workout3, workout4, workout5, workout6,
                workout7, workout8, workout9, workout10]
    db.session.add_all(workouts)
    db.session.commit()
    return workouts
