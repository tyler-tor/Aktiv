import React, { useState } from 'react';
import { Modal } from '../../context/Modal';
import DeleteWorkoutForm from './DeleteWorkoutForm'

function DeleteWorkoutModal({workoutId}) {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <button type='button' className='btn btn--danger-outline btn--sm'
        onClick={() => setShowModal(true)}>Delete</button>
      {showModal && (<Modal onClose={() => setShowModal(false)}>
        <DeleteWorkoutForm workoutId={workoutId}
          onClose={() => setShowModal(false)} />
      </Modal>)}
    </>
  )
}

export default DeleteWorkoutModal
