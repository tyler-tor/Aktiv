import { createSlice } from '@reduxjs/toolkit';
import { csrfFetch } from './csrf';
const workoutsSlice = createSlice({
    name: 'workouts',
    initialState: { workouts: null, currentWorkout: null },
    reducers: {
        // Loading all workouts replaces the list and clears currentWorkout.
        getWorkouts(state, action) {
            state.currentWorkout = null;
            state.workouts = {};
            action.payload.forEach((workout) => {
                state.workouts[workout.id] = workout;
            });
        },
        getCurrentWorkoutAction(state, action) {
            state.currentWorkout = action.payload;
        },
        addWorkoutAction(state, action) {
            state.currentWorkout = null;
            if (!state.workouts) state.workouts = {};
            state.workouts[action.payload.id] = action.payload;
        },
        updateWorkoutAction(state, action) {
            state.currentWorkout = action.payload;
            state.workouts[action.payload.id] = action.payload;
        },
        deleteWorkoutAction(state, action) {
            delete state.workouts[action.payload];
        },
    },
});

const { getWorkouts, getCurrentWorkoutAction, addWorkoutAction, updateWorkoutAction, deleteWorkoutAction } = workoutsSlice.actions;

export const getAllWorkouts = () => async (dispatch) => {
    const response = await csrfFetch('/api/workouts/');

    if (response.ok) {
        const data = await response.json();
        dispatch(getWorkouts(data.workouts));
        return data
    };
    return response
};

export const getCurrentWorkout = (workoutId) => async (dispatch) => {
    const res = await csrfFetch(`/api/workouts/${workoutId}`);

    if (res.ok) {
        const data = await res.json();
        dispatch(getCurrentWorkoutAction(data));
        return data
    }
}

export const addWorkout = (workout) => async (dispatch) => {
    const response = await csrfFetch('/api/workouts/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            ...workout
        })
    });
    if (response.ok) {
        const newWorkout = await response.json();
        dispatch(addWorkoutAction(newWorkout));
    }else if (response.status < 500) {
        const data = await response.json();
        if (data.errors) {
            return data.errors;
        };
    }else {
        return ['An error occurred. Please try again.'];
    }
}

export const updateWorkout = (workout) => async (dispatch) => {
    const response = await csrfFetch(`/api/workouts/${workout.id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            ...workout
        })
    });

    if (response.ok) {
        const updatedWorkout = await response.json();
        dispatch(updateWorkoutAction(updatedWorkout));
    }else if (response.status < 500) {
        const data = await response.json();
        if (data.errors) {
            return data.errors
        };
    } else {
        return ['An error occurred. Please try again.'];
    }
};

export const deleteWorkout = (id) => async (disptch) => {
    const response = await csrfFetch(`/api/workouts/${id}`, {
        method: 'DELETE'
    });

    if (response.ok) {
        const data = await response.json();
        disptch(deleteWorkoutAction(id));
        return data;
    };
    return response
}


export default workoutsSlice.reducer;
