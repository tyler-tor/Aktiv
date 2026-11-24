import { useEffect, useRef } from 'react';
import { useGoogleMap } from '@react-google-maps/api';
import './MapMarker.css';

// Marker built on google.maps.marker.AdvancedMarkerElement (the old
// google.maps.Marker is deprecated). @react-google-maps/api has no wrapper for
// it, so this small component creates the marker itself and removes it again
// when it unmounts. The map must have a Map ID (see config.js).
//
// props: position {lat,lng}; title (also the accessible name); variant
// 'start' | 'end' | 'pin'; draggable + onDragEnd({lat,lng}); onClick().
const toLiteral = (p) => (typeof p.lat === 'function' ? { lat: p.lat(), lng: p.lng() } : { lat: p.lat, lng: p.lng });

export default function MapMarker({ position, title, variant = 'pin', draggable = false, onDragEnd, onClick }) {
    const map = useGoogleMap();
    const markerRef = useRef(null);
    // keep the latest callbacks without re-creating the marker
    const handlers = useRef({});
    handlers.current = { onDragEnd, onClick };

    const lat = position?.lat;
    const lng = position?.lng;
    const hasPosition = typeof lat === 'number' && typeof lng === 'number';

    // create / destroy
    useEffect(() => {
        if (!map || !hasPosition || !window.google?.maps?.importLibrary) return undefined;
        let cancelled = false;
        let marker = null;
        const listeners = [];
        window.google.maps.importLibrary('marker').then(({ AdvancedMarkerElement }) => {
            if (cancelled) return;
            const pin = document.createElement('div');
            pin.className = `map-pin map-pin--${variant}`;
            marker = new AdvancedMarkerElement({
                map,
                position: { lat, lng },
                title,
                content: pin,
                gmpDraggable: draggable,
                gmpClickable: !!handlers.current.onClick,
            });
            if (handlers.current.onClick) {
                listeners.push(marker.addListener('click', () => handlers.current.onClick?.()));
            }
            if (draggable) {
                listeners.push(marker.addListener('dragend', () => {
                    if (marker.position) handlers.current.onDragEnd?.(toLiteral(marker.position));
                }));
            }
            markerRef.current = marker;
        });
        return () => {
            cancelled = true;
            listeners.forEach((l) => l?.remove?.());
            if (marker) marker.map = null;
            markerRef.current = null;
        };
        // position changes are handled by the effect below; recreating the marker on every drag would drop it mid-gesture
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, hasPosition, variant, draggable, title]);

    // move an existing marker when the position prop changes
    useEffect(() => {
        if (markerRef.current && hasPosition) markerRef.current.position = { lat, lng };
    }, [lat, lng, hasPosition]);

    return null;
}
