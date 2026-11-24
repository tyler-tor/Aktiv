import React from 'react'
import { Link } from 'react-router';
import MapComponent from '../Map';
import usePageTitle from '../../hooks/usePageTitle';
import './HomePage.css'

const center = {
  lat: 37.090240,
  lng: -95.712891
};

function HomePage() {
  usePageTitle('Map');
  return (
    <div className='homepage'>
      <MapComponent lat={center.lat} lng={center.lng} />
      <div className='homepage__panel'>
        <h1>Explore routes</h1>
        <p>Pick a pin to see the route. Drop two of your own to make a new one.</p>
        <Link to='/newRoute' className='btn btn--primary btn--sm'>Plan a route</Link>
      </div>
    </div>
  )
}

export default HomePage
