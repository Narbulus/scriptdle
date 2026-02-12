import { test, expect } from '@playwright/test';
import { getMockPuzzleForToday, mockPacks } from './fixtures/index.js';

const MOBILE_VIEWPORT = { width: 400, height: 600 };
const DESKTOP_VIEWPORT = { width: 800, height: 600 };

function getTodayDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

async function setupRedditRoutes(page) {
  const todayPuzzle = getMockPuzzleForToday();

  await page.route('**/data/daily-all/*.json', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        date: todayPuzzle.date,
        puzzles: {
          'test-pack': todayPuzzle,
        },
      }),
    });
  });

  await page.route('**/data/packs-full.json', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockPacks),
    });
  });
}

async function bootstrapRedditApp(page) {
  const date = getTodayDateString();

  await page.addInitScript(() => {
    localStorage.setItem('scriptle:hasVisited', 'true');
  });

  await page.goto('/reddit.html');
  await page.waitForTimeout(1000);

  await page.evaluate((date) => {
    window.postMessage({
      type: 'devvit-message',
      data: {
        message: {
          type: 'PUZZLE_CONFIG',
          data: {
            date,
            packId: 'test-pack',
            storageData: {},
          },
        },
      },
    }, '*');
  }, date);

  await page.waitForSelector('[data-testid="script-area"]', { timeout: 15000 });
}

test.describe('Reddit Layout - No Scroll', () => {

  test.describe('Mobile Viewport', () => {
    test.use({ viewport: MOBILE_VIEWPORT });

    test.beforeEach(async ({ page }) => {
      await setupRedditRoutes(page);
      await bootstrapRedditApp(page);
    });

    test('body overflow is hidden', async ({ page }) => {
      const htmlOverflow = await page.evaluate(() => {
        return window.getComputedStyle(document.documentElement).overflow;
      });
      expect(htmlOverflow).toBe('hidden');
    });

    test('no body left border', async ({ page }) => {
      const borderLeft = await page.evaluate(() => {
        return window.getComputedStyle(document.body).borderLeftWidth;
      });
      expect(borderLeft).toBe('0px');
    });

    test('script area fills remaining space', async ({ page }) => {
      const scriptArea = page.getByTestId('script-area');
      const footer = page.getByTestId('game-footer');
      const scriptBox = await scriptArea.boundingBox();
      const footerBox = await footer.boundingBox();
      // Script + footer should fill viewport (minus header)
      expect(scriptBox.height).toBeGreaterThan(0);
      expect(footerBox.height).toBeGreaterThan(0);
      expect(scriptBox.height + footerBox.height).toBeLessThanOrEqual(600);
    });

    test('all 3 script lines are rendered from start', async ({ page }) => {
      const scriptDisplay = page.getByTestId('script-display');
      const lines = scriptDisplay.locator('.script-line');
      await expect(lines).toHaveCount(3);
    });

    test('scroll wrapper is present for Reddit mode', async ({ page }) => {
      const scrollWrapper = page.locator('.script-scroll-wrapper');
      await expect(scrollWrapper).toBeVisible();
    });

    test('compact header height', async ({ page }) => {
      const navBar = page.locator('.reddit-nav-bar');
      await expect(navBar).toBeVisible();
      const box = await navBar.boundingBox();
      expect(box.height).toBeLessThanOrEqual(35);
    });

    test('footer grows naturally (no fullscreen takeover)', async ({ page }) => {
      const footer = page.getByTestId('game-footer');
      const box = await footer.boundingBox();
      // Footer should exist and have content but NOT cover the full viewport
      expect(box.height).toBeGreaterThan(0);
      expect(box.height).toBeLessThan(600); // less than viewport height
    });

    test('screenshot: initial gameplay state', async ({ page }) => {
      await page.screenshot({ path: 'tests/__screenshots__/reddit-mobile-initial.png' });
    });
  });

  test.describe('Desktop Viewport', () => {
    test.use({ viewport: DESKTOP_VIEWPORT });

    test.beforeEach(async ({ page }) => {
      await setupRedditRoutes(page);
      await bootstrapRedditApp(page);
    });

    test('body overflow is hidden', async ({ page }) => {
      const htmlOverflow = await page.evaluate(() => {
        return window.getComputedStyle(document.documentElement).overflow;
      });
      expect(htmlOverflow).toBe('hidden');
    });

    test('script area fills remaining space', async ({ page }) => {
      const scriptArea = page.getByTestId('script-area');
      const box = await scriptArea.boundingBox();
      expect(box.height).toBeGreaterThan(0);
    });

    test('screenshot: desktop initial state', async ({ page }) => {
      await page.screenshot({ path: 'tests/__screenshots__/reddit-desktop-initial.png' });
    });
  });
});
