import { test, expect } from '@playwright/test';


test.describe('Visual Regression', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('scriptle:hasVisited', 'true');
    });
    await page.goto('/');
  });

  test.describe('Homepage', () => {

    test('homepage light theme', async ({ page }) => {
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => {
        document.body.setAttribute('data-theme', 'light');
      });
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot('homepage-light.png', {
        fullPage: true,
      });
    });

    test('homepage dark theme', async ({ page }) => {
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => {
        document.body.setAttribute('data-theme', 'dark');
      });
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot('homepage-dark.png', {
        fullPage: true,
      });
    });
  });

  test.describe('Game Page', () => {

    test('game page with quote visible', async ({ page }) => {
      await page.getByTestId('pack-row').first().click();
      await page.waitForLoadState('networkidle');
      await expect(page.getByTestId('script-area')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot('game-page.png', {
        fullPage: true,
      });
    });

    test('game controls visible', async ({ page }) => {
      await page.getByTestId('pack-row').first().click();
      await page.waitForLoadState('networkidle');
      await expect(page.getByTestId('guess-button')).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId('game-controls')).toHaveScreenshot('game-controls.png');
    });
  });

  test.describe('Completion State', () => {

    test('win state', async ({ page }) => {
      const firstPackId = await page.getByTestId('pack-row').first().getAttribute('data-pack-id');

      await page.evaluate((packId) => {
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        localStorage.setItem(`scriptle:${packId}:${today}`, JSON.stringify({
          version: 2,
          attempts: 2,
          movieLocked: true,
          characterLocked: true,
          guessStats: [
            { movie: true, char: false },
            { movie: true, char: true }
          ],
          gameOver: true,
          success: true,
          completedAt: new Date().toISOString()
        }));
      }, firstPackId);

      await page.goto(`/play/${firstPackId}`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByTestId('share-container')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(500);
      await expect(page.getByTestId('share-container')).toHaveScreenshot('completion-win.png');
    });

    test('loss state', async ({ page }) => {
      const firstPackId = await page.getByTestId('pack-row').first().getAttribute('data-pack-id');

      await page.evaluate((packId) => {
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        localStorage.setItem(`scriptle:${packId}:${today}`, JSON.stringify({
          version: 2,
          attempts: 5,
          movieLocked: false,
          characterLocked: false,
          guessStats: [
            { movie: false, char: false },
            { movie: false, char: false },
            { movie: false, char: false },
            { movie: false, char: false },
            { movie: false, char: false }
          ],
          gameOver: true,
          success: false,
          completedAt: new Date().toISOString()
        }));
      }, firstPackId);

      await page.goto(`/play/${firstPackId}`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByTestId('share-container')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(500);
      await expect(page.getByTestId('share-container')).toHaveScreenshot('completion-loss.png');
    });
  });

  test.describe('Help Modal', () => {

    test('help modal appearance', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const helpButton = page.getByTestId('help-button');
      if (await helpButton.isVisible()) {
        await helpButton.click();
        await page.waitForTimeout(500);
        const helpModal = page.locator('#help-modal');
        await expect(helpModal).toBeVisible({ timeout: 5000 });
        await expect(helpModal).toHaveScreenshot('help-modal.png');
      }
    });
  });
});
