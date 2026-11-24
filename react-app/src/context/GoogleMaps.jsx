import React, { Suspense, createContext, lazy, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const MapsLoader = lazy(() => import('./MapsLoader'));

const GoogleMapsContext = createContext({ isLoaded: false, loadError: undefined, request: () => {} });

// Wraps the app (main.jsx). The Maps script is loaded once, on demand.
export function GoogleMapsProvider({ children }) {
  const [requested, setRequested] = useState(false);
  const [state, setState] = useState({ isLoaded: false, loadError: undefined });
  const request = useCallback(() => setRequested(true), []);
  const value = useMemo(() => ({ ...state, request }), [state, request]);

  return (
    <GoogleMapsContext.Provider value={value}>
      {children}
      {requested && (
        <Suspense fallback={null}>
          <MapsLoader onChange={setState} />
        </Suspense>
      )}
    </GoogleMapsContext.Provider>
  );
}

// { isLoaded, loadError } for the shared Google Maps script. Calling this hook
// is what starts loading the script (first caller wins; later callers share it).
export function useGoogleMaps() {
  const { isLoaded, loadError, request } = useContext(GoogleMapsContext);
  useEffect(() => {
    request();
  }, [request]);
  return { isLoaded, loadError };
}
