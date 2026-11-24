// Small display helpers shared by the pages. The API sends timestamps as ISO
// 8601 UTC strings ("2026-11-24T09:30:00Z"); these turn them into text.

const toDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

// "Nov 24, 2026"
export const formatDate = (value) => {
    const date = toDate(value);
    return date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
};

// "November 2026" (used for "Member since")
export const formatMonthYear = (value) => {
    const date = toDate(value);
    return date ? date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';
};

// ---- distance, time and pace (the API stores metres and seconds) ----

export const METERS_PER_MILE = 1609.344;

// Metres -> "16.2 km" or "10.1 mi". `unit` is 'km' or 'mi'.
export const formatDistance = (meters, unit = 'km') => {
    if (meters === null || meters === undefined || Number.isNaN(Number(meters))) return '';
    const value = unit === 'mi' ? meters / METERS_PER_MILE : meters / 1000;
    return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${unit}`;
};

// Metres -> a number in the chosen unit (for form fields)
export const metersToUnit = (meters, unit = 'km') =>
    Math.round((unit === 'mi' ? meters / METERS_PER_MILE : meters / 1000) * 100) / 100;

// A number in the chosen unit -> metres (for form fields)
export const unitToMeters = (value, unit = 'km') =>
    Number(value) * (unit === 'mi' ? METERS_PER_MILE : 1000);

// Seconds -> "42 min", "1 h 20 min", "3 h"
export const formatDuration = (seconds) => {
    if (seconds === null || seconds === undefined || Number.isNaN(Number(seconds))) return '';
    const total = Math.round(Number(seconds) / 60);
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    if (hours === 0) return `${minutes} min`;
    return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
};

// Distance + time -> "8:21 /mi" (minutes per unit)
export const formatPace = (meters, seconds, unit = 'km') => {
    if (!meters || !seconds) return '';
    const perUnit = seconds / (unit === 'mi' ? meters / METERS_PER_MILE : meters / 1000);
    const whole = Math.round(perUnit);
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')} /${unit}`;
};

// Distance + time -> "24.3 km/h" or "15.1 mph" (used for cycling)
export const formatSpeed = (meters, seconds, unit = 'km') => {
    if (!meters || !seconds) return '';
    const hours = seconds / 3600;
    const value = (unit === 'mi' ? meters / METERS_PER_MILE : meters / 1000) / hours;
    return `${value.toFixed(1)} ${unit === 'mi' ? 'mph' : 'km/h'}`;
};

// "running" / "Run" / "BICYCLING" -> 'run' | 'bike' | 'hike' | 'walk' | 'other'
export const activityKind = (text) => {
    const t = String(text || '').toLowerCase();
    if (t.startsWith('run')) return 'run';
    if (t.startsWith('bik') || t.startsWith('bicy') || t.startsWith('cycl')) return 'bike';
    if (t.startsWith('hik')) return 'hike';
    if (t.startsWith('walk')) return 'walk';
    return 'other';
};

// "running" / "Run" / "WALKING" / "BICYCLING" -> "Run" | "Ride" | "Hike" | "Walk" | "Cardio"...
export const activityLabel = (text) => {
    switch (activityKind(text)) {
        case 'run': return 'Run';
        case 'bike': return 'Ride';
        case 'hike': return 'Hike';
        case 'walk': return 'Walk';
        default: {
            const t = String(text || 'Workout');
            return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
        }
    }
};
