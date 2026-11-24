from app.models import db, Workout


def seed_workouts(users):
    """Creates 10 workouts owned by the seeded users; returns them in order."""
    workout1 = Workout(
        user_id=users[2].id, title="Motivated", description="I love pushing my limits and seeing how far I can go! There's nothing like a good workout to get my adrenaline pumping and my heart racing.", image_url='/images/seed/workouts/1.svg', type='running',
        distance_m=8047, duration_s=2520)
    workout2 = Workout(
        user_id=users[1].id, title="This is it", description="Great time to be alive got to keep going", image_url='/images/seed/workouts/2.svg', type='hiking',
        distance_m=12875, duration_s=12000)
    workout3 = Workout(
        user_id=users[0].id, title="Not Easy", description="Hit the gym and break a sweat - nothing feels as good as putting in hard work and achieving your goals", image_url='/images/seed/workouts/3.svg', type='running',
        distance_m=9656, duration_s=3360)
    workout4 = Workout(
        user_id=users[3].id, title="New year", description="Staying active and getting fit! Going to the gym, stretching, and running are all great ways to keep my body healthy", image_url='/images/seed/workouts/4.svg', type='running',
        distance_m=14484, duration_s=5400)
    workout5 = Workout(
        user_id=users[4].id, title="Enjoyable Ride", description="The wind in my hair makes me feel free!", image_url='/images/seed/workouts/5.svg', type='biking',
        distance_m=19312, duration_s=2400)
    workout6 = Workout(
        user_id=users[0].id, title="Lunch mind reset", description="Riding my bike gives me time to think about things that matter most to me!", image_url='/images/seed/workouts/6.svg', type='biking',
        distance_m=35406, duration_s=4320)
    workout7 = Workout(
        user_id=users[1].id, title="Unknown trail", description="Not sure why I've never come across this trail before but so fun.", image_url='/images/seed/workouts/7.svg', type='biking',
        distance_m=41843, duration_s=6000)
    workout8 = Workout(
        user_id=users[2].id, title="Lost", description="A little bit of hiking never hurt anybody... right?", image_url='/images/seed/workouts/8.svg', type='hiking',
        distance_m=10461, duration_s=9900)
    workout9 = Workout(
        user_id=users[3].id, title="Great outdoors", description="#outdoors #hiking #nature ##adventuretime ##camping ##getoutside ##explore ##adventuresofalifetime", image_url='/images/seed/workouts/9.svg', type='hiking',
        distance_m=12875, duration_s=11640)
    workout10 = Workout(
        user_id=users[4].id, title="Doggo adventure", description="My dog loves exploring nature too! hehehe", image_url='/images/seed/workouts/10.svg', type='hiking',
        distance_m=5633, duration_s=4320)

    workouts = [workout1, workout2, workout3, workout4, workout5, workout6,
                workout7, workout8, workout9, workout10]
    db.session.add_all(workouts)
    db.session.commit()
    return workouts
