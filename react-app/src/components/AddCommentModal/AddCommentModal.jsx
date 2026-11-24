import React, { useState } from 'react'
import { Modal } from '../../context/Modal';
import AddCommentForm from '../AddCommentForm/AddCommentForm';

function AddCommentModal({ id, kind = 'route' }) {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <button className='btn btn--secondary btn--sm' type='button'
        onClick={() => setShowModal(true)}>Add comment</button>
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <AddCommentForm id={id} kind={kind} onClose={() => setShowModal(false)} />
        </Modal>
      )}
    </>
  )
}

export default AddCommentModal
