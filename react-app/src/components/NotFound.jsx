import React from 'react';
import { Link } from 'react-router';
import { FiCompass } from 'react-icons/fi';
import './NotFound.css';

const NotFound = ({ title = 'Page not found', message = "That address doesn't lead anywhere. It may have moved, or the link has a typo." }) => (
  <main className='page page--narrow'>
    <div className='empty-state'>
      <FiCompass size={40} aria-hidden='true' />
      <h1>{title}</h1>
      <p>{message}</p>
      <Link to='/' className='btn btn--primary'>Back to the map</Link>
    </div>
  </main>
);

export default NotFound;
