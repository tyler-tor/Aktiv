// Google "encoded polyline" decoder, so stored routes can be drawn without
// loading any Google library (see app/services/directions.py on the server).
// https://developers.google.com/maps/documentation/utilities/polylinealgorithm

// "_p~iF~ps|U_ulLnnqC" -> [{ lat: 38.5, lng: -120.2 }, ...]
export const decodePolyline = (encoded) => {
    const points = [];
    if (!encoded) return points;
    let index = 0;
    let lat = 0;
    let lng = 0;
    while (index < encoded.length) {
        for (const axis of ['lat', 'lng']) {
            let result = 0;
            let shift = 0;
            let byte;
            do {
                if (index >= encoded.length) return points; // truncated input
                byte = encoded.charCodeAt(index++) - 63;
                result |= (byte & 0x1f) << shift;
                shift += 5;
            } while (byte >= 0x20);
            const delta = result & 1 ? ~(result >> 1) : result >> 1;
            if (axis === 'lat') lat += delta; else lng += delta;
        }
        points.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }
    return points;
};

// Fits lat/lng points into a width x height box (equirectangular projection,
// corrected for latitude so the shape is not stretched). Returns
// { path: "M x y L x y ...", start: {x, y}, end: {x, y} }.
export const projectPoints = (points, width, height, padding = 24) => {
    if (!points.length) return { path: '', start: null, end: null };
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const midLat = (minLat + maxLat) / 2;
    const xScaleRaw = Math.cos((midLat * Math.PI) / 180);
    const spanX = Math.max((maxLng - minLng) * xScaleRaw, 1e-9);
    const spanY = Math.max(maxLat - minLat, 1e-9);
    const scale = Math.min((width - 2 * padding) / spanX, (height - 2 * padding) / spanY);
    const offsetX = (width - spanX * scale) / 2;
    const offsetY = (height - spanY * scale) / 2;
    const project = (p) => ({
        x: Math.round((offsetX + (p.lng - minLng) * xScaleRaw * scale) * 10) / 10,
        y: Math.round((height - offsetY - (p.lat - minLat) * scale) * 10) / 10,
    });
    const projected = points.map(project);
    return {
        path: projected.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' '),
        start: projected[0],
        end: projected[projected.length - 1],
    };
};
