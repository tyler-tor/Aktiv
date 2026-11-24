import React, { useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Link } from 'react-router'
import { FiMessageSquare } from 'react-icons/fi'
import { getRouteComments, getWorkoutComments } from '../../store/comments'
import EditCommentModal from '../EditComment/EditCommentModal';
import AddCommentModal from '../AddCommentModal/AddCommentModal';
import Avatar from '../ui/Avatar';
import './Comments.css';

// Comments under a route (kind='route', the default) or a workout (kind='workout').
function Comments({ id, kind = 'route' }) {
    const [isLoaded, setIsLoaded] = useState(false);
    const comments = Object.values(useSelector(state => state.comments)).reverse()
    const currUser = useSelector(state => state.session.user)
    const dispatch = useDispatch()

    useEffect(() => {
        let cancelled = false
        setIsLoaded(false)
        Promise.resolve(dispatch(kind === 'workout' ? getWorkoutComments(id) : getRouteComments(id)))
            .finally(() => { if (!cancelled) setIsLoaded(true) })
        return () => { cancelled = true }
    }, [dispatch, id, kind])

    return (
        <div className='comments'>
            <div className='comments__head'>
                <h2 id='comments-h' className='comments__title'>
                    Comments {isLoaded && <span className='comments__count'>{comments.length}</span>}
                </h2>
                <AddCommentModal id={id} kind={kind} />
            </div>
            {!isLoaded && <div className='skeleton comments__skeleton' role='status'><span className='sr-only'>Loading comments</span></div>}
            {isLoaded && comments.length === 0 && (
                <div className='comments__empty'>
                    <FiMessageSquare aria-hidden='true' size={24} />
                    <p>No comments yet. Say something encouraging.</p>
                </div>
            )}
            {isLoaded && comments.length > 0 && (
                <ul className='comments__list'>
                    {comments.map(comment => (
                        <li className='comment' key={comment.id}>
                            <Avatar user={comment.user} size='sm' />
                            <div className='comment__body'>
                                <Link to={`/users/${comment.userId}`} className='comment__author'>{comment.user.username}</Link>
                                <p className='comment__text'>{comment.body}</p>
                            </div>
                            {currUser.id === comment.userId && <EditCommentModal commentId={comment.id} />}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

export default Comments
