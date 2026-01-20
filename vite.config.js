import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    open: true,
    host: true,
  },
  plugins: [
    {
      name: 'html-transform',
      transformIndexHtml(html) {
        return html.replace(
          /%VITE_GA_MEASUREMENT_ID%/g,
          process.env.VITE_GA_MEASUREMENT_ID || ''
        );
      },
    },
  ],
});
