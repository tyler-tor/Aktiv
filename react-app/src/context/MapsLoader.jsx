import React from 'react';
import { useEffect } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY } from '../config';

// Google Maps libraries to load. Must be a constant defined outside any
// component: a new array on every render makes the loader reload the script
// (and log a "Performance warning"). Add e.g. 'places' here if needed later.
const LIBRARIES = ['maps', 'marker'];

// Runs the (single) Maps script loader. Lives in its own file so that
// @react-google-maps/api is only downloaded (as a separate JavaScript file)
// once a map page asks for the API; see GoogleMaps.jsx.
export default function MapsLoader({ onChange }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  if (loadError && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error('Google Maps failed to load:', loadError);
  }

  useEffect(() => {
    onChange({ isLoaded, loadError });
  }, [isLoaded, loadError, onChange]);

  return null;
}
