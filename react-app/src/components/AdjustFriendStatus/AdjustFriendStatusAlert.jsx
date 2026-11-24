import React from 'react'
import { useDispatch } from 'react-redux'
import { addFriend, deleteFriend } from '../../store/friends';
import ConfirmForm from '../ui/ConfirmForm';

function AdjustFriendStatusAlert({ userId, status, setStatus, onClose, setLoading, name }) {
  const dispatch = useDispatch();

  const submit = async () => {
    const res = await dispatch(status ? deleteFriend(userId) : addFriend(userId))
    if (res && res.errors) {
      return res.errors
    }
    setStatus(!status)
    onClose()
    setLoading(true)
  }

  return (
    <ConfirmForm
      title={status ? `Remove ${name || 'this person'} from friends?` : `Add ${name || 'this person'} as a friend?`}
      message={status ? 'Their activity will no longer show in your Friends feed.' : 'Their routes and workouts will show in your Friends feed.'}
      confirmLabel={status ? 'Remove friend' : 'Add friend'} danger={status}
      onConfirm={submit} onClose={onClose} />
  )
}

export default AdjustFriendStatusAlert
