import React, { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter, Routes as RouterRoutes, Route, Navigate } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';
import LoginForm from './components/auth/LoginForm';
import NavBar from './components/NavBar';
import Footer from './components/Footer';
import ProtectedRoute from './components/auth/ProtectedRoute';
import NotFound from './components/NotFound';
import { authenticate } from './store/session';

// Pages are loaded on demand (one JavaScript file each), so the first visit only
// downloads the page it needs; the Google Maps code ends up only in the map pages' files.
const ActivityFeed = lazy(() => import('./components/ActivityFeed/ActivityFeed'));
const HomePage = lazy(() => import('./components/HomePage/HomePage'));
const Routes = lazy(() => import('./components/UserRoutes/Routes'));
const RouteDisplay = lazy(() => import('./components/RouteDisplay/RouteDisplay'));
const UsersList = lazy(() => import('./components/UsersList'));
const User = lazy(() => import('./components/User'));
const WorkoutDisplay = lazy(() => import('./components/WorkoutDisplay/WorkoutDisplay'));
const NewRoute = lazy(() => import('./components/NewMap/NewRoute'));
const NewWorkout = lazy(() => import('./components/NewWorkout/NewWorkout'));
const SignUpForm = lazy(() => import('./components/auth/SignUpForm'));

function App() {
  const [loaded, setLoaded] = useState(false);
  const user = useSelector((state) => state.session.user);
  const dispatch = useDispatch();

  // First load: restore the session (am I logged in?), then render. Pages load
  // their own data: the old "preload every route and workout up front" step
  // delayed the first screen and nothing needed it any more (A24-A27).
  useEffect(() => {
    (async () => {
      await dispatch(authenticate());
      setLoaded(true);
    })();
  }, [dispatch]);

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
      <Suspense fallback={<div className='page-loading' role='status'>Loading...</div>}>
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
      </Suspense>
      <Footer />
    </BrowserRouter>
  );
}

export default App;
