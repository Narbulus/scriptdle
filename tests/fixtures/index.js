import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { test as base } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const mockPuzzle = JSON.parse(
  readFileSync(join(__dirname, 'mockPuzzle.json'), 'utf-8')
);

export const mockPacks = JSON.parse(
  readFileSync(join(__dirname, 'mockPacks.json'), 'utf-8')
);

export function getTodayDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function getMockPuzzleForToday() {
  return {
    ...mockPuzzle,
    date: getTodayDateString(),
  };
}

export async function setupMockRoutes(page) {
  await page.route('**/data/packs-full.json', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockPacks),
    });
  });

  await page.route('**/data/daily-all/*.json', async route => {
    const todayPuzzle = getMockPuzzleForToday();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        date: todayPuzzle.date,
        puzzles: {
          'test-pack': todayPuzzle,
        },
        manifests: {
          'test-pack': {
            packId: 'test-pack',
            packName: 'Test Pack',
            totalPuzzles: 365,
          },
        },
      }),
    });
  });

  await page.route('**/data/daily/test-pack/*.json', async route => {
    const todayPuzzle = getMockPuzzleForToday();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(todayPuzzle),
    });
  });
}

/**
 * Marks the user as having visited before to prevent the first-visit help modal.
 * Call this after navigating to a page and before any UI interactions.
 */
export async function dismissFirstVisitModal(page) {
  await page.evaluate(() => {
    localStorage.setItem('scriptle:hasVisited', 'true');
  });
}

/**
 * Custom test fixture that automatically handles the first-visit modal.
 * Use this instead of the base test for tests that interact with the UI.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    // Add a listener to set hasVisited after each navigation
    page.on('load', async () => {
      try {
        await page.evaluate(() => {
          if (!localStorage.getItem('scriptle:hasVisited')) {
            localStorage.setItem('scriptle:hasVisited', 'true');
          }
        });
      } catch {
        // Ignore errors (e.g., if page is closed)
      }
    });
    await use(page);
  },
});
