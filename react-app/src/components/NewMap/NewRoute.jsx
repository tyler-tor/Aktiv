import React, { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router';
import { addRoute } from '../../store/routes'
import ImageUploadComponent from '../ImageUploadComponenet';
import { GoogleMap, Marker } from '@react-google-maps/api';
import { useDistanceMatrix } from '../../hooks/useDirections';
import { useGoogleMaps } from '../../context/GoogleMaps';
import { useUnits } from '../../context/Units'
import { formatDuration } from '../../utils/format'
import { useToast } from '../../context/Toast'
import usePageTitle from '../../hooks/usePageTitle'
import '../ui/Forms.css'

const center = {
  lat: 37.090240,
  lng: -95.712891
};

function NewRoute() {
  const currUser = useSelector(state => state.session.user)
  const dispatch = useDispatch()
  const navigate = useNavigate();
  const [allowStart, setAllowStart] = useState(false)
  const [allowEnd, setAllowEnd] = useState(false)
  const [start, setStart] = useState(null)
  const [end, setEnd] = useState(null)
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const { distance: fmtDistance } = useUnits()
  usePageTitle('Plan a route')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [url, setUrl] = useState('');
  const [travelingMode, setTravelingMode] = useState('')
  // Google's Distance Matrix answer (metres and seconds), requested once per change of points/mode
  const matrix = useDistanceMatrix(start, end, travelingMode)
  const distance = matrix ? matrix.distanceM : null
  const duration = matrix ? matrix.durationS : null

  const { isLoaded } = useGoogleMaps();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if(!start && !end) {
      setErrors(['You need to set a Start and End point'])
    }else if (!start) {
      setErrors(['You need to set a Start Point'])
    }else if (!end) {
      setErrors(['You need to set a End Point'])
    }else if (!url) {
      setErrors(['You need to upload a image for your route'])
    }else {

      if(errors.length < 1){
        const payload = {
          user_id: currUser.id,
          title: title,
          description: description,
          start_lat: parseFloat(start.lat),
          start_lng: parseFloat(start.lng),
          end_lat: parseFloat(end.lat),
          end_lng: parseFloat(end.lng),
          traveling_mode: travelingMode,
          distance_m: distance,
          duration_s: duration,
          image_url: url
        }

        setSaving(true)
        const data = await dispatch(addRoute(payload))
        setSaving(false)
        if (data) {
          setErrors(data)
        }else {
          toast.success('Route saved')
          navigate('/routes')
        }
      }
    }
  }

  const handleMarkerSet = (e) => {
    if (allowStart === true) {
      setStart({ lat: e.latLng.lat(), lng: e.latLng.lng() })
    }
    if (allowEnd === true) {
      setEnd({ lat: e.latLng.lat(), lng: e.latLng.lng() })
    }
  }

  useEffect(() => {
    setErrors([])
  }, [start, end, url])

  const placing = allowStart ? 'start' : allowEnd ? 'end' : null
  const hint = placing === 'start' ? 'Click the map to place the start.'
    : placing === 'end' ? 'Click the map to place the finish.'
    : 'Choose Set start or Set finish, then click the map. Drag a pin to adjust it.'

  return (
    <div className='page new'>
      <header className='new__head'>
        <h1 className='new__title'>Plan a route</h1>
        <p className='page-lead'>Place a start and a finish. Distance and time are worked out for you.</p>
      </header>
      <div className='new__grid'>
        <section className='new__map-col' aria-label='Route map'>
          <div className='segmented' role='group' aria-label='Which pin to place'>
            <button type='button' aria-pressed={allowStart}
              onClick={() => { setAllowStart(true); setAllowEnd(false) }}>Set start{start ? ' (placed)' : ''}</button>
            <button type='button' aria-pressed={allowEnd}
              onClick={() => { setAllowEnd(true); setAllowStart(false) }}>Set finish{end ? ' (placed)' : ''}</button>
          </div>
          <p className='field-hint' role='status'>{hint}</p>
          <div className='media'>
            {isLoaded ?
              <GoogleMap
                zoom={4}
                center={center}
                mapContainerClassName='new__map'
                options={{ streetViewControl: false, mapTypeControl: false }}
                onClick={(e) => handleMarkerSet(e)}
              >
                <Marker position={start} draggable={true} title='Start'
                  onDragEnd={(e) => setStart({ lat: e.latLng.lat(), lng: e.latLng.lng() })} />
                <Marker position={end} draggable={true} title='Finish'
                  onDragEnd={(e) => setEnd({ lat: e.latLng.lat(), lng: e.latLng.lng() })} />
              </GoogleMap>
              : <div className='skeleton new__map' role='status'>Loading map...</div>
            }
          </div>
          {matrix && (
            <p className='new__result'>
              <strong>{fmtDistance(matrix.distanceM)}</strong> in about <strong>{formatDuration(matrix.durationS)}</strong>
            </p>
          )}
        </section>
        <form className='form card new__form' onSubmit={handleSubmit}>
          <div className='form-errors' role='alert'>
            {errors.map((error, ind) => (<p key={ind} className='form-error'>{error}</p>))}
          </div>
          <div className='field'>
            <span className='field-label' id='nr-pic-label'>Cover picture</span>
            <ImageUploadComponent setUrl={setUrl} labelledBy='nr-pic-label' />
            {url && <p className='field-hint'>Picture uploaded.</p>}
          </div>
          <div className='field'>
            <label htmlFor='nr-title'>Title</label>
            <input id='nr-title' type='text' required className='input' value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className='field'>
            <label htmlFor='nr-desc'>Description</label>
            <textarea id='nr-desc' required className='textarea' value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className='field'>
            <label htmlFor='nr-mode'>Travel mode</label>
            <select id='nr-mode' required className='select' value={travelingMode} onChange={(e) => setTravelingMode(e.target.value)}>
              <option value='' disabled>Choose how you will travel</option>
              <option value='WALKING'>Walking</option>
              <option value='BICYCLING'>Cycling</option>
            </select>
          </div>
          <button type='submit' className='btn btn--primary btn--block' disabled={saving}>{saving ? 'Saving...' : 'Save route'}</button>
        </form>
      </div>
    </div>
  )
}

export default NewRoute
