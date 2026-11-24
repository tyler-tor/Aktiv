import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { formatDistance, formatPace, formatSpeed } from '../utils/format';

// km / mi preference. Stored in localStorage so it survives reloads; the first
// visit guesses from the browser language (miles for en-US, km elsewhere).
const STORAGE_KEY = 'aktiv.unit';

const guessUnit = () => {
    try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved === 'km' || saved === 'mi') return saved;
    } catch {
        // localStorage can be blocked; fall through
    }
    const lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
    return lang === 'en-US' ? 'mi' : 'km';
};

const defaultValue = {
    unit: 'km',
    setUnit: () => {},
    toggleUnit: () => {},
    distance: (meters) => formatDistance(meters, 'km'),
    pace: (meters, seconds) => formatPace(meters, seconds, 'km'),
    speed: (meters, seconds) => formatSpeed(meters, seconds, 'km'),
};

const UnitsContext = createContext(defaultValue);

export function UnitsProvider({ children }) {
    const [unit, setUnitState] = useState(guessUnit);

    const setUnit = useCallback((next) => {
        setUnitState(next);
        try {
            window.localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // ignore
        }
    }, []);

    const value = useMemo(() => ({
        unit,
        setUnit,
        toggleUnit: () => setUnit(unit === 'km' ? 'mi' : 'km'),
        distance: (meters) => formatDistance(meters, unit),
        pace: (meters, seconds) => formatPace(meters, seconds, unit),
        speed: (meters, seconds) => formatSpeed(meters, seconds, unit),
    }), [unit, setUnit]);

    return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>;
}

// { unit, setUnit, toggleUnit, distance(m), pace(m, s), speed(m, s) }
export function useUnits() {
    return useContext(UnitsContext);
}
