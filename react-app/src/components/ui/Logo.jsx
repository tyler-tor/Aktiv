import React from 'react';

// The Aktiv mark: a rounded square holding a trail that climbs and drops over
// two summits, ending in a ring (the finish). Drawn here, owned by the project.
export function LogoMark({ size = 34 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
            <rect width="40" height="40" rx="12" fill="var(--accent)" />
            <path d="M7 28 C 12 28, 13 12, 18 12 S 23 28, 28 20" fill="none" stroke="var(--on-accent)"
                strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="31.5" cy="14.5" r="3.2" fill="none" stroke="var(--on-accent)" strokeWidth="2.6" />
        </svg>
    );
}

export default function Logo() {
    return (
        <span className="logo">
            <LogoMark />
            <span className="logo__word">aktiv</span>
        </span>
    );
}
