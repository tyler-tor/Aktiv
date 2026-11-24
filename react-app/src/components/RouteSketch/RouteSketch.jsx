import React, { useMemo } from 'react';
import { decodePolyline, projectPoints } from '../../utils/polyline';
import './RouteSketch.css';

const WIDTH = 480;
const HEIGHT = 270;

// A small drawing of a route: the stored polyline (or, for routes saved without
// one, a dashed straight line between the two points) on a soft grid, with a
// filled dot at the start and a ring at the finish. It is plain SVG built from
// data we already have, so it needs no Google request, no key and no network:
// the activity feed can show dozens of these instantly.
function RouteSketch({ polyline, start, end, title, kind = 'route' }) {
    const { path, from, to, approximate } = useMemo(() => {
        const decoded = decodePolyline(polyline);
        const approximate = decoded.length < 2;
        const points = approximate ? [start, end].filter(Boolean) : decoded;
        const projected = projectPoints(points, WIDTH, HEIGHT);
        return { path: projected.path, from: projected.start, to: projected.end, approximate };
    }, [polyline, start, end]);

    return (
        <svg className={`route-sketch route-sketch--${kind}`} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img" aria-label={title ? `Sketch of the route ${title}` : 'Sketch of the route'}
            preserveAspectRatio="xMidYMid slice">
            <defs>
                <pattern id="route-sketch-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                    <path d="M30 0H0V30" className="route-sketch__grid" />
                </pattern>
            </defs>
            <rect width={WIDTH} height={HEIGHT} className="route-sketch__bg" />
            <rect width={WIDTH} height={HEIGHT} fill="url(#route-sketch-grid)" />
            {path && (
                <>
                    <path d={path} className="route-sketch__halo" />
                    <path d={path} className={`route-sketch__line${approximate ? ' route-sketch__line--approx' : ''}`} />
                </>
            )}
            {from && <circle cx={from.x} cy={from.y} r="7" className="route-sketch__start" />}
            {to && <circle cx={to.x} cy={to.y} r="7" className="route-sketch__end" />}
        </svg>
    );
}

export default React.memo(RouteSketch);
