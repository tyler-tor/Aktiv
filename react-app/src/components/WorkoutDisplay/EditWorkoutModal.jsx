import React, { useState } from 'react';
import { Modal } from '../../context/Modal';
import EditWorkoutForm from './EditWorkoutForm';

function EditWorkoutModal({ workout }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button type='button' className='btn btn--secondary btn--sm' onClick={() => setShowModal(true)}>
        Edit
      </button>
      {showModal && (<Modal onClose={() => setShowModal(false)}>
        <EditWorkoutForm workout={workout}
          onClose={() => setShowModal(false)} />
      </Modal>)}
    </>
  )
}

export default EditWorkoutModal
