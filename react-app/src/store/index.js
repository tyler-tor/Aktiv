import { configureStore as configureReduxStore } from '@reduxjs/toolkit';
import logger from 'redux-logger';
import session from './session'
import usersReducer from './users';
import commentsReducer from './comments';
import workoutReducer from './workouts';
import routesReducer from './routes';
import friendsActivityReducer from './friendsActivity';

// Redux Toolkit's configureStore combines the slice reducers and adds the
// default middleware: redux-thunk (our async action creators) and, in
// development only, checks that warn when state is mutated outside a reducer
// or when something non-serializable is put into the store. It also connects
// the Redux DevTools browser extension in development.
const reducer = {
  session,
  users: usersReducer,
  comments: commentsReducer,
  workouts: workoutReducer,
  routes: routesReducer,
  friendsActivity: friendsActivityReducer
};

const configureStore = (preloadedState) => {
  return configureReduxStore({
    reducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      import.meta.env.PROD
        ? getDefaultMiddleware()
        // redux-logger prints every action in the browser console (development only).
        : getDefaultMiddleware().concat(logger),
    devTools: !import.meta.env.PROD,
  });
};

export default configureStore;
