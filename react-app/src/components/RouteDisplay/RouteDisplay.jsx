import React, { useEffect, useMemo, useState } from 'react';
import { GoogleMap, Polyline, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { useGoogleMaps } from '../../context/GoogleMaps';
import { useParams } from 'react-router';
import { useSelector, useDispatch } from 'react-redux';
import { getCurrentRoute } from '../../store/routes';
import { NavLink } from 'react-router';
import Comments from '../Comments/Comments';
import MapAdjustment from '../MapAdjustment/MapAdjustment';
import { useUnits } from '../../context/Units';
import { formatDuration } from '../../utils/format';
import { decodePolyline } from '../../utils/polyline';
import { useFallbackDirections } from '../../hooks/useDirections';
import { MAP_COLORS } from '../../theme';
import './RouteDisplay.css';

const DefaultCenter = {
    lat: 47.649133,
    lng: -117.420902
};

const POLYLINE_OPTIONS = { strokeColor: MAP_COLORS.route, strokeWeight: 5, strokeOpacity: 0.95 };


function RouteDisplay() {
    const { routeId } = useParams();
    const route = useSelector(state => state.routes.currentRoute)
    const currUser = useSelector(state => state.session.user)
    const [map, setMap] = useState(null)
    const dispatch = useDispatch()
    const { distance } = useUnits();
    const { isLoaded } = useGoogleMaps();

    // Load this one route (it used to reload every route again after every
    // Directions answer, which could loop). Editing the route puts the updated
    // route into the store, so nothing else needs to refetch.
    useEffect(() => {
        dispatch(getCurrentRoute(routeId))
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

    // (also hides the previously viewed route while the new one is loading)
    if (!route || String(route.id) !== String(routeId)) {
        return null
    }

    return route.ownerInfo && (
        <div className='route-info-container'>
            <div className='route-map-info-container'>
                {isLoaded ?
                    <>
                        <div id='map'>
                            <GoogleMap
                                zoom={10}
                                center={route.startingPoint || DefaultCenter}
                                mapContainerClassName='route-map-container'
                                onLoad={setMap}
                                onUnmount={() => setMap(null)}
                            >
                                {path.length >= 2 && <Polyline path={path} options={POLYLINE_OPTIONS} />}
                                {fallback && <DirectionsRenderer options={{ directions: fallback, suppressMarkers: true }} />}
                                <Marker position={route.startingPoint} title='Start' />
                                <Marker position={route.endingPoint} title='Finish' />
                            </GoogleMap>
                        </div>
                    </>

                    :
                    <div className="loading-text">Loading....</div>
                }
            </div>
            <div className='ui-comment-container'>
                <div className='ur-info-container'>
                    <div className='user-details-container'>
                        <NavLink to={`/users/${route?.userId}`} className='username-text'>{route?.ownerInfo?.username}</NavLink>
                        <ul className='name-list'>
                            <li className='first-name'>
                                {route?.ownerInfo.firstName}
                            </li>
                            <li className='last-name'>
                                {route?.ownerInfo.lastName}
                            </li>
                        </ul>
                        <img src={route?.ownerInfo.profilePicture}
                        alt='owner'
                            className='user-propic' />
                        <div className='route-pic-container'>
                            <img src={route?.imageUrl}
                                alt='Route'
                                className='route-pic' />
                        </div>
                    </div>
                    <div className='ri-items-container'>
                        <ul className='ri-items-list'>
                            <li className='ri-item'>
                                <strong>Title: </strong>
                                {'   '}
                                <p>
                                    {route?.title}
                                </p>
                            </li>
                            <li className='ri-item'>
                                <strong>Description: </strong>
                                <p>
                                    {route?.description}
                                </p>
                            </li>
                            <li className='ri-item'>
                                <strong>Distance: </strong>
                                <p>
                                    {distance(route?.distanceM)}{route?.durationS ? ` (about ${formatDuration(route.durationS)})` : ''}
                                </p>
                            </li>
                            <li className='ri-item'>
                                <strong>Travel Type: </strong>
                                <p>
                                    {route?.travelMode}
                                </p>
                            </li>
                        </ul>
                        {currUser.id === route?.userId &&
                            <MapAdjustment route={route} />
                        }
                    </div>
                </div>
                <div className='comm-box-container'>
                    <div className='comments-container'>
                        <Comments id={route.id} />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default RouteDisplay
