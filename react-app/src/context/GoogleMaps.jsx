import React, { createContext, useContext } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY } from '../config';

// Google Maps libraries to load. Must be a constant defined outside any
// component: a new array on every render makes the loader reload the script
// (and log a "Performance warning"). Add e.g. 'places' here if needed later.
const LIBRARIES = ['maps'];

const GoogleMapsContext = createContext({ isLoaded: false, loadError: undefined });

// Loads the Google Maps JavaScript API once for the whole app (main.jsx wraps
// <App /> in this provider). Map components call useGoogleMaps() instead of
// each running their own useLoadScript().
export function GoogleMapsProvider({ children }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  if (loadError && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error('Google Maps failed to load:', loadError);
  }

  return (
    <GoogleMapsContext.Provider value={{ isLoaded, loadError }}>
      {children}
    </GoogleMapsContext.Provider>
  );
}

// { isLoaded, loadError } for the shared Google Maps script.
export function useGoogleMaps() {
  return useContext(GoogleMapsContext);
}
