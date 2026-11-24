import React, { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { getFeed, getMoreFeed } from '../../store/friendsActivity';
import { NavLink } from 'react-router';
import './ActivityFeed.css';
import RouteSketch from '../RouteSketch/RouteSketch';
import { formatDate, formatMonthYear, formatDuration } from '../../utils/format';
import { useUnits } from '../../context/Units';

function ActivityFeed() {
    const dispatch = useDispatch();
    const { distance } = useUnits();
    const { items, nextCursor, scope, loadingMore } = useSelector(state => state.friendsActivity)
    const following = scope === 'friends' ? 'Following' : 'All Activity'
    const currUser = useSelector(state => state.session.user)

    // First page of the feed (friends only until the user picks "All Activity").
    useEffect(() => {
        dispatch(getFeed('friends'))
    }, [dispatch])

    if (!items) {
        return null;
    }

    return currUser && (
        <div className='activity-feed-container'>
            <div className='curruser-container'>
                <div className='propic-wrapper'>
                    <img loading='lazy' decoding='async' className='propic' src={currUser.profilePicture} alt='user-pic' />
                </div>
                <div className='curruser-info'>
                    <ul className='cui-list'>
                        <li className='userinfo-item'>
                            <NavLink className='cui-fullname'
                                to={`/users/${currUser.id}`}>
                                {currUser.firstName}
                                {' '}
                                {currUser.lastName}
                            </NavLink>
                        </li>
                        <li className='userinfo-item'>
                            <p className='cui-username'>
                                {currUser.username}
                            </p>
                        </li>
                        <li className='userinfo-item'>
                            <strong>
                                Member since:
                            </strong>
                            {formatMonthYear(currUser.createdAt)}
                        </li>
                        <li className='userinfo-item'>
                            Activity: {currUser.routeCount + currUser.workoutCount}
                        </li>
                        <li className='userinfo-item'>
                            {currUser.friends.map(friend => {
                                return (
                                    <div className='friend-list'
                                    key={friend.userId}>
                                        <img loading='lazy' decoding='async' className='friend-propic'
                                            src={friend.profilePicture}
                                            alt='friend-pic' />
                                        <NavLink
                                            to={`/users/${friend.userId}`}
                                            className='friend-link'>
                                            {friend.username}
                                        </NavLink>
                                    </div>
                                )
                            })}
                        </li>
                    </ul>
                </div>
            </div>
            <div className='activity-container'>
                <div className='activity-select-container'>
                    <select
                        name='following'
                        value={following}
                        onChange={(e) => dispatch(getFeed(e.target.value === 'Following' ? 'friends' : 'all'))}
                        className='select-input'
                    >
                        <option>Following</option>
                        <option>All Activity</option>
                    </select>
                </div>
                {items.map((activity) => {
                    // Only routes (they have a startingPoint) get a map image;
                    // route and workout ids can overlap.
                    return (
                        <div className='af-posts-container'
                            key={`${activity.kind}-${activity.id}`}>
                            {activity.kind === 'route' ? (
                                <div className='post-info-container'>
                                    <a className='img-container'
                                        href={`/routes/${activity.id}`}>
                                        <RouteSketch polyline={activity.polyline} start={activity.startingPoint}
                                            end={activity.endingPoint} title={activity.title} />
                                    </a>
                                    <div className='post-info'>
                                        <a className='act-title'
                                            href={`/routes/${activity.id}`}>
                                            {activity.title}
                                        </a>
                                        <p className='act-description'>
                                            {activity.description}
                                        </p>
                                        <div className='act-info'>
                                            <p className='act-distance'>
                                                {distance(activity.distanceM)}
                                            </p>
                                            <p className='act-travel'>
                                                {activity.travelMode}
                                            </p>
                                        </div>
                                        <p className='act-comm'>
                                            Comments: {activity.commentCount}
                                        </p>
                                    </div>
                                    <div className='post-owner-info'>
                                        <a className='owner-propic-wrapper'
                                            href={`/users/${activity.userId}`}>
                                            <img loading='lazy' decoding='async' src={activity.ownerInfo.profilePicture} alt='owner'
                                                className='owner-pro-pic'
                                            />
                                            <div className='oi-text'>
                                                <p className='oi-username'>{activity.ownerInfo.username}</p>
                                                <p>
                                                    {formatDate(activity.createdAt)}
                                                </p>
                                            </div>
                                        </a>
                                    </div>
                                </div>
                            ) : (
                                <div className='post-info-container'>
                                    <a className='img-container'
                                        href={`/workouts/${activity.id}`}>
                                        <img loading='lazy' decoding='async' src={activity.imageUrl} alt='workout'
                                            className='act-workout-pic'
                                        />
                                    </a>
                                    <div className='post-info'>
                                        <a className='act-title'>
                                            {activity.title}
                                        </a>
                                        <p className='act-description'>
                                            {activity.description}
                                        </p>
                                        <div className='act-info'>
                                            <p className='act-distance'>
                                                {distance(activity.distanceM)}
                                            </p>
                                            <p className='act-total-time'>
                                                {formatDuration(activity.durationS)}
                                            </p>
                                            <p className='act-type'>
                                                {activity.type}
                                            </p>
                                        </div>
                                        <p className='act-comm'>
                                            Comments: {activity.commentCount}
                                        </p>
                                    </div>
                                    <div className='post-owner-info'>
                                        <a className='owner-propic-wrapper'
                                            href={`/users/${activity.userId}`}>
                                            <img loading='lazy' decoding='async' src={activity.ownerInfo.profilePicture} alt='owner'
                                                className='owner-pro-pic'
                                            />
                                        <div className='oi-text'>
                                            <p className='oi-username'>{activity.ownerInfo.username}</p>
                                            <p>
                                                {formatDate(activity.createdAt)}
                                            </p>
                                        </div>
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
                {items.length === 0 && (
                    <p className='act-description'>No activity yet.</p>
                )}
                {nextCursor && (
                    <button className='btn btn--outline btn--medium' disabled={loadingMore}
                        onClick={() => dispatch(getMoreFeed())}>
                        {loadingMore ? 'Loading...' : 'Load more'}
                    </button>
                )}
            </div>
            <div className='nonfriend-container'>
                <h2
                className='nonfriend-wrapper-title'>Suggested Friends: </h2>
                {currUser.nonFriends && currUser?.nonFriends.map(non => {
                    return (
                        <div className='nonfriend-info-container'
                            key={non.id}>
                            <img loading='lazy' decoding='async' src={non.profilePicture} alt='non friend pic'
                            className='non-friend-pic' />
                            <NavLink className='non-friend-text'
                            to={`/users/${non.id}`}>{non.username}</NavLink>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default ActivityFeed
