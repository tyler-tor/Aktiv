import React, { useState } from 'react'
import { FiEdit2 } from 'react-icons/fi'
import { Modal } from '../../context/Modal'
import EditCommentForm from '../EditCommentForm/EditCommentForm'

function EditCommentModal({ commentId }) {
    const [showModal, setShowModal] = useState(false)

    return (
        <>
            <button type='button' className='icon-btn' aria-label='Edit comment' onClick={() => setShowModal(true)}>
                <FiEdit2 aria-hidden='true' />
            </button>
            {showModal && (
                <Modal onClose={() => setShowModal(false)}>
                    <EditCommentForm commentId={commentId} onClose={() => setShowModal(false)} />
                </Modal>
            )}
        </>
    )
}

export default EditCommentModal
