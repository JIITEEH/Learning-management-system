import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // 5174, so this runs alongside ThesisTrack, which uses 5173
    port: 5174,
    strictPort: true,
    // Forward API calls to Express, so the screens use relative URLs like /api/courses and the
    // browser sees one site, which the session cookie needs.
    // changeOrigin: false keeps the address the browser used (localhost:5174) in the Host header.
    // The server compares it with the Origin header to refuse requests sent from other websites;
    // if Vite rewrote it to localhost:3000, every request would look like it came from elsewhere.
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: false },
    },
  },
});
