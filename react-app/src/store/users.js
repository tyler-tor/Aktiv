import { createSlice } from '@reduxjs/toolkit';
const usersSlice = createSlice({
    name: 'users',
    initialState: { currentUser: null, users: null },
    reducers: {
        getUsers(state, action) {
            state.currentUser = null;
            state.users = {};
            action.payload.forEach((user) => {
                state.users[user.id] = user;
            });
        },
        getOneUserAction(state, action) {
            state.currentUser = action.payload;
        },
    },
});

const { getUsers, getOneUserAction } = usersSlice.actions;

export const getAllUsers = () => async (dispatch) => {
    const response = await fetch('/api/users/')

    if(response.ok) {
        const data = await response.json()
        dispatch(getUsers(data.users))
        return data
    }
    return response
};

export const getOneUser = (userId) => async (dispatch) => {
    const res = await fetch(`/api/users/${userId}`)

    if(res.ok) {
        const user = await res.json();
        dispatch(getOneUserAction(user))
    }else if (res.status < 500) {
        const data = await res.json();
        if(data.errors) {
            return data.errors
        }
    }
}

export default usersSlice.reducer;
