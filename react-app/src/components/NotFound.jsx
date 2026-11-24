import React from 'react';
import { Link } from 'react-router';
import { FiCompass } from 'react-icons/fi';
import './NotFound.css';
import usePageTitle from '../hooks/usePageTitle';

const NotFound = ({ title = 'Page not found', message = "That address doesn't lead anywhere. It may have moved, or the link has a typo." }) => {
  usePageTitle(title);
  return (
  <div className='page page--narrow'>
    <div className='empty-state'>
      <FiCompass size={40} aria-hidden='true' />
      <h1>{title}</h1>
      <p>{message}</p>
      <Link to='/' className='btn btn--primary'>Back to the map</Link>
    </div>
  </div>
  );
};

export default NotFound;
