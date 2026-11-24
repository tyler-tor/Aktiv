import React, { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { updateRoute } from '../../store/routes';
import { GoogleMap, Marker } from '@react-google-maps/api';
import { useDistanceMatrix } from '../../hooks/useDirections';
import { useGoogleMaps } from '../../context/GoogleMaps';
import './MapAdjustment.css'


function EditMapForm({ route, onClose }) {
    const currUser = useSelector(state => state.session.user)
    const dispatch = useDispatch()
    const [start, setStart] = useState({ ...route?.startingPoint })
    const [end, setEnd] = useState({ ...route?.endingPoint })
    const [errors, setErrors] = useState([]);
    const [title, setTitle] = useState(route?.title)
    const [description, setDescription] = useState(route?.description)
    const [travelingMode, setTravelingMode] = useState(route?.travelMode)
    // metres / seconds; recalculated by Google's Distance Matrix only when the points or mode change
    const matrix = useDistanceMatrix(start, end, travelingMode)
    const distance = matrix ? matrix.distanceM : route?.distanceM
    const duration = matrix ? matrix.durationS : route?.durationS

    const { isLoaded } = useGoogleMaps();

    const center = {
        lat: (route?.startingPoint.lat + route?.endingPoint.lat) / 2,
        lng: (route?.startingPoint.lng + route?.endingPoint.lng) / 2
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const payload = {
            id: route.id,
            user_id: currUser.id,
            title: title,
            description: description,
            start_lat: start.lat,
            start_lng: start.lng,
            end_lat: end.lat,
            end_lng: end.lng,
            traveling_mode: travelingMode,
            distance_m: distance,
            duration_s: duration,
            image_url: route.imageUrl
        }
        const res = await dispatch(updateRoute(payload))
        if (res) {
            setErrors(res)
        } else {
            onClose()
        }
    }


    useEffect(() => {
        setErrors([])
    }, [title, description, travelingMode])

    if (!route) {
        return null
    }

    return (
        <div className='edit-map-form-container'>
            <div className='emf-mapadjust-container'>
                <div className='errors-container'>
                    {errors.map((error, ind) => (
                        <div key={ind} className='error-message'>{error}</div>
                    ))}
                </div>
                <div className='emf-mapadjust'>
                    {isLoaded ?
                        <>
                            <div id='map'>
                                <GoogleMap
                                    zoom={6}
                                    center={center}
                                    mapContainerClassName='emf-map-container'
                                >
                                    {route && (
                                        <>
                                            <Marker
                                                position={start}
                                                draggable={true}
                                                onDragEnd={(e) =>setStart({ lat: e.latLng.lat(), lng: e.latLng.lng() })}
                                                title='Start Point'>
                                            </Marker >
                                            <Marker
                                                position={end}
                                                draggable={true}
                                                onDragEnd={(e) => setEnd({ lat: e.latLng.lat(), lng: e.latLng.lng() })}
                                                title='End Point'
                                            >
                                            </Marker >
                                        </>
                                    )
                                    }
                                </GoogleMap>
                            </div>
                        </>
                        :
                        <div className="loading-text">Loading....</div>
                    }
                </div>
                <div className='emf-form-container'>
                    <form className='emf-form'
                        onSubmit={handleSubmit}>
                        <div className='emf-item-container'>
                            <label className='emf-label'>Update Title: </label>
                            <input
                                type='text'
                                placeholder='title'
                                required
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className='emf-input'
                            />
                        </div>
                        <div className='emf-item-container'>
                            <label className='emf-label'>Update Description: </label>
                            <textarea
                                type='text'
                                placeholder='description'
                                required
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className='emf-input'
                            />
                        </div>
                        <div className='emf-item-container'>
                            <label className='emf-label'>Update Travel Mode: </label>
                            <select
                                name='travelMode'
                                value={travelingMode}
                                onChange={(e) => setTravelingMode(e.target.value)}
                                className='emf-input'
                            >
                                <option>WALKING</option>
                                <option>BICYCLING</option>
                            </select>
                        </div>
                        <div className='emf-item-container'>
                            <button type='submit' className='update-btn'>Update Route</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default EditMapForm
