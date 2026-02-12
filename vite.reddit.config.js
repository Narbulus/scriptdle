import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: '.',
  publicDir: false,
  build: {
    outDir: 'scriptlegame/webroot',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'reddit.html'),
      external: ['@devvit/web/client'],
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
  plugins: [preact()],
});
