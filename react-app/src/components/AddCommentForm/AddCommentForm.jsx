import React, { useState } from 'react'
import { useDispatch } from 'react-redux';
import { newRouteComment, newWorkoutComment } from '../../store/comments';

function AddCommentForm({ onClose, id, kind = 'route' }) {
    const [errors, setErrors] = useState([]);
    const [commentInput, setCommentInput] = useState('');
    const [busy, setBusy] = useState(false);
    const dispatch = useDispatch();

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = kind === 'workout'
            ? { body: commentInput, workoutId: id }
            : { body: commentInput, routeId: id }
        setBusy(true)
        const res = await dispatch(kind === 'workout' ? newWorkoutComment(payload) : newRouteComment(payload))
        if (res) {
            setErrors(res)
            setBusy(false)
        } else {
            onClose()
        }
    };

    return (
        <form onSubmit={handleSubmit} className='form dialog'>
            <h2 className='dialog__title'>Add a comment</h2>
            <div className='form-errors' role='alert'>
                {errors.map((error) => (<p key={error} className='form-error'>{error}</p>))}
            </div>
            <div className='field'>
                <label htmlFor='add-comment'>Comment</label>
                <textarea id='add-comment' required maxLength={500} className='textarea' value={commentInput}
                    onChange={(e) => { setCommentInput(e.target.value); setErrors([]) }} />
            </div>
            <div className='btn-row dialog__actions'>
                <button type='button' className='btn btn--secondary' onClick={onClose} disabled={busy}>Cancel</button>
                <button className='btn btn--primary' type='submit' disabled={busy || !commentInput.trim()}>{busy ? 'Posting...' : 'Post comment'}</button>
            </div>
        </form>
    )
}

export default AddCommentForm
