import React, { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { updateRoute } from '../../store/routes';
import { GoogleMap, Marker } from '@react-google-maps/api';
import { useDistanceMatrix } from '../../hooks/useDirections';
import { useGoogleMaps } from '../../context/GoogleMaps';


function EditMapForm({ route, onClose }) {
    const currUser = useSelector(state => state.session.user)
    const dispatch = useDispatch()
    const [start, setStart] = useState({ ...route?.startingPoint })
    const [end, setEnd] = useState({ ...route?.endingPoint })
    const [errors, setErrors] = useState([]);
    const [saving, setSaving] = useState(false);
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
        setSaving(true)
        const res = await dispatch(updateRoute(payload))
        setSaving(false)
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
        <div className='dialog dialog--wide'>
            <h2 className='dialog__title'>Edit route</h2>
            <p className='dialog__text'>Drag the pins to change the start or finish.</p>
            <div className='edit-map'>
                {isLoaded
                    ? <GoogleMap zoom={6} center={center} mapContainerClassName='edit-map__map'>
                        <Marker position={start} draggable={true} title='Start'
                            onDragEnd={(e) => setStart({ lat: e.latLng.lat(), lng: e.latLng.lng() })} />
                        <Marker position={end} draggable={true} title='Finish'
                            onDragEnd={(e) => setEnd({ lat: e.latLng.lat(), lng: e.latLng.lng() })} />
                    </GoogleMap>
                    : <div className='skeleton edit-map__map' role='status'>Loading map...</div>}
            </div>
            <form className='form' onSubmit={handleSubmit}>
                <div className='form-errors' role='alert'>
                    {errors.map((error, ind) => (<p key={ind} className='form-error'>{error}</p>))}
                </div>
                <div className='field'>
                    <label htmlFor='em-title'>Title</label>
                    <input id='em-title' type='text' required className='input' value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className='field'>
                    <label htmlFor='em-desc'>Description</label>
                    <textarea id='em-desc' required className='textarea' value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div className='field'>
                    <label htmlFor='em-mode'>Travel mode</label>
                    <select id='em-mode' className='select' value={travelingMode} onChange={(e) => setTravelingMode(e.target.value)}>
                        <option value='WALKING'>Walking</option>
                        <option value='BICYCLING'>Cycling</option>
                    </select>
                </div>
                <div className='btn-row dialog__actions'>
                    <button type='button' className='btn btn--secondary' onClick={onClose} disabled={saving}>Cancel</button>
                    <button type='submit' className='btn btn--primary' disabled={saving}>{saving ? 'Saving...' : 'Save route'}</button>
                </div>
            </form>
        </div>
    )
}

export default EditMapForm
