import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Route, Switch, Redirect } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import ActivityFeed from './components/ActivityFeed';
import LoginForm from './components/auth/LoginForm';
import SignUpForm from './components/auth/SignUpForm';
import HomePage from './components/HomePage/HomePage';
import Routes from './components/UserRoutes/Routes';
import RouteDisplay from './components/RouteDisplay/RouteDisplay';
import NavBar from './components/NavBar';
import Footer from './components/Footer';
import ProtectedRoute from './components/auth/ProtectedRoute';
import UsersList from './components/UsersList';
import User from './components/User';
import NotFound from './components/NotFound';
import { authenticate } from './store/session';
import { getAllRoutes } from './store/routes';
import { getAllWorkouts } from './store/workouts';
import WorkoutDisplay from './components/WorkoutDisplay/WorkoutDisplay';
import NewRoute from './components/NewMap/NewRoute';
import NewWorkout from './components/NewWorkout/NewWorkout';

function App() {
  const [loaded, setLoaded] = useState(false);
  const user = useSelector((state) => state.session.user);
  const userId = user ? user.id : null;
  const dispatch = useDispatch();
  // Which user we already preloaded routes/workouts for, and that preload's
  // promise (avoids refetching every time the session object is refreshed,
  // e.g. after adding a friend). Sharing the promise matters in development:
  // React 18+ StrictMode runs effects twice, and the second run must wait for
  // the same preload instead of rendering the pages before the data is there.
  const preloadedFor = useRef(null);

  const preload = useCallback((id) => {
    if (preloadedFor.current && preloadedFor.current.id === id) {
      return preloadedFor.current.promise;
    }
    const promise = Promise.all([dispatch(getAllWorkouts()), dispatch(getAllRoutes())]);
    preloadedFor.current = { id, promise };
    return promise;
  }, [dispatch]);

  // First load: restore the session, preload data if logged in, then render.
  // (The old code checked `user` from the first render here, which is always
  // null, so the preload never ran.)
  useEffect(() => {
    (async () => {
      const sessionUser = await dispatch(authenticate());
      if (sessionUser) {
        await preload(sessionUser.id);
      }
      setLoaded(true);
    })();
  }, [dispatch, preload]);

  // Later logins (login form, sign-up, demo button) preload too; logout resets.
  useEffect(() => {
    if (!loaded) return;
    if (userId) {
      preload(userId);
    } else {
      preloadedFor.current = null;
    }
  }, [loaded, userId, preload]);

  if (!loaded) {
    return null;
  }

  // One flat <Switch>: it renders the FIRST matching route only. (Wrapping
  // routes in <>...</> fragments inside <Switch> broke that matching and made a
  // 404 page impossible.) Logged-out users who open a protected page are sent
  // to the login page by <ProtectedRoute>.
  return (
    <BrowserRouter>
      <NavBar />
      <Switch>
        <Route path='/' exact={true}>
          {user ? <HomePage /> : <LoginForm />}
        </Route>
        <Route path='/sign-up' exact={true}>
          {user ? <Redirect to='/' /> : <SignUpForm />}
        </Route>
        <Route path='/login' exact={true}>
          <Redirect to='/' />
        </Route>
        <ProtectedRoute path='/users' exact={true}>
          <UsersList />
        </ProtectedRoute>
        <ProtectedRoute path='/users/:userId' exact={true}>
          <User />
        </ProtectedRoute>
        <ProtectedRoute path='/routes' exact={true}>
          <Routes />
        </ProtectedRoute>
        <ProtectedRoute path='/activity' exact={true}>
          <ActivityFeed />
        </ProtectedRoute>
        <ProtectedRoute path='/routes/:routeId' exact={true}>
          <RouteDisplay />
        </ProtectedRoute>
        <ProtectedRoute path='/workouts/:workoutId' exact={true}>
          <WorkoutDisplay />
        </ProtectedRoute>
        <ProtectedRoute path='/newRoute' exact={true}>
          <NewRoute />
        </ProtectedRoute>
        <ProtectedRoute path='/newWorkout' exact={true}>
          <NewWorkout />
        </ProtectedRoute>
        <Route>
          <NotFound />
        </Route>
      </Switch>
      <Footer />
    </BrowserRouter>
  );
}

export default App;
