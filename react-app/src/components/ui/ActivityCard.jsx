import React from 'react';
import { Link } from 'react-router';
import { FiMessageSquare } from 'react-icons/fi';
import Avatar from './Avatar';
import StatStrip from './StatStrip';
import RouteSketch from '../RouteSketch/RouteSketch';
import { useUnits } from '../../context/Units';
import { activityKind, activityLabel, formatDate, formatDuration } from '../../utils/format';
import './ActivityCard.css';

// "12.9 km" -> { value: '12.9', unit: 'km' } so the number can be set large
const splitUnit = (text) => {
    const [value, ...rest] = String(text || '').split(' ');
    return { value, unit: rest.join(' ') };
};

// One route or workout, used by the feed, profiles and the routes list.
// `activity.kind` is 'route' or 'workout' (the feed adds it; pages that know
// the kind pass it via the `kind` prop).
export default function ActivityCard({ activity, kind, showOwner = true, headingLevel = 2 }) {
    const { distance, pace, speed } = useUnits();
    const type = kind || activity.kind;
    const isRoute = type === 'route';
    const href = isRoute ? `/routes/${activity.id}` : `/workouts/${activity.id}`;
    const owner = activity.ownerInfo;
    const label = activityLabel(isRoute ? activity.travelMode : activity.type);
    const Heading = `h${headingLevel}`;
    const dist = splitUnit(distance(activity.distanceM));
    const bike = activityKind(isRoute ? activity.travelMode : activity.type) === 'bike';
    const rate = !isRoute && activity.durationS
        ? (bike ? splitUnit(speed(activity.distanceM, activity.durationS)) : splitUnit(pace(activity.distanceM, activity.durationS)))
        : null;

    return (
        <article className="activity">
            <header className="activity__head">
                {showOwner && owner && (
                    <Link to={`/users/${activity.userId}`} className="activity__owner">
                        <Avatar user={owner} />
                        <span>
                            <span className="activity__name">{owner.firstName} {owner.lastName}</span>
                            <span className="activity__when">@{owner.username}</span>
                        </span>
                    </Link>
                )}
                <span className="activity__meta">
                    <span className="chip">{label}</span>
                    <time dateTime={activity.createdAt}>{formatDate(activity.createdAt)}</time>
                </span>
            </header>

            <Heading className="activity__title"><Link to={href}>{activity.title}</Link></Heading>
            <p className="activity__desc">{activity.description}</p>

            <StatStrip items={[
                { label: 'Distance', value: dist.value, unit: dist.unit },
                { label: isRoute ? 'Estimated time' : 'Time', value: activity.durationS ? formatDuration(activity.durationS) : '' },
                rate && { label: bike ? 'Average speed' : 'Pace', value: rate.value, unit: rate.unit },
            ]} />

            <Link to={href} className="media activity__media" tabIndex={-1} aria-hidden="true">
                {isRoute
                    ? <RouteSketch polyline={activity.polyline} start={activity.startingPoint} end={activity.endingPoint} title={activity.title} />
                    : <img src={activity.imageUrl} alt="" loading="lazy" decoding="async" />}
            </Link>

            <footer className="activity__foot">
                <Link to={`${href}#comments`} className="activity__comments">
                    <FiMessageSquare aria-hidden="true" />
                    {activity.commentCount} {activity.commentCount === 1 ? 'comment' : 'comments'}
                </Link>
            </footer>
        </article>
    );
}
