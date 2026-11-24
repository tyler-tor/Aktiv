import { useEffect } from 'react';

// Sets document.title for the current page ("Routes | Aktiv").
// Screen readers announce the title on navigation, so every page sets one.
export default function usePageTitle(title) {
    useEffect(() => {
        document.title = title ? `${title} | Aktiv` : 'Aktiv';
    }, [title]);
}
