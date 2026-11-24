import React, { useState} from 'react'
import { Modal } from '../../context/Modal'
import EditMapForm from './EditMapForm'

function EditMapModal({route}) {
    const [showModal, setShowModal] = useState(false)

    return (
        <>
            <button type='button' className='btn btn--secondary btn--sm'
            onClick={() => setShowModal(true)}>Edit</button>
            {showModal && (<Modal onClose={() => setShowModal(false)}>
                <EditMapForm route={route}
                onClose={() => setShowModal(false)} />
            </Modal>)}
        </>

    )
}

export default EditMapModal
