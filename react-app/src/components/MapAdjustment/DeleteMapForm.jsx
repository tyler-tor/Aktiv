import React from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router';
import { deleteRoute } from '../../store/routes'
import ConfirmForm from '../ui/ConfirmForm';

function DeleteMapForm({routeId, onClose}) {
  const dispatch = useDispatch()
  const navigate = useNavigate();

  const destroyRoute = async () => {
    await dispatch(deleteRoute(routeId))
    onClose()
    navigate('/routes')
  }
  return (
    <ConfirmForm title='Delete this route?' danger confirmLabel='Delete route'
      message='The route and its comments will be removed for good.'
      onConfirm={destroyRoute} onClose={onClose} />
  )
}

export default DeleteMapForm
