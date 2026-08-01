import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The API has no CORS headers, and it doesn't need any: the dev server proxies
// task requests to it, so the browser only ever talks to this origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      ['/tasks', '/stats', '/reset', '/health', '/auth', '/protected', '/public'].map((path) => [
        path,
        { target: 'http://localhost:3000', changeOrigin: true },
      ]),
    ),
  },
});
