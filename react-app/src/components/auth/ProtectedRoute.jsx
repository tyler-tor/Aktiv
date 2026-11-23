import React from 'react';
import { useSelector } from 'react-redux';
import { Navigate, Outlet, useLocation } from 'react-router';

// Layout route for pages that need a logged-in user (see App.jsx): renders the
// matched child page through <Outlet />. Logged-out users are sent to the
// login page, which lives at "/" (the original location is kept in
// state.from for a future "return to where you were" feature).
const ProtectedRoute = () => {
  const user = useSelector(state => state.session.user);
  const location = useLocation();
  if (!user) {
    return <Navigate to='/' replace state={{ from: location }} />;
  }
  return <Outlet />;
};


export default ProtectedRoute;
