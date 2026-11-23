import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Same port as the old Create React App dev server, so existing Google
    // Maps key referrer restrictions (http://localhost:3000/*) keep working.
    port: 3000,
    // In development the browser talks only to Vite (localhost:3000); Vite
    // forwards every /api request to Flask, so cookies stay same-origin and
    // no CORS is needed (same as CRA's "proxy" setting before).
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
  build: {
    // `npm run build` writes react-app/dist/, which Flask serves in
    // production (static_folder in app/__init__.py) or which can be
    // uploaded to S3/CloudFront later.
    outDir: 'dist',
  },
});
