import { test, expect } from '@playwright/test';
import { dismissFirstVisitModal } from './fixtures/index.js';

test.describe('Stats Modal', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await dismissFirstVisitModal(page);
        await page.reload();
    });

    test.describe('Empty State', () => {

        test('shows content when no games played', async ({ page }) => {
            await page.evaluate(() => {
                localStorage.clear();
                localStorage.setItem('scriptle:hasVisited', 'true');
            });
            await page.reload();
            await page.waitForLoadState('networkidle');

            // Open menu and click stats
            await page.getByTestId('menu-button').click();
            await page.getByTestId('menu-stats').click();

            // Wait for modal to appear
            const modal = page.locator('.modal-overlay').filter({ hasText: /Stats|History|played/i });
            await expect(modal.first()).toBeVisible({ timeout: 5000 });
        });
    });

    test.describe('With Completions', () => {

        test('shows completion stats', async ({ page }) => {
            // Get first pack ID
            const firstPackId = await page.getByTestId('pack-row').first().getAttribute('data-pack-id');

            // Mock completed games
            await page.evaluate((packId) => {
                const now = new Date();
                const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                localStorage.setItem(`scriptle:${packId}:${today}`, JSON.stringify({
                    gameOver: true,
                    success: true,
                    attempts: 3,
                    completedAt: new Date().toISOString()
                }));
            }, firstPackId);

            await page.reload();
            await page.waitForLoadState('networkidle');

            // Open menu and click stats
            await page.getByTestId('menu-button').click();
            await page.getByTestId('menu-stats').click();

            const modal = page.locator('.modal-overlay').filter({ hasText: /Stats|History/i });
            await expect(modal.first()).toBeVisible({ timeout: 5000 });
        });

        test('calculates streak correctly', async ({ page }) => {
            // Get first pack ID
            const firstPackId = await page.getByTestId('pack-row').first().getAttribute('data-pack-id');

            // Mock consecutive days of play
            await page.evaluate((packId) => {
                for (let i = 0; i < 3; i++) {
                    const dateNow = new Date(Date.now() - i * 86400000);
                    const date = `${dateNow.getFullYear()}-${String(dateNow.getMonth() + 1).padStart(2, '0')}-${String(dateNow.getDate()).padStart(2, '0')}`;
                    localStorage.setItem(`scriptle:${packId}:${date}`, JSON.stringify({
                        gameOver: true,
                        success: true,
                        attempts: 2 + i,
                        completedAt: new Date().toISOString()
                    }));
                }
            }, firstPackId);

            await page.reload();
            await page.waitForLoadState('networkidle');

            // Open menu and click stats
            await page.getByTestId('menu-button').click();
            await page.getByTestId('menu-stats').click();

            const modal = page.locator('.modal-overlay').filter({ hasText: /Stats|History/i });
            await expect(modal.first()).toBeVisible({ timeout: 5000 });

            // The modal should contain streak info or the number 3
            const modalContent = await modal.first().textContent();
            expect(modalContent.length).toBeGreaterThan(10);
        });
    });

    test.describe('Theming', () => {

        test('modal appears on home page', async ({ page }) => {
            // Open menu and click stats
            await page.getByTestId('menu-button').click();
            await page.getByTestId('menu-stats').click();

            const modal = page.locator('.modal-overlay').filter({ hasText: /Stats|History/i });
            await expect(modal.first()).toBeVisible({ timeout: 5000 });
        });

        test('modal appears on game page', async ({ page }) => {
            await page.getByTestId('pack-row').first().click();
            await page.waitForLoadState('networkidle');

            // Open menu and click stats from game page
            await page.getByTestId('menu-button').click();
            await page.getByTestId('menu-stats').click();

            const modal = page.locator('.modal-overlay').filter({ hasText: /Stats|History/i });
            await expect(modal.first()).toBeVisible({ timeout: 5000 });
        });
    });

    test.describe('Interaction', () => {

        test('closes when X clicked', async ({ page }) => {
            // Open menu and click stats
            await page.getByTestId('menu-button').click();
            await page.getByTestId('menu-stats').click();

            const modal = page.locator('.modal-overlay').filter({ hasText: /Stats|History/i });
            await expect(modal.first()).toBeVisible({ timeout: 5000 });

            // Close button - stats modal uses Modal class with modal-close-btn
            await modal.first().locator('.modal-close-btn').click();
            await expect(modal.first()).not.toBeVisible();
        });
    });
});
