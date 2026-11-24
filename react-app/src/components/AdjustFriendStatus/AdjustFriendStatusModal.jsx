import React, { useState } from 'react'
import { FiUserPlus, FiUserCheck } from 'react-icons/fi';
import { Modal } from '../../context/Modal'
import AdjustFriendStatusAlert from './AdjustFriendStatusAlert';

function AdjustFriendStatusModal({ userId, status, setStatus, setLoading, name }) {
    const [showModal, setShowModal] = useState(false);

    return (
        <>
            <button type='button' className={`btn btn--sm ${status ? 'btn--secondary' : 'btn--primary'}`}
                onClick={() => setShowModal(true)}>
                {status ? <FiUserCheck aria-hidden='true' /> : <FiUserPlus aria-hidden='true' />}
                {status ? 'Friends' : 'Add friend'}
            </button>
            {showModal && (
                <Modal onClose={() => setShowModal(false)}>
                    <AdjustFriendStatusAlert userId={userId} status={status} setStatus={setStatus} setLoading={setLoading}
                    name={name} onClose={() => setShowModal(false)} />
                </Modal>
            )}
        </>
    )
}

export default AdjustFriendStatusModal
