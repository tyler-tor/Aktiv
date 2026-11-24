import React, { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux';
import { useParams, Link } from 'react-router';
import { getCurrentWorkout } from '../../store/workouts';
import Comments from '../Comments/Comments';
import EditWorkoutModal from './EditWorkoutModal';
import DeleteWorkoutModal from './DeleteWorkoutModal';
import Avatar from '../ui/Avatar';
import StatStrip from '../ui/StatStrip';
import { useUnits } from '../../context/Units';
import { activityKind, activityLabel, formatDate, formatDuration } from '../../utils/format';
import usePageTitle from '../../hooks/usePageTitle';
import '../ui/Detail.css';

function WorkoutDisplay() {
    const { workoutId } = useParams();
    const dispatch = useDispatch();
    const workout = useSelector(state => state.workouts.currentWorkout);
    const currUser = useSelector(state => state.session.user);
    const [status, setStatus] = useState('loading');
    const { distance, pace, speed } = useUnits();
    usePageTitle(workout && String(workout.id) === String(workoutId) ? workout.title : 'Workout');

    useEffect(() => {
        let cancelled = false;
        setStatus('loading');
        (async () => {
            try {
                await dispatch(getCurrentWorkout(workoutId));
                if (!cancelled) setStatus('done');
            } catch {
                if (!cancelled) setStatus('error');
            }
        })()
        return () => { cancelled = true };
    }, [dispatch, workoutId])

    const current = workout && String(workout.id) === String(workoutId) && workout.ownerInfo ? workout : null;

    if (!current) {
        if (status === 'loading') {
            return <div className='page detail'><div className='skeleton detail__skeleton' role='status'><span className='sr-only'>Loading workout</span></div></div>;
        }
        return (
            <div className='page page--narrow'>
                <div className='empty-state'>
                    <h1>Workout not found</h1>
                    <p>It may have been deleted, or the link is wrong.</p>
                    <Link to='/activity' className='btn btn--primary btn--sm'>Back to activity</Link>
                </div>
            </div>
        );
    }

    const bike = activityKind(current.type) === 'bike';
    const dist = distance(current.distanceM).split(' ');
    const rate = (bike ? speed(current.distanceM, current.durationS) : pace(current.distanceM, current.durationS)).split(' ');

    return (
        <div className='page detail'>
            <header className='detail__head'>
                <div>
                    <p className='detail__owner'>
                        <Link to={`/users/${current.userId}`}><Avatar user={current.ownerInfo} size='sm' /> {current.ownerInfo.firstName} {current.ownerInfo.lastName}</Link>
                        <span className='chip'>{activityLabel(current.type)}</span>
                        <time dateTime={current.createdAt}>{formatDate(current.createdAt)}</time>
                    </p>
                    <h1 className='detail__title'>{current.title}</h1>
                </div>
                {currUser.id === current.userId && (
                    <div className='btn-row'>
                        <EditWorkoutModal workout={current} />
                        <DeleteWorkoutModal workoutId={current.id} />
                    </div>
                )}
            </header>
            <div className='detail__grid'>
                <div className='detail__main'>
                    <div className='media detail__media'>
                        <img src={current.imageUrl} alt={`${current.title}`} decoding='async' />
                    </div>
                    <p className='detail__desc'>{current.description}</p>
                </div>
                <aside className='detail__side card'>
                    <StatStrip items={[
                        { label: 'Distance', value: dist[0], unit: dist.slice(1).join(' ') },
                        { label: 'Time', value: formatDuration(current.durationS) },
                        { label: bike ? 'Average speed' : 'Pace', value: rate[0] === '' ? '' : rate[0], unit: rate.slice(1).join(' ') },
                    ]} />
                </aside>
            </div>
            <section className='detail__comments' id='comments' aria-labelledby='comments-h'>
                <Comments id={current.id} kind='workout' />
            </section>
        </div>
    )
}

export default WorkoutDisplay
