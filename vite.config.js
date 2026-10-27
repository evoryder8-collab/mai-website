import { defineConfig } from 'vite';

// Relative base so the build works at any path, including GitHub Pages' /mai-website/.
export default defineConfig({
  base: './',
  // MapLibre starts its worker as an ES module.
  worker: { format: 'es' },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    // three.js and MapLibre are large but load lazily, after first paint.
    chunkSizeWarningLimit: 1200,
  },
});
