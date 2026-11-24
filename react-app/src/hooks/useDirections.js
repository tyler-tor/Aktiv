import { useEffect, useState } from 'react';
import { useGoogleMaps } from '../context/GoogleMaps';

// Google's "service" classes (Distance Matrix, Directions) answer one question
// per call. The <DistanceMatrixService> / <DirectionsService> React components
// from @react-google-maps/api send a new request on EVERY re-render of the
// page (their componentDidUpdate calls the service each time), which is billable
// and, for a form, means one request per keystroke. These hooks call the
// service only when the places or travel mode really change.

const key = (start, end, mode) =>
    start && end && mode ? `${start.lat},${start.lng}|${end.lat},${end.lng}|${mode}` : null;

// Straight-line-free distance + time between two points: { distanceM, durationS } or null.
export function useDistanceMatrix(start, end, mode) {
    const { isLoaded } = useGoogleMaps();
    const [result, setResult] = useState(null);
    const requestKey = key(start, end, mode);

    useEffect(() => {
        const maps = typeof window !== 'undefined' && window.google && window.google.maps;
        if (!isLoaded || !requestKey || !maps || !maps.DistanceMatrixService) {
            setResult(null);
            return undefined;
        }
        let cancelled = false;
        new maps.DistanceMatrixService().getDistanceMatrix(
            { origins: [start], destinations: [end], travelMode: mode },
            (response, status) => {
                if (cancelled) return;
                const element = response && response.rows && response.rows[0] && response.rows[0].elements[0];
                if (status === 'OK' && element && element.status === 'OK') {
                    setResult({ distanceM: element.distance.value, durationS: element.duration.value });
                } else {
                    setResult(null);
                }
            });
        return () => { cancelled = true; };
        // start/end/mode are captured by requestKey
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoaded, requestKey]);

    return result;
}

// One Directions request for a route that has no stored polyline (routes made
// before A28). `enabled` = false does nothing. Returns a DirectionsResult or null.
export function useFallbackDirections(start, end, mode, enabled) {
    const { isLoaded } = useGoogleMaps();
    const [directions, setDirections] = useState(null);
    const requestKey = enabled ? key(start, end, mode) : null;

    useEffect(() => {
        setDirections(null);
        const maps = typeof window !== 'undefined' && window.google && window.google.maps;
        if (!isLoaded || !requestKey || !maps || !maps.DirectionsService) return undefined;
        let cancelled = false;
        new maps.DirectionsService().route(
            { origin: start, destination: end, travelMode: mode },
            (response, status) => {
                if (!cancelled && status === 'OK') setDirections(response);
            });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoaded, requestKey]);

    return directions;
}
