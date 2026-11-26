import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, rmSync, existsSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@devvit/client': path.resolve(__dirname, 'src/reddit/devvit-web-stub.js'),
    },
  },
  define: {
    'import.meta.env.APP_VERSION': JSON.stringify(pkg.version),
  },
  server: {
    port: 6767,
    open: true,
    host: true,
  },
  plugins: [
    preact(),
    {
      name: 'html-transform',
      transformIndexHtml(html) {
        return html.replace(
          /__GA_MEASUREMENT_ID__/g,
          process.env.VITE_GA_MEASUREMENT_ID || ''
        );
      },
      closeBundle() {
        // Strip raw script sources and internal/intermediate files so they are never
        // publicly served on Cloudflare Pages (protects pack data moat & stays well
        // under Cloudflare Pages' 20,000-file limit).
        const stripPaths = [
          'dist/data/daily',
          'dist/data/scripts',
          'dist/data/packs',
          'dist/data/index.json',
          'dist/data/puzzle-overrides.json',
          'dist/share-test.html',
          'dist/.DS_Store',
        ];
        for (const relPath of stripPaths) {
          const fullPath = path.resolve(__dirname, relPath);
          if (existsSync(fullPath)) {
            rmSync(fullPath, { recursive: true, force: true });
          }
        }
      },
    },
  ],
});
