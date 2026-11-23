import React from 'react';
import { Link } from 'react-router-dom';
import './NotFound.css';

const NotFound = () => (
  <main className='not-found'>
    <h1>Page not found</h1>
    <p>We couldn't find the page you were looking for.</p>
    <Link to='/' className='not-found-link'>Go to the home page</Link>
  </main>
);

export default NotFound;
