import React from 'react';

// Decorative topographic contour lines (drawn with SVG ellipses; no image
// files). Used behind headlines on the login pages.
export default function ContourBackdrop() {
    const rings = Array.from({ length: 16 }, (_, i) => i + 1);
    return (
        <svg className="contours" viewBox="0 0 800 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
            <g fill="none" stroke="currentColor" strokeWidth="1.6">
                {rings.map((i) => (
                    <ellipse key={`a${i}`} cx="620" cy="220" rx={40 + i * 38} ry={30 + i * 29} transform={`rotate(${-18 + i * 0.8} 620 220)`} />
                ))}
                {rings.slice(0, 9).map((i) => (
                    <ellipse key={`b${i}`} cx="120" cy="700" rx={30 + i * 34} ry={24 + i * 25} transform={`rotate(${24 - i} 120 700)`} />
                ))}
            </g>
        </svg>
    );
}
