import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Relative base so the production build can be served from any path
// (static host, Figma Code Layer preview, GitHub Pages) without rewrites.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // Vendor libraries are ~90% of the bundle and change far less often
        // than app code. Separate chunks keep each under the 500 kB warning
        // and stay cached across app-only deploys. Feature pages are small
        // (~60 kB of source), so per-route lazy loading would not pay for a
        // FeatureModule contract change.
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 30 },
            { name: 'vendor-router', test: /node_modules[\\/](react-router|cookie|set-cookie-parser)[\\/]/, priority: 20 },
            { name: 'vendor-zod', test: /node_modules[\\/]zod[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
});
