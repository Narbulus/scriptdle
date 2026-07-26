import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));

export default defineConfig({
  root: '.',
  publicDir: false,
  build: {
    outDir: 'scriptlegame/webroot',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'reddit.html'),
    },
  },
  resolve: {
    alias: {
      // Replace analytics with no-op stub for Reddit build
      [path.resolve(__dirname, 'src/utils/analytics.js')]:
        path.resolve(__dirname, 'src/reddit/reddit-analytics.js'),
      // Replace build-info with empty module
      [path.resolve(__dirname, 'src/build-info.js')]:
        path.resolve(__dirname, 'src/reddit/reddit-analytics.js'),
    },
  },
  define: {
    'import.meta.env.APP_VERSION': JSON.stringify(pkg.version),
  },
  plugins: [preact()],
});
