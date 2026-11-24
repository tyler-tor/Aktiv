import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router';
import ImageUploadComponent from '../ImageUploadComponenet';
import { addWorkout } from '../../store/workouts';
import { useUnits } from '../../context/Units';
import { unitToMeters } from '../../utils/format';
import usePageTitle from '../../hooks/usePageTitle';
import '../ui/Forms.css'

function NewWorkout() {
    const currUser = useSelector(state => state.session.user);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    usePageTitle('Log a workout');

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
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!url) {
            setErrors(['Upload a picture for the workout first.'])
            return
        }

        const payload = {
            user_id: currUser.id,
            title: title,
            description: description,
            type: type,
            duration_s: Math.round(Number(hour || 0) * 3600 + Number(minute || 0) * 60),
            distance_m: unitToMeters(distance, distanceMeasurement === 'miles' ? 'mi' : 'km'),
            image_url: url
        }

        setSaving(true)
        const data = await dispatch(addWorkout(payload));
        setSaving(false)

        if (data) {
            setErrors(data)
        } else {
            navigate('/activity')
        }
    }

    return (
        <div className='page page--narrow new'>
            <header className='new__head'>
                <h1 className='new__title'>Log a workout</h1>
                <p className='page-lead'>Add what you did. Pace or speed is worked out for you.</p>
            </header>
            <form className='form card' onSubmit={handleSubmit}>
                <div className='form-errors' role='alert'>
                    {errors.map((error, ind) => (<p key={ind} className='form-error'>{error}</p>))}
                </div>
                <div className='field'>
                    <span className='field-label' id='nw-pic-label'>Picture</span>
                    <ImageUploadComponent setUrl={(u) => { setUrl(u); setErrors([]) }} labelledBy='nw-pic-label' />
                    {url && <p className='field-hint'>Picture uploaded.</p>}
                </div>
                <div className='field'>
                    <label htmlFor='nw-title'>Title</label>
                    <input id='nw-title' type='text' required className='input' value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className='field'>
                    <label htmlFor='nw-desc'>Description</label>
                    <textarea id='nw-desc' required className='textarea' value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div className='field'>
                    <label htmlFor='nw-type'>Type</label>
                    <select id='nw-type' required className='select' value={type} onChange={(e) => setType(e.target.value)}>
                        <option value='' disabled>Choose a type</option>
                        <option>Walk</option>
                        <option>Run</option>
                        <option>Hike</option>
                        <option>Bike</option>
                    </select>
                </div>
                <fieldset className='field fieldset'>
                    <legend className='field-label'>Time</legend>
                    <div className='field-row'>
                        <div className='field'>
                            <label htmlFor='nw-hour' className='field-hint'>Hours</label>
                            <input id='nw-hour' type='number' min='0' required className='input' value={hour} onChange={(e) => setHour(e.target.value)} />
                        </div>
                        <div className='field'>
                            <label htmlFor='nw-min' className='field-hint'>Minutes</label>
                            <input id='nw-min' type='number' min='0' max='59' required className='input' value={minute} onChange={(e) => setMinute(e.target.value)} />
                        </div>
                    </div>
                </fieldset>
                <fieldset className='field fieldset'>
                    <legend className='field-label'>Distance</legend>
                    <div className='field-row'>
                        <div className='field'>
                            <label htmlFor='nw-dist' className='sr-only'>Distance</label>
                            <input id='nw-dist' type='number' min='0' step='any' required className='input' value={distance} onChange={(e) => setDistance(e.target.value)} />
                        </div>
                        <div className='field'>
                            <label htmlFor='nw-unit' className='sr-only'>Distance unit</label>
                            <select id='nw-unit' className='select' value={distanceMeasurement} onChange={(e) => setDistanceMeasurement(e.target.value)}>
                                <option value='miles'>miles</option>
                                <option value='kilometers'>kilometers</option>
                            </select>
                        </div>
                    </div>
                </fieldset>
                <button type='submit' className='btn btn--primary btn--block' disabled={saving}>{saving ? 'Saving...' : 'Save workout'}</button>
            </form>
        </div>
    )
}

export default NewWorkout
