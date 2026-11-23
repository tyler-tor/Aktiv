import { createSlice } from '@reduxjs/toolkit';
import { csrfFetch } from './csrf';
const commentsSlice = createSlice({
    name: 'comments',
    initialState: {},
    reducers: {
        // Replaces the whole map with the comments of one route/workout.
        getComments(state, action) {
            const newState = {};
            action.payload.forEach((comment) => {
                newState[comment.id] = comment;
            });
            return newState;
        },
        routeCommentAction(state, action) {
            state[action.payload.id] = action.payload;
        },
        workoutCommentAction(state, action) {
            state[action.payload.id] = action.payload;
        },
        updateCommentAction(state, action) {
            state[action.payload.id].body = action.payload.body;
        },
        deleteCommentAction(state, action) {
            delete state[action.payload];
        },
    },
});

const { getComments, routeCommentAction, workoutCommentAction, updateCommentAction, deleteCommentAction } = commentsSlice.actions;

export const getRouteComments = (id) => async (dispatch) => {
    const response = await csrfFetch(`/api/routes/${id}/comments`);

    if (response.ok) {
        const data = await response.json();

        dispatch(getComments(data.comments));
        return data
    };
    return response;
};

export const getWorkoutComments = (id) => async (dispatch) => {
    const response = await csrfFetch(`/api/workouts/${id}/comments`);

    if (response.ok) {
        const data = await response.json();
        dispatch(getComments(data.comments));
        return data;
    };
    return response;
};

export const newRouteComment = (comment) => async (dispatch) => {
    const { routeId, body } = comment;
    const response = await csrfFetch(`/api/routes/${routeId}/comments`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            body: body
        })
    });

    if (response.ok) {
        const newComment = await response.json();
        dispatch(routeCommentAction(newComment));
    }else if (response.status < 500) {
        const data = await response.json();
        if (data.errors) {
            return data.errors
        }
    }
};



export const newWorkoutComment = (comment) => async (dispatch) => {
    const { workoutId, body } = comment;
    const response = await csrfFetch(`/api/workouts/${workoutId}/comments`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            body: body
        })
    });

    if (response.ok) {
        const newComment = await response.json();
        dispatch(workoutCommentAction(newComment));
        return newComment
    }else if (response.status < 500) {
        const data = await response.json();
        if (data.errors) {
            return data.errors
        }
    }else {
        return ['An error occurred. Please try again.']
    }
};


export const updateComment = (comment) => async (dispatch) => {
    const { commentId, body } = comment;
    const response = await csrfFetch(`/api/comments/${commentId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            body: body
        })
    });

    if (response.ok) {
        let newComment = await response.json();
        dispatch(updateCommentAction(newComment));
    }else if(response.status < 500) {
        const data = await response.json();
        if(data.errors) {
            return data.errors
        }
    }else {
        return ['An error occurred. Please try again.']
    }
};


export const deleteComment = (commentId) => async (dispatch) => {
    const response = await csrfFetch(`/api/comments/${commentId}`, {
        method: 'DELETE'
    });

    if (response.ok) {
        const data = await response.json();
        dispatch(deleteCommentAction(commentId));
        return data
    }
    return response
}


export default commentsSlice.reducer;
