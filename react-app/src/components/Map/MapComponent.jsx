import { GoogleMap, InfoWindow } from "@react-google-maps/api";
import MapMarker from "../ui/MapMarker";
import { GOOGLE_MAPS_MAP_ID } from "../../config";
import { useGoogleMaps } from "../../context/GoogleMaps";
import React, { useMemo, useState } from "react";
import { Link } from "react-router";
import { useEffect } from "react";
import { useSelector, useDispatch } from 'react-redux'
import { getAllRoutes } from "../../store/routes";
import { useUnits } from "../../context/Units";
import './MapComponent.css'

const containerStyle = { width: '100%', height: '100%' };
const MAP_OPTIONS = { mapId: GOOGLE_MAPS_MAP_ID, streetViewControl: false, mapTypeControl: false };


const MapComponent = ({ lat, lng }) => {
    const dispatch = useDispatch()
    const { distance } = useUnits();
    const routes = Object.values(useSelector(state => state.routes.routes ? state.routes.routes : {}));
    const [selected, setSelected] = useState(null)
    // true once the shared Google Maps script (context/GoogleMaps.jsx) is ready
    const { isLoaded } = useGoogleMaps();
    //sets the center of the map based on the lat,lng props that are passed
    const center = useMemo(() => {
        if (lat && lng) {
            return { lat, lng }
        }
    }, [lat, lng])

    useEffect(() => {
        (async () => {
            await dispatch(getAllRoutes())
        })()
    }, [dispatch])

    if (!routes) {
        return null
    }

    return routes && isLoaded ? (
        <>
            <div id='map' className='map-wrap'>
                <GoogleMap
                    mapContainerStyle={containerStyle}
                    zoom={4}
                    center={center}
                    mapContainerClassName='map-container'
                    options={MAP_OPTIONS}
                    >
                    {routes.map(route => route.startingPoint && (
                        <MapMarker key={route.id} position={route.startingPoint} title={`${route.title} (open details)`}
                            onClick={() => setSelected({ coord: { ...route.startingPoint }, route })} />
                    ))}

                    {selected ? (
                        <InfoWindow position={{lat: selected.coord.lat, lng: selected.coord.lng}}
                        onCloseClick={() => {
                            setSelected(null)
                        }}>
                            <div className="iw-container">
                                <Link to={`/routes/${selected.route.id}`} className='iw-title'>{selected.route.title}</Link>
                                <p className="iw-meta">{distance(selected.route.distanceM)}</p>
                                <p className="iw-description">{selected.route.description}</p>
                            </div>
                        </InfoWindow>
                    ) : null}
                </GoogleMap>
            </div>
        </>
    ) : <div className="map-loading skeleton" role="status">Loading map...</div>;
}

export default React.memo(MapComponent)
