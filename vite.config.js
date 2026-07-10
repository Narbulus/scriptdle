import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

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
      '@devvit/web/client': path.resolve(__dirname, 'src/reddit/devvit-web-stub.js'),
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
    },
  ],
});
