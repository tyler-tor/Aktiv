import React, { useState, useEffect } from 'react';
import { BrowserRouter, Route, Switch } from 'react-router-dom';
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
import { authenticate } from './store/session';
import { getAllRoutes } from './store/routes';
import { getAllWorkouts } from './store/workouts';
import WorkoutDisplay from './components/WorkoutDisplay/WorkoutDisplay';
import NewRoute from './components/NewMap/NewRoute';
import NewWorkout from './components/NewWorkout/NewWorkout';

function App() {
  const [loaded, setLoaded] = useState(false);
  const user = useSelector((state) => state.session.user)
  const dispatch = useDispatch();

  useEffect(() => {
    (async () => {
      await dispatch(authenticate());
      if (user) {
        await dispatch(getAllWorkouts())
        await dispatch(getAllRoutes());
      }
      setLoaded(true);
    })();
  }, [dispatch]);

  if (!loaded) {
    return null;
  }

  return loaded && (
    <BrowserRouter>
      <NavBar />
      <Switch>
        {user ? (
          <>
            <ProtectedRoute path='/users' exact={true} >
              <UsersList />
            </ProtectedRoute>
            <ProtectedRoute path='/users/:userId' exact={true} >
              <User />
            </ProtectedRoute>
            <ProtectedRoute path='/routes' exact={true} >
              <Routes />
            </ProtectedRoute>
            <ProtectedRoute path='/activity' exact={true} >
              <ActivityFeed />
            </ProtectedRoute>
            <ProtectedRoute path='/routes/:routeId' exact={true} >
              <RouteDisplay />
            </ProtectedRoute>
            <ProtectedRoute path='/workouts/:workoutId' exact={true} >
              <WorkoutDisplay />
            </ProtectedRoute>
            <ProtectedRoute path='/newRoute' exact={true} >
              <NewRoute />
            </ProtectedRoute>
            <ProtectedRoute path='/newWorkout' exact={true} >
              <NewWorkout />
            </ProtectedRoute>
            <Route path='/' exact={true} >
              <HomePage />
            </Route>
          </>
        ) : (
          <>
            <Route path='/' exact={true}>
              <LoginForm />
            </Route>
            <Route path='/sign-up' exact={true}>
              <SignUpForm />
            </Route>
          </>
        )}
      </Switch>
      <Footer />
    </BrowserRouter>
  );
}

export default App;
