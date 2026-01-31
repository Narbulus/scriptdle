import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
