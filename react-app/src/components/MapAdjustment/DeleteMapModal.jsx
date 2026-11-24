import React, { useState } from 'react'
import { Modal } from '../../context/Modal'
import DeleteMapForm from './DeleteMapForm'


function DeleteMapModal({ routeId }) {
    const [showModal, setShowModal] = useState(false)
    return (
        <>
            <button type='button' className='btn btn--danger-outline btn--sm'
                onClick={() => setShowModal(true)}>Delete</button>
            {showModal && (<Modal onClose={() => setShowModal(false)}>
                <DeleteMapForm routeId={routeId}
                    onClose={() => setShowModal(false)} />
            </Modal>)}
        </>
    )
}

export default DeleteMapModal
