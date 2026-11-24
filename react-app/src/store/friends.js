import { csrfFetch } from './csrf';
import { authenticate } from "./session";
import { getOneUser } from "./users";

// Friend actions. There is no separate "friends" slice any more: the single
// source of truth is `state.session.user.friends` (and `users.currentUser` for
// the profile being viewed), which these thunks refresh after every change.
// (The old slice stored the added friend under the key "undefined" and nothing
// ever read it.)

// Reads the error list out of a failed response.
const failure = async (response) => {
    let errors = ['Something went wrong. Please try again.'];
    try {
        const data = await response.json();
        if (Array.isArray(data.errors)) errors = data.errors;
    } catch (e) {
        // not JSON (e.g. an HTML error page): keep the generic message
    }
    return { errors };
};

// Resolves to the API answer on success, or { errors: [...] } on failure.
export const addFriend = (id) => async (dispatch) => {
    const response = await csrfFetch(`/api/users/${id}/friends`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
    });
    if (response.ok) {
        const data = await response.json();
        await dispatch(authenticate());
        await dispatch(getOneUser(data.friend.id));
        return data
    };
    return failure(response)
};

export const deleteFriend = (id) => async (dispatch) => {
    const response = await csrfFetch(`/api/users/${id}/friends`, {
        method: 'DELETE'
    });
    if (response.ok) {
        const data = await response.json();
        await dispatch(authenticate());
        await dispatch(getOneUser(data.unFriended.id));
        return data
    };
    return failure(response)
};
