import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
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
