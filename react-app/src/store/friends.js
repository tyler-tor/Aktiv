import { createSlice } from '@reduxjs/toolkit';
import { csrfFetch } from './csrf';
import { authenticate } from "./session";
import { getOneUser } from "./users";

const friendsSlice = createSlice({
    name: 'friends',
    initialState: {},
    reducers: {
        // Replaces the whole map: { [userId]: friend }
        getFriends(state, action) {
            const newState = {};
            action.payload.forEach((user) => {
                newState[user.id] = user;
            });
            return newState;
        },
        // NOTE: addFriend() dispatches the friend's *id*, so this stores the id
        // under the key "undefined" (pre-existing behaviour, kept as-is; the
        // friends slice is not read anywhere - pages use session.user.friends).
        addFriendAction(state, action) {
            state[action.payload.id] = action.payload;
        },
        deleteFriendAction(state, action) {
            delete state[action.payload];
        },
    },
});

const { getFriends, addFriendAction, deleteFriendAction } = friendsSlice.actions;

export const getAllFriends = (id) => async (dispatch) => {
    const response = await csrfFetch(`/api/users/${id}/friends`);

    if (response.ok) {
        const data = await response.json();
        dispatch(getFriends(data.friends))
        return data.friends
    };
    return response
}

export const addFriend = (id) => async (dispatch) => {
    const response = await csrfFetch(`/api/users/${id}/friends`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
    });
    if (response.ok) {
        const data = await response.json();
        dispatch(addFriendAction(data.friend.id));
        dispatch(authenticate());
        dispatch(getOneUser(data.friend.id))
        return data
    };
    return response
};

export const deleteFriend = (id) => async (dispatch) => {
    const response = await csrfFetch(`/api/users/${id}/friends`, {
        method: 'DELETE'
    });
    if (response.ok) {
        const data = await response.json();
        dispatch(deleteFriendAction(data.unFriended.id));
        dispatch(authenticate());
        dispatch(getOneUser(data.unFriended.id))
        return data
    };
    return response
};


export default friendsSlice.reducer;
