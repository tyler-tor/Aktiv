import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router';
import { useSelector, useDispatch } from 'react-redux';
import AdjustFriendStatusModal from './AdjustFriendStatus/AdjustFriendStatusModal';
import { getOneUser } from '../store/users';
import { formatMonthYear } from '../utils/format';
import Avatar from './ui/Avatar';
import ActivityCard from './ui/ActivityCard';
import usePageTitle from '../hooks/usePageTitle';
import './UserProfile.css'

function User() {
  const currUser = useSelector(state => state.session.user);
  const user = useSelector(state => state.users.currentUser)
  const [status, setStatus] = useState(false)
  const [, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { userId } = useParams();
  const dispatch = useDispatch();
  const shown = user && String(user.id) === String(userId) ? user : null;
  usePageTitle(shown ? `${shown.firstName} ${shown.lastName}` : 'Profile');

  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    Promise.resolve(dispatch(getOneUser(userId))).finally(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [dispatch, userId])

  // Friend status comes from the logged-in user's friend list.
  useEffect(() => {
    setStatus(currUser.friends.some(friend => String(friend.userId ?? friend.id) === String(userId)))
  }, [currUser.friends, userId])

  const activity = useMemo(() => {
    if (!shown) return []
    return [
      ...shown.routes.map(r => ({ ...r, kind: 'route' })),
      ...shown.workouts.map(w => ({ ...w, kind: 'workout' })),
    ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
  }, [shown])

  if (!shown) {
    if (!loaded) {
      return <div className='page profile'><div className='skeleton profile__skeleton' role='status'><span className='sr-only'>Loading profile</span></div></div>
    }
    return (
      <div className='page page--narrow'>
        <div className='empty-state'>
          <h1>Person not found</h1>
          <p>This profile does not exist.</p>
          <Link to='/users' className='btn btn--primary btn--sm'>See everyone</Link>
        </div>
      </div>
    )
  }

  const isMe = shown.id === currUser.id;

  return (
    <div className='page profile'>
      <header className='profile__head card'>
        <Avatar user={shown} size='xl' name={`${shown.firstName} ${shown.lastName}`} />
        <div className='profile__id'>
          <h1 className='profile__name'>{shown.firstName} {shown.lastName}</h1>
          <p className='profile__user'>@{shown.username}</p>
          <p className='profile__since'>Member since {formatMonthYear(shown.createdAt)}</p>
        </div>
        <dl className='profile__counts'>
          <div><dt>Routes</dt><dd>{shown.routes.length}</dd></div>
          <div><dt>Workouts</dt><dd>{shown.workouts.length}</dd></div>
          <div><dt>Friends</dt><dd>{shown.friends.length}</dd></div>
        </dl>
        {!isMe && (
          <div className='profile__action'>
            <AdjustFriendStatusModal userId={userId} status={status} setStatus={setStatus} setLoading={setLoading}
              name={shown.firstName} />
          </div>
        )}
      </header>

      <div className='profile__cols'>
        <section aria-labelledby='profile-activity'>
          <h2 id='profile-activity' className='profile__h'>Activity</h2>
          {activity.length === 0 ? (
            <div className='empty-state'>
              <h3>No activity yet</h3>
              <p>{isMe ? 'Plan a route or log a workout to get started.' : `${shown.firstName} has not shared anything yet.`}</p>
              {isMe && <div className='btn-row'>
                <Link to='/newRoute' className='btn btn--primary btn--sm'>Plan a route</Link>
                <Link to='/newWorkout' className='btn btn--secondary btn--sm'>Log a workout</Link>
              </div>}
            </div>
          ) : (
            <div className='profile__list'>
              {activity.map(item => (
                <ActivityCard key={`${item.kind}-${item.id}`} activity={{ ...item, ownerInfo: shown, userId: shown.id }} showOwner={false} headingLevel={3} />
              ))}
            </div>
          )}
        </section>
        <aside aria-labelledby='profile-friends'>
          <h2 id='profile-friends' className='profile__h'>Friends</h2>
          {shown.friends.length === 0
            ? <p className='profile__none'>No friends yet.</p>
            : <ul className='profile__friends card'>
              {shown.friends.map(friend => (
                <li key={friend.userId ?? friend.id}>
                  <Link to={`/users/${friend.userId ?? friend.id}`}><Avatar user={friend} size='sm' />{friend.username}</Link>
                </li>
              ))}
            </ul>}
        </aside>
      </div>
    </div>
  );
}
export default User;
