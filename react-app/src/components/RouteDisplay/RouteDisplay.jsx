import React, { useEffect, useMemo, useState } from 'react';
import { GoogleMap, Polyline, DirectionsRenderer } from '@react-google-maps/api';
import MapMarker from '../ui/MapMarker';
import { GOOGLE_MAPS_MAP_ID } from '../../config';
import { useGoogleMaps } from '../../context/GoogleMaps';
import { useParams } from 'react-router';
import { useSelector, useDispatch } from 'react-redux';
import { getCurrentRoute } from '../../store/routes';
import { Link } from 'react-router';
import Avatar from '../ui/Avatar';
import StatStrip from '../ui/StatStrip';
import RouteSketch from '../RouteSketch/RouteSketch';
import usePageTitle from '../../hooks/usePageTitle';
import Comments from '../Comments/Comments';
import MapAdjustment from '../MapAdjustment/MapAdjustment';
import { useUnits } from '../../context/Units';
import { activityLabel, formatDate, formatDuration } from '../../utils/format';
import { decodePolyline } from '../../utils/polyline';
import { useFallbackDirections } from '../../hooks/useDirections';
import { MAP_COLORS } from '../../theme';
import '../ui/Detail.css';

const DefaultCenter = {
    lat: 47.649133,
    lng: -117.420902
};

const MAP_OPTIONS = { mapId: GOOGLE_MAPS_MAP_ID, streetViewControl: false, mapTypeControl: false, fullscreenControl: true };
const POLYLINE_OPTIONS = { strokeColor: MAP_COLORS.route, strokeWeight: 5, strokeOpacity: 0.95 };


function RouteDisplay() {
    const { routeId } = useParams();
    const route = useSelector(state => state.routes.currentRoute)
    const currUser = useSelector(state => state.session.user)
    const [map, setMap] = useState(null)
    const [status, setStatus] = useState('loading')
    const dispatch = useDispatch()
    const { distance } = useUnits();
    const { isLoaded } = useGoogleMaps();
    usePageTitle(route && String(route.id) === String(routeId) ? route.title : 'Route');

    // Load this one route (it used to reload every route again after every
    // Directions answer, which could loop). Editing the route puts the updated
    // route into the store, so nothing else needs to refetch.
    useEffect(() => {
        let cancelled = false
        setStatus('loading')
        ;(async () => {
            try {
                await dispatch(getCurrentRoute(routeId))
                if (!cancelled) setStatus('done')
            } catch {
                if (!cancelled) setStatus('error')
            }
        })()
        return () => { cancelled = true }
    }, [dispatch, routeId])

    // The path comes from the server (A28): decode it once per route.
    const path = useMemo(() => decodePolyline(route?.polyline), [route?.polyline])

    // Only routes saved without a stored path ask Google (once) from the browser.
    const needsFallback = !!route && path.length < 2
    const fallback = useFallbackDirections(route?.startingPoint, route?.endingPoint, route?.travelMode, needsFallback)

    // Zoom the map to the route whenever it (or the map) changes.
    useEffect(() => {
        if (!map || !route || !window.google) return
        const bounds = new window.google.maps.LatLngBounds()
        const points = path.length >= 2 ? path : [route.startingPoint, route.endingPoint]
        points.forEach(point => bounds.extend(point))
        map.fitBounds(bounds, 48)
    }, [map, route, path])

    const current = route && String(route.id) === String(routeId) && route.ownerInfo ? route : null

    if (!current) {
        if (status === 'loading') {
            return <div className='page detail'><div className='skeleton detail__skeleton' role='status'><span className='sr-only'>Loading route</span></div></div>
        }
        return (
            <div className='page page--narrow'>
                <div className='empty-state'>
                    <h1>Route not found</h1>
                    <p>It may have been deleted, or the link is wrong.</p>
                    <Link to='/routes' className='btn btn--primary btn--sm'>Back to routes</Link>
                </div>
            </div>
        )
    }

    const dist = distance(current.distanceM).split(' ')
    const owner = current.ownerInfo

    return (
        <div className='page detail'>
            <header className='detail__head'>
                <div>
                    <p className='detail__owner'>
                        <Link to={`/users/${current.userId}`}><Avatar user={owner} size='sm' /> {owner.firstName} {owner.lastName}</Link>
                        <span className='chip'>{activityLabel(current.travelMode)}</span>
                        <time dateTime={current.createdAt}>{formatDate(current.createdAt)}</time>
                    </p>
                    <h1 className='detail__title'>{current.title}</h1>
                </div>
                {currUser.id === current.userId && <MapAdjustment route={current} />}
            </header>
            <div className='detail__grid'>
                <div className='detail__main'>
                    <div className='media'>
                        {isLoaded
                            ? <GoogleMap
                                zoom={10}
                                center={current.startingPoint || DefaultCenter}
                                mapContainerClassName='detail__map'
                                options={MAP_OPTIONS}
                                onLoad={setMap}
                                onUnmount={() => setMap(null)}
                            >
                                {path.length >= 2 && <Polyline path={path} options={POLYLINE_OPTIONS} />}
                                {fallback && <DirectionsRenderer options={{ directions: fallback, suppressMarkers: true }} />}
                                <MapMarker position={current.startingPoint} variant='start' title='Start' />
                                <MapMarker position={current.endingPoint} variant='end' title='Finish' />
                            </GoogleMap>
                            : <RouteSketch polyline={current.polyline} start={current.startingPoint} end={current.endingPoint} title={current.title} />}
                    </div>
                    <p className='detail__desc'>{current.description}</p>
                </div>
                <aside className='detail__side card'>
                    <StatStrip items={[
                        { label: 'Distance', value: dist[0], unit: dist.slice(1).join(' ') },
                        { label: 'Estimated time', value: current.durationS ? formatDuration(current.durationS) : '' },
                    ]} />
                    <ul className='detail__legend'>
                        <li><span className='dot dot--start' aria-hidden='true' /> Start</li>
                        <li><span className='dot dot--end' aria-hidden='true' /> Finish</li>
                    </ul>
                </aside>
            </div>
            <section className='detail__comments' id='comments' aria-labelledby='comments-h'>
                <Comments id={current.id} />
            </section>
        </div>
    )
}

export default RouteDisplay
