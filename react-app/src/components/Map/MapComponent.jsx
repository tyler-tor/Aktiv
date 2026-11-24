import { GoogleMap, Marker, InfoWindow } from "@react-google-maps/api";
import { useGoogleMaps } from "../../context/GoogleMaps";
import React, { useMemo, useState } from "react";
import { NavLink } from "react-router";
import { useEffect } from "react";
import { useSelector, useDispatch } from 'react-redux'
import { getAllRoutes } from "../../store/routes";
import { useUnits } from "../../context/Units";
import './MapComponent.css'

const containerStyle = {
    width: '100vw',
    height: '84vh'
};


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
            <div id='map'>
                <GoogleMap
                    mapContainerStyle={containerStyle}
                    zoom={4}
                    center={center}
                    mapContainerClassName='map-container'
                    >
                    {routes && routes.map(route => {
                        return (
                        <div key={route.id}>
                            {route.startingPoint && <Marker position={{...route.startingPoint}}
                            onClick={() => {
                                setSelected({'coord':{...route.startingPoint}, 'route': route})
                            }}
                            />}
                        </div>
                        )
                    })}
                    
                    {selected ? (
                        <InfoWindow position={{lat: selected.coord.lat, lng: selected.coord.lng}}
                        onCloseClick={() => {
                            setSelected(null)
                        }}>
                            <div className="iw-container">
                                <p>Click title to view Route...</p>
                                <NavLink to={`/routes/${selected.route.id}`}
                                className='iw-title'>{selected.route.title}</NavLink>
                                <p className="iw-description">{selected.route.description}</p>
                                <p className="iw-description">{distance(selected.route.distanceM)}</p>
                            </div>
                        </InfoWindow>
                    ) : null}
                </GoogleMap>
            </div>
        </>
    ) : <div className="loading-text">Loading....</div>;
}

export default React.memo(MapComponent)
