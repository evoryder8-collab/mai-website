import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';

const root = import.meta.dirname;
const PAGES = ['index.html', 'award/index.html', 'about/index.html', 'treatments/index.html', 'visit/index.html'];

// Shared markup: <!-- partial:header --> becomes src/partials/header.html.
// Inside a page, {{root}} is the relative path back to the home page (so links work
// under /mai-website/ on GitHub Pages), and nav links whose data-nav matches
// <body data-page> are marked aria-current="page".
function partials() {
  return {
    name: 'mai-partials',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const depth = dirname(relative(root, ctx.filename)).split(sep).filter((s) => s && s !== '.').length;
        const page = html.match(/<body[^>]*data-page="([^"]+)"/)?.[1];
        return html
          .replace(/<!-- partial:([\w-]+) -->/g, (_, name) => readFileSync(resolve(root, `src/partials/${name}.html`), 'utf8'))
          .replaceAll('{{root}}', depth ? '../'.repeat(depth) : './')
          .replaceAll(`data-nav="${page}"`, `data-nav="${page}" aria-current="page"`);
      },
    },
    handleHotUpdate({ file, server }) {
      if (file.includes(`${sep}partials${sep}`)) server.ws.send({ type: 'full-reload' });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [partials()],
  // MapLibre's worker is an ES module.
  worker: { format: 'es' },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200,
    rollupOptions: { input: Object.fromEntries(PAGES.map((p) => [dirname(p) === '.' ? 'home' : dirname(p), resolve(root, p)])) },
  },
});
