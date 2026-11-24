import React, { useState } from 'react'
import { Modal } from '../../context/Modal';
import AddCommentForm from '../AddCommentForm/AddCommentForm';
import '../auth/Buttons.css'

function AddCommentModal({ id, kind = 'route' }) {
  const [showModal, setShowModal] = useState(false)

  return (
    <div className='add-btn-container'>
      <button className={'btn btn--outline btn--medium'}
        type='submit'
        onClick={() => setShowModal(true)}>Add Comment</button>
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <AddCommentForm
            id={id}
            kind={kind}
            onClose={() => setShowModal(false)}
          />
        </Modal>
      )}
    </div>
  )
}

export default AddCommentModal
