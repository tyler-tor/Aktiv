// Frontend configuration that is baked into the bundle at build time.
//
// Google Maps browser key: create it in Google Cloud Console, restrict it by
// HTTP referrer (your site + localhost) and by API (Maps JavaScript API,
// Static Maps API). Put it in react-app/.env.local (never committed):
//   VITE_GOOGLE_MAPS_API_KEY=your-key
// Vite only exposes variables starting with VITE_, and reads them when you
// run `npm run dev` / `npm run build`; restart after changing it.
// A browser key is public by nature (anyone can see it in the page), which
// is why the referrer/API restrictions matter.
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

if (!GOOGLE_MAPS_API_KEY && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn('VITE_GOOGLE_MAPS_API_KEY is not set: maps will not load. See react-app/.env.example');
}

// Map ID: Advanced Markers (pins) only work on a map that has a Map ID.
// Create one in Google Cloud Console (Map Management, Maps JavaScript API,
// "Vector" or "Raster") and set VITE_GOOGLE_MAPS_MAP_ID. Without it the app
// uses Google's shared DEMO_MAP_ID, which works for development but cannot be
// styled and is not meant for production.
export const GOOGLE_MAPS_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';
