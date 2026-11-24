import React from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router';
import { deleteWorkout } from '../../store/workouts';
import ConfirmForm from '../ui/ConfirmForm';

function DeleteWorkoutForm({workoutId, onClose}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const destroyWorkout = async () => {
    await dispatch(deleteWorkout(workoutId));
    onClose();
    navigate('/activity');
  }

  return (
    <ConfirmForm title='Delete this workout?' danger confirmLabel='Delete workout'
      message='The workout and its comments will be removed for good.'
      onConfirm={destroyWorkout} onClose={onClose} />
  )
}

export default DeleteWorkoutForm
