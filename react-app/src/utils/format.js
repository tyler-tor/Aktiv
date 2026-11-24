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
