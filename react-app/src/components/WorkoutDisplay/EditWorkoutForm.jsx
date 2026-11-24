import React, { useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { updateWorkout } from '../../store/workouts'
import { useUnits } from '../../context/Units'
import { metersToUnit, unitToMeters } from '../../utils/format'

function EditWorkoutForm({ workout, onClose }) {
  const currUser = useSelector(state => state.session.user);
  const dispatch = useDispatch();
  const [errors, setErrors] = useState([]);
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

    const res = await dispatch(updateWorkout(payload))
    if (res) {
      setErrors(res)
    } else {
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
    <div className='edit-workout-form-wrapper'>
      <div className='ewf-container'>
        <form className='ewf-form'
          onSubmit={handleSubmit}>
      <div className='ewf-item'>
        {errors.map((error, ind) => (
          <div key={ind} className='error-message'>{error}</div>
        ))}
      </div>
          <div className='ewf-item'>
            <label className='ewf-label'>Workout Title: </label>
            <input
              type='text'
              placeholder='title'
              required
              value={title}
              className='ewf-input'
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className='ewf-item'>
            <label className='ewf-label'>Workout Description: </label>
            <textarea
              type='text'
              placeholder='description'
              required
              value={description}
              className='ewf-input-ta'
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className='ewf-item'>
            <label className='ewf-label'>Workout Type: </label>
            <select
              name='type'
              value={type}
              className='ewf-input'
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
              <option>Cardio</option>
              <option>Weight</option>
            </select>
          </div>
          <div className='ewf-item'>
            <label className='ewf-label'>Workout Duration: </label>
            <input
              type='number'
              placeholder='hour'
              required
              value={hour}
              className='ewf-input'
              onChange={(e) => setHour(e.target.value)}
            />
            <input
              type='number'
              placeholder='minute'
              required
              value={minute}
              className='ewf-input'
              onChange={(e) => setMinute(e.target.value)}
            />
          </div>
          <div className='ewf-item'>
            <label className='ewf-label'>Workout Distance: </label>
            <input
              type='number'
              placeholder='distance'
              required
              value={distance}
              className='ewf-input'
              onChange={(e) => setDistance(e.target.value)}
            />
            <select
              name='type'
              value={distanceMeasurement}
              className='ewf-input'
              required
              onChange={(e) => changeMeasurement(e.target.value)}
            >
              <option value='' disabled>
                Select a distance measurement...
              </option>
              <option>miles</option>
              <option>kilometers</option>
            </select>
          </div>
          <div className='ewf-item'>
          <button type='submit' className='update-btn'>Edit Workout</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditWorkoutForm
