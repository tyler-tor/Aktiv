import React from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router';
import { deleteRoute } from '../../store/routes'
import { useToast } from '../../context/Toast';
import ConfirmForm from '../ui/ConfirmForm';

function DeleteMapForm({routeId, onClose}) {
  const dispatch = useDispatch()
  const navigate = useNavigate();
  const toast = useToast();

  const destroyRoute = async () => {
    const res = await dispatch(deleteRoute(routeId))
    if (res && res.ok === false) return ['The route could not be deleted. Try again.']
    toast.success('Route deleted')
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
