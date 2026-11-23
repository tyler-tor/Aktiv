import React from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router';
import { deleteRoute } from '../../store/routes'
import './MapAdjustment.css'

function DeleteMapForm({routeId, onClose}) {
  const dispatch = useDispatch()
  const navigate = useNavigate();

  const destroyRoute = async (e) => {
    e.preventDefault();
    const data = await dispatch(deleteRoute(routeId)).then(() => {
      navigate('/')
    })
    if(data) {

    }
    navigate('/')
    onClose()
  }
  return (
    <div className='dlt-route-container'>
      <strong className='dlt-route-label'>
        Are you sure you want to delete?
      </strong>
      <button className='dlt-route-btn'
      onClick={destroyRoute}>DELETE</button>
    </div>
  )
}

export default DeleteMapForm
