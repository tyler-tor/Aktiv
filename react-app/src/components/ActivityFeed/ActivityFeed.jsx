import React, { useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Link } from 'react-router';
import { FiCompass } from 'react-icons/fi';
import { getFeed, getMoreFeed } from '../../store/friendsActivity';
import { formatMonthYear } from '../../utils/format';
import Avatar from '../ui/Avatar';
import ActivityCard from '../ui/ActivityCard';
import usePageTitle from '../../hooks/usePageTitle';
import './ActivityFeed.css';

function FeedSkeleton() {
    return (
        <div className='feed__skeleton' role='status' aria-live='polite'>
            <span className='sr-only'>Loading activity</span>
            {[0, 1].map((i) => (
                <div className='skeleton feed__skeleton-card' key={i} aria-hidden='true' />
            ))}
        </div>
    );
}

function ActivityFeed() {
    const dispatch = useDispatch();
    const { items, nextCursor, scope, loadingMore } = useSelector(state => state.friendsActivity)
    const currUser = useSelector(state => state.session.user)
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    usePageTitle('Activity');

    const load = async (nextScope) => {
        setLoading(true);
        setFailed(false);
        try {
            await dispatch(getFeed(nextScope));
        } catch {
            setFailed(true);
        }
        setLoading(false);
    };

    // First page of the feed (friends only until the user picks "Everyone").
    useEffect(() => {
        load('friends');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch])

    if (!currUser) return null;
    const list = items || [];

    return (
        <div className='page feed'>
            <aside className='feed__side' aria-label='Your profile'>
                <section className='card feed__me'>
                    <Avatar user={currUser} size='lg' />
                    <h2 className='feed__me-name'><Link to={`/users/${currUser.id}`}>{currUser.firstName} {currUser.lastName}</Link></h2>
                    <p className='feed__me-user'>@{currUser.username}</p>
                    <dl className='feed__me-stats'>
                        <div><dt>Routes</dt><dd>{currUser.routeCount}</dd></div>
                        <div><dt>Workouts</dt><dd>{currUser.workoutCount}</dd></div>
                        <div><dt>Friends</dt><dd>{currUser.friends.length}</dd></div>
                    </dl>
                    <p className='feed__me-since'>Member since {formatMonthYear(currUser.createdAt)}</p>
                </section>
                <section className='card feed__people' aria-labelledby='friends-h'>
                    <h2 id='friends-h' className='feed__side-title'>Friends</h2>
                    {currUser.friends.length === 0
                        ? <p className='feed__side-empty'>No friends yet. Find people below.</p>
                        : <ul className='feed__people-list'>
                            {currUser.friends.map(friend => (
                                <li key={friend.userId}>
                                    <Link to={`/users/${friend.userId}`}><Avatar user={friend} size='sm' />{friend.username}</Link>
                                </li>
                            ))}
                        </ul>}
                </section>
            </aside>

            <section className='feed__main' aria-labelledby='feed-h'>
                <div className='feed__bar'>
                    <h1 id='feed-h' className='feed__title'>Activity</h1>
                    <div className='segmented' role='group' aria-label='Whose activity to show'>
                        <button type='button' aria-pressed={scope === 'friends'} onClick={() => load('friends')}>Friends</button>
                        <button type='button' aria-pressed={scope === 'all'} onClick={() => load('all')}>Everyone</button>
                    </div>
                </div>

                {loading && list.length === 0 && <FeedSkeleton />}
                {failed && (
                    <div className='empty-state' role='alert'>
                        <h2>Could not load activity</h2>
                        <p>Check your connection and try again.</p>
                        <button type='button' className='btn btn--primary btn--sm' onClick={() => load(scope || 'friends')}>Try again</button>
                    </div>
                )}
                {!loading && !failed && list.length === 0 && (
                    <div className='empty-state'>
                        <FiCompass size={32} aria-hidden='true' />
                        <h2>{scope === 'friends' ? 'Nothing from your friends yet' : 'No activity yet'}</h2>
                        <p>{scope === 'friends'
                            ? 'Add friends to see their routes and workouts here, or look at what everyone is up to.'
                            : 'Be the first: plan a route or log a workout.'}</p>
                        <div className='btn-row'>
                            {scope === 'friends' && <button type='button' className='btn btn--secondary btn--sm' onClick={() => load('all')}>Show everyone</button>}
                            <Link to='/newRoute' className='btn btn--primary btn--sm'>Plan a route</Link>
                        </div>
                    </div>
                )}

                <div className='feed__list'>
                    {list.map((activity) => (
                        <ActivityCard key={`${activity.kind}-${activity.id}`} activity={activity} />
                    ))}
                </div>
                {nextCursor && (
                    <button type='button' className='btn btn--secondary feed__more' disabled={loadingMore}
                        onClick={() => dispatch(getMoreFeed())}>
                        {loadingMore ? 'Loading...' : 'Load more'}
                    </button>
                )}
            </section>

            <aside className='feed__side' aria-label='Suggested people'>
                <section className='card feed__people' aria-labelledby='sugg-h'>
                    <h2 id='sugg-h' className='feed__side-title'>People you may know</h2>
                    {(currUser.nonFriends || []).length === 0
                        ? <p className='feed__side-empty'>You follow everyone here.</p>
                        : <ul className='feed__people-list'>
                            {currUser.nonFriends.map(non => (
                                <li key={non.id}>
                                    <Link to={`/users/${non.id}`}><Avatar user={non} size='sm' />{non.username}</Link>
                                </li>
                            ))}
                        </ul>}
                </section>
            </aside>
        </div>
    )
}

export default ActivityFeed
