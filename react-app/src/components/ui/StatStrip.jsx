import React from 'react';

// Big-number stats: [{ label: 'Distance', value: '16.2', unit: 'km' }, ...]
// Uses a description list so screen readers hear "Distance, 16.2 km".
export default function StatStrip({ items }) {
    const shown = items.filter((item) => item && item.value !== '' && item.value !== null && item.value !== undefined);
    if (!shown.length) return null;
    return (
        <dl className="stats">
            {shown.map((item) => (
                <div className="stat" key={item.label}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}{item.unit && <small>{item.unit}</small>}</dd>
                </div>
            ))}
        </dl>
    );
}
