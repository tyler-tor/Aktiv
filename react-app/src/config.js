// Frontend configuration that is baked into the bundle at build time.
//
// Google Maps browser key: create it in Google Cloud Console, restrict it by
// HTTP referrer (your site + localhost) and by API (Maps JavaScript API,
// Static Maps API). Put it in react-app/.env.local (never committed):
//   REACT_APP_GOOGLE_MAPS_API_KEY=your-key
// CRA reads it when you run `npm start` / `npm run build`; restart after
// changing it. A browser key is public by nature (anyone can see it in the
// page), which is why the referrer/API restrictions matter.
export const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

if (!GOOGLE_MAPS_API_KEY && process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('REACT_APP_GOOGLE_MAPS_API_KEY is not set: maps will not load. See react-app/.env.example');
}
