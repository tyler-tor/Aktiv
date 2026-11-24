import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { updateComment, deleteComment } from '../../store/comments';

const EditCommentForm = ({ onClose, commentId }) => {
  const [errors, setErrors] = useState([]);
  const comment = useSelector((state) => state.comments[commentId]?.body);
  const [commentInput, setCommentInput] = useState(comment || '');
  const [busy, setBusy] = useState(false);
  const dispatch = useDispatch();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true)
    const res = await dispatch(updateComment({ body: commentInput, commentId }))
    if (res) {
      setErrors(res)
      setBusy(false)
    } else {
      onClose()
    }
  };

  const destroyComment = async () => {
    setBusy(true)
    await dispatch(deleteComment(commentId));
    onClose()
  };

  return (
    <form onSubmit={handleSubmit} className='form dialog'>
      <h2 className='dialog__title'>Edit comment</h2>
      <div className='form-errors' role='alert'>
        {errors.map((error) => (<p key={error} className='form-error'>{error}</p>))}
      </div>
      <div className='field'>
        <label htmlFor='edit-comment'>Comment</label>
        <textarea id='edit-comment' required maxLength={500} className='textarea' value={commentInput}
          onChange={(e) => { setCommentInput(e.target.value); setErrors([]) }} />
      </div>
      <div className='btn-row dialog__actions'>
        <button type='button' onClick={destroyComment} className='btn btn--danger-outline' disabled={busy}>Delete</button>
        <button type='button' className='btn btn--secondary' onClick={onClose} disabled={busy}>Cancel</button>
        <button type='submit' className='btn btn--primary' disabled={busy || !commentInput.trim()}>{busy ? 'Saving...' : 'Save'}</button>
      </div>
    </form>
  );
};

export default EditCommentForm;
