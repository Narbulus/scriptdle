import { defineConfig } from 'vitest/config';

export default defineConfig({
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
