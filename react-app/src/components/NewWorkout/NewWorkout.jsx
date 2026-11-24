import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router';
import ImageUploadComponent from '../ImageUploadComponenet';
import { addWorkout } from '../../store/workouts';
import { useUnits } from '../../context/Units';
import { unitToMeters } from '../../utils/format';
import './NewWorkout.css'

function NewWorkout() {
    const currUser = useSelector(state => state.session.user);
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const [errors, setErrors] = useState([]);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState('');
    const [distance, setDistance] = useState('');
    const { unit } = useUnits();
    // distance unit select: 'miles' / 'kilometers' (starts at the saved km/mi preference)
    const [distanceMeasurement, setDistanceMeasurement] = useState(unit === 'mi' ? 'miles' : 'kilometers');
    const [hour, setHour] = useState('');
    const [minute, setMinute] = useState('');
    const [url, setUrl] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!url) setErrors(['A image is required to create a workout.'])

        if (errors.length < 1) {
            const payload = {
                user_id: currUser.id,
                title: title,
                description: description,
                type: type,
                duration_s: Math.round(Number(hour || 0) * 3600 + Number(minute || 0) * 60),
                distance_m: unitToMeters(distance, distanceMeasurement === 'miles' ? 'mi' : 'km'),
                image_url: url
            }

            const data = await dispatch(addWorkout(payload));

            if (data) {
                setErrors(data)
            } else {
                navigate('/activity')
            }
        }
    }

    useEffect(() => {
        setErrors([])
    }, [url])

    return (
        <div className='new-workout-wrapper'>
            <div className='errors-wrapper'>
                {errors.map((error, ind) => (
                    <div key={ind} className='error-message'>
                        {error}
                    </div>
                ))}
            </div>
            <div className='nw-form-wrapper'>
                <h2 className='nw-title'>Create a new workout!</h2>
                <div className='nwf-item'>
                    <label className='nwf-label'>Select Workout Picture: </label>
                    <ImageUploadComponent setUrl={setUrl} />
                </div>
                <form className='nw-form'
                    onSubmit={handleSubmit}>
                    {/* <div className='nwf-item'>
                    </div> */}
                    <div className='nwf-item'>
                        <label className='nwf-label'>Title: </label>
                        <input
                            type='text'
                            placeholder='title'
                            required
                            value={title}
                            className='nwf-input'
                            onChange={(e) => setTitle(e.target.value)}
                        />
                        <label className='nwf-label'> Description: </label>
                        <textarea
                            type='text'
                            placeholder='description'
                            required
                            value={description}
                            className='nwf-input-ta'
                            onChange={(e) => setDescription(e.target.value)}
                        />
                        <label className='nwf-label'>Type: </label>
                        <select
                            name='type'
                            value={type}
                            className='nwf-input'
                            required
                            onChange={(e) => setType(e.target.value)}
                        >
                            <option value='' disabled>
                                Select a workout type...
                            </option>
                            <option>Walk</option>
                            <option>Run</option>
                            <option>Hike</option>
                            <option>Bike</option>
                        </select>
                    </div>
                    {/* <div className='nwf-item'>
                    </div> */}
                    <div className='nwf-item'>
                        <label className='nwf-label'>Duration: </label>
                        <input
                            type='number'
                            placeholder='hour'
                            required
                            value={hour}
                            className='nwf-input'
                            onChange={(e) => setHour(e.target.value)}
                        />
                        <input
                            type='number'
                            placeholder='minute'
                            required
                            value={minute}
                            className='nwf-input'
                            onChange={(e) => setMinute(e.target.value)}
                        />
                        <label className='nwf-label'>Distance: </label>
                        <input
                            type='number'
                            placeholder='distance'
                            required
                            value={distance}
                            className='nwf-input'
                            onChange={(e) => setDistance(e.target.value)}
                        />
                        <select
                            name='type'
                            value={distanceMeasurement}
                            className='nwf-input'
                            required
                            onChange={(e) => setDistanceMeasurement(e.target.value)}
                        >
                            <option value='' disabled>
                                Select a distance measurement...
                            </option>
                            <option>miles</option>
                            <option>kilometers</option>
                        </select>
                    </div>
                    <div className='nwf-item'>
                        <button type='submit' className='update-btn'>Submit New Workout</button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default NewWorkout
