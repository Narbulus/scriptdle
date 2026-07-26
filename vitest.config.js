import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@devvit/client': path.resolve(__dirname, 'src/reddit/devvit-web-stub.js'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/utils/**/*.js', 'src/services/**/*.js'],
      exclude: [
        '**/*.test.js',
        'src/services/dataLoader.js',
        'src/services/storage.js',
        'src/services/theme.js',
        'src/utils/analytics.js',
        'src/utils/confetti.js',
        'src/utils/flowerGenerator.js',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
    globals: true,
  },
});
