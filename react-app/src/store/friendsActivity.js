import { createSlice } from '@reduxjs/toolkit';

// The activity feed: routes and workouts mixed, newest first, loaded one page
// at a time from /api/me/friends/activity. Every item has `kind` ('route' or
// 'workout'). `nextCursor` is null when there is nothing more to load.
const friendsActivitySlice = createSlice({
    name: 'friendsActivity',
    initialState: { items: null, nextCursor: null, scope: 'friends', loadingMore: false },
    reducers: {
        feedLoaded(state, action) {
            const { items, nextCursor, scope, append } = action.payload;
            state.items = append && state.items ? [...state.items, ...items] : items;
            state.nextCursor = nextCursor;
            state.scope = scope;
            state.loadingMore = false;
        },
        feedLoadingMore(state) {
            state.loadingMore = true;
        },
    },
});

const { feedLoaded, feedLoadingMore } = friendsActivitySlice.actions;

const PAGE_SIZE = 10;

// First page of the feed for `scope` ('friends' or 'all'); replaces the list.
export const getFeed = (scope = 'friends') => async (dispatch) => {
    const res = await fetch(`/api/me/friends/activity?scope=${scope}&limit=${PAGE_SIZE}`);
    if (res.ok) {
        const data = await res.json();
        dispatch(feedLoaded({ ...data, scope, append: false }));
    }
    return res;
};

// Next page, appended to the list ("Load more" button).
export const getMoreFeed = () => async (dispatch, getState) => {
    const { nextCursor, scope, loadingMore } = getState().friendsActivity;
    if (!nextCursor || loadingMore) return null;
    dispatch(feedLoadingMore());
    const res = await fetch(`/api/me/friends/activity?scope=${scope}&limit=${PAGE_SIZE}&cursor=${encodeURIComponent(nextCursor)}`);
    if (res.ok) {
        const data = await res.json();
        dispatch(feedLoaded({ ...data, scope, append: true }));
    } else {
        dispatch(feedLoaded({ items: [], nextCursor, scope, append: true }));
    }
    return res;
};

export default friendsActivitySlice.reducer;
