import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes as RouterRoutes, Route, Navigate } from 'react-router';
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

  // React Router v7: <Routes> picks the best-matching route (paths match
  // exactly unless they end in "/*"). The protected pages are children of a
  // layout route: <ProtectedRoute> renders them through <Outlet /> for a
  // logged-in user and sends logged-out users to the login page at "/".
  // (RouterRoutes is react-router's <Routes>, renamed because this app already
  // has a page component called Routes.)
  return (
    <BrowserRouter>
      <NavBar />
      <RouterRoutes>
        <Route path='/' element={user ? <HomePage /> : <LoginForm />} />
        <Route path='/sign-up' element={user ? <Navigate to='/' replace /> : <SignUpForm />} />
        <Route path='/login' element={<Navigate to='/' replace />} />
        <Route element={<ProtectedRoute />}>
          <Route path='/users' element={<UsersList />} />
          <Route path='/users/:userId' element={<User />} />
          <Route path='/routes' element={<Routes />} />
          <Route path='/activity' element={<ActivityFeed />} />
          <Route path='/routes/:routeId' element={<RouteDisplay />} />
          <Route path='/workouts/:workoutId' element={<WorkoutDisplay />} />
          <Route path='/newRoute' element={<NewRoute />} />
          <Route path='/newWorkout' element={<NewWorkout />} />
        </Route>
        <Route path='*' element={<NotFound />} />
      </RouterRoutes>
      <Footer />
    </BrowserRouter>
  );
}

export default App;
