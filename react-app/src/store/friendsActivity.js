import { createSlice } from '@reduxjs/toolkit';
const friendsActivitySlice = createSlice({
    name: 'friendsActivity',
    initialState: { routes: null, workouts: null },
    reducers: {
        getFriendsActivityAction(state, action) {
            state.routes = action.payload.routes;
            state.workouts = action.payload.workouts;
        },
    },
});

const { getFriendsActivityAction } = friendsActivitySlice.actions;

export const getAllFriendsActivity = () => async (dispatch) => {
    const res = await fetch('/api/me/friends/activity');
    if (res.ok) {
        const data = await res.json();
        dispatch(getFriendsActivityAction(data));
    };
    return res;
};


export default friendsActivitySlice.reducer;
