import { createSlice } from '@reduxjs/toolkit';
import { csrfFetch } from './csrf';
// Redux Toolkit slice: createSlice generates the action creators
// (setUser, removeUser) and the reducer. Reducers may "mutate" state; Immer
// turns that into an immutable update.
const sessionSlice = createSlice({
  name: 'session',
  initialState: { user: null },
  reducers: {
    setUser(state, action) {
      state.user = action.payload;
    },
    removeUser(state) {
      state.user = null;
    },
  },
});

const { setUser, removeUser } = sessionSlice.actions;

export const authenticate = () => async (dispatch) => {
  const response = await csrfFetch('/api/auth/', {
    headers: {
      'Content-Type': 'application/json'
    }
  });
  if (response.ok) {
    const data = await response.json();
    if (data.errors) {
      return null;
    }

    dispatch(setUser(data));
    return data;
  }
  return null;
}

export const login = (email, password) => async (dispatch) => {
  const response = await csrfFetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      password
    })
  });


  if (response.ok) {
    const data = await response.json();
    dispatch(setUser(data))
    return null;
  } else if (response.status < 500) {
    const data = await response.json();
    if (data.errors) {
      return data.errors;
    }
  } else {
    return ['An error occurred. Please try again.']
  }

}

export const logout = () => async (dispatch) => {
  const response = await csrfFetch('/api/auth/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    }
  });

  if (response.ok) {
    dispatch(removeUser());
  }
};


export const signUp = (username, email, password, url, firstName, lastName) => async (dispatch) => {
  const response = await csrfFetch('/api/auth/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username,
      email,
      password,
      profile_picture: url,
      first_name: firstName,
      last_name: lastName
    }),
  });

  if (response.ok) {
    const data = await response.json();
    dispatch(setUser(data))
    return null;
  } else if (response.status < 500) {
    const data = await response.json();
    if (data.errors) {
      return data.errors;
    }
  } else {
    return ['An error occurred. Please try again.']
  }
}

export default sessionSlice.reducer;
