import React, { useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { updateWorkout } from '../../store/workouts'
import { useToast } from '../../context/Toast'
import { useUnits } from '../../context/Units'
import { metersToUnit, unitToMeters } from '../../utils/format'

function EditWorkoutForm({ workout, onClose }) {
  const currUser = useSelector(state => state.session.user);
  const dispatch = useDispatch();
  const toast = useToast();
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(workout?.title)
  const [type, setType] = useState(workout?.type)
  const [description, setDescription] = useState(workout?.description);
  const { unit } = useUnits();
  const [distanceMeasurement, setDistanceMeasurement] = useState(unit === 'mi' ? 'miles' : 'kilometers');
  const [distance, setDistance] = useState(metersToUnit(workout.distanceM, unit));
  const [hour, setHour] = useState(Math.floor(workout.durationS / 3600));
  const [minute, setMinute] = useState(Math.round((workout.durationS % 3600) / 60));

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      id: workout.id,
      user_id: currUser.id,
      title: title,
      type: type,
      description: description,
      distance_m: unitToMeters(distance, distanceMeasurement === 'miles' ? 'mi' : 'km'),
      duration_s: Math.round(Number(hour || 0) * 3600 + Number(minute || 0) * 60),
      image_url: workout.imageUrl
    }

    setSaving(true)
    const res = await dispatch(updateWorkout(payload))
    setSaving(false)
    if (res) {
      setErrors(res)
    } else {
      toast.success('Workout updated')
      onClose()
    }
  }

  // Changing the unit select converts the number in the box, so the distance stays the same.
  const changeMeasurement = (next) => {
    const value = unitToMeters(distance, distanceMeasurement === 'miles' ? 'mi' : 'km');
    setDistanceMeasurement(next);
    setDistance(metersToUnit(value, next === 'miles' ? 'mi' : 'km'));
  };

  return (
    <div className='dialog dialog--wide'>
      <h2 className='dialog__title'>Edit workout</h2>
      <form className='form' onSubmit={handleSubmit}>
        <div className='form-errors' role='alert'>
          {errors.map((error, ind) => (<p key={ind} className='form-error'>{error}</p>))}
        </div>
        <div className='field'>
          <label htmlFor='ew-title'>Title</label>
          <input id='ew-title' type='text' required className='input' value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className='field'>
          <label htmlFor='ew-desc'>Description</label>
          <textarea id='ew-desc' required className='textarea' value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className='field'>
          <label htmlFor='ew-type'>Type</label>
          <select id='ew-type' className='select' required value={type} onChange={(e) => setType(e.target.value)}>
            <option>Walk</option>
            <option>Run</option>
            <option>Hike</option>
            <option>Bike</option>
            <option>Cardio</option>
            <option>Weight</option>
          </select>
        </div>
        <fieldset className='field fieldset'>
          <legend className='field-label'>Time</legend>
          <div className='field-row'>
            <div className='field'>
              <label htmlFor='ew-hour' className='field-hint'>Hours</label>
              <input id='ew-hour' type='number' min='0' required className='input' value={hour} onChange={(e) => setHour(e.target.value)} />
            </div>
            <div className='field'>
              <label htmlFor='ew-min' className='field-hint'>Minutes</label>
              <input id='ew-min' type='number' min='0' max='59' required className='input' value={minute} onChange={(e) => setMinute(e.target.value)} />
            </div>
          </div>
        </fieldset>
        <fieldset className='field fieldset'>
          <legend className='field-label'>Distance</legend>
          <div className='field-row'>
            <div className='field'>
              <label htmlFor='ew-dist' className='sr-only'>Distance</label>
              <input id='ew-dist' type='number' min='0' step='any' required className='input' value={distance} onChange={(e) => setDistance(e.target.value)} />
            </div>
            <div className='field'>
              <label htmlFor='ew-unit' className='sr-only'>Distance unit</label>
              <select id='ew-unit' className='select' value={distanceMeasurement} onChange={(e) => changeMeasurement(e.target.value)}>
                <option value='miles'>miles</option>
                <option value='kilometers'>kilometers</option>
              </select>
            </div>
          </div>
        </fieldset>
        <div className='btn-row dialog__actions'>
          <button type='button' className='btn btn--secondary' onClick={onClose} disabled={saving}>Cancel</button>
          <button type='submit' className='btn btn--primary' disabled={saving}>{saving ? 'Saving...' : 'Save workout'}</button>
        </div>
      </form>
    </div>
  )
}

export default EditWorkoutForm
