import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

// A single-page app does not reload on navigation, so keyboard and screen
// reader users would stay focused on the link they clicked. After each
// navigation (not the first load) move focus to the main content area.
export default function RouteFocus() {
    const { pathname } = useLocation();
    const first = useRef(true);
    useEffect(() => {
        if (first.current) { first.current = false; return; }
        document.getElementById('main')?.focus({ preventScroll: false });
    }, [pathname]);
    return null;
}
