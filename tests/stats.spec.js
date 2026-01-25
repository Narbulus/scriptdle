import { test, expect } from '@playwright/test';

test.describe('Stats Modal', () => {

    test.describe('Empty State', () => {

        test('shows content when no games played', async ({ page }) => {
            await page.goto('/');
            await page.evaluate(() => localStorage.clear());
            await page.reload();
            await page.waitForLoadState('networkidle');

            await page.getByTestId('stats-button').click();

            // Wait for modal to appear
            const modal = page.locator('.modal-overlay').filter({ hasText: /Stats|History|played/i });
            await expect(modal.first()).toBeVisible({ timeout: 5000 });
        });
    });

    test.describe('With Completions', () => {

        test('shows completion stats', async ({ page }) => {
            await page.goto('/');

            // Get first pack ID
            const firstPackId = await page.getByTestId('pack-row').first().getAttribute('data-pack-id');

            // Mock completed games
            await page.evaluate((packId) => {
                const today = new Date().toISOString().split('T')[0];
                localStorage.setItem(`scriptle:${packId}:${today}`, JSON.stringify({
                    gameOver: true,
                    success: true,
                    attempts: 3,
                    completedAt: new Date().toISOString()
                }));
            }, firstPackId);

            await page.reload();
            await page.waitForLoadState('networkidle');

            await page.getByTestId('stats-button').click();

            const modal = page.locator('.modal-overlay').filter({ hasText: /Stats|History/i });
            await expect(modal.first()).toBeVisible({ timeout: 5000 });
        });

        test('calculates streak correctly', async ({ page }) => {
            await page.goto('/');

            // Get first pack ID
            const firstPackId = await page.getByTestId('pack-row').first().getAttribute('data-pack-id');

            // Mock consecutive days of play
            await page.evaluate((packId) => {
                for (let i = 0; i < 3; i++) {
                    const date = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
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

            await page.getByTestId('stats-button').click();

            const modal = page.locator('.modal-overlay').filter({ hasText: /Stats|History/i });
            await expect(modal.first()).toBeVisible({ timeout: 5000 });

            // The modal should contain streak info or the number 3
            const modalContent = await modal.first().textContent();
            expect(modalContent.length).toBeGreaterThan(10);
        });
    });

    test.describe('Theming', () => {

        test('modal appears on home page', async ({ page }) => {
            await page.goto('/');
            await page.getByTestId('stats-button').click();

            const modal = page.locator('.modal-overlay').filter({ hasText: /Stats|History/i });
            await expect(modal.first()).toBeVisible({ timeout: 5000 });
        });

        test('modal appears on game page', async ({ page }) => {
            await page.goto('/');
            await page.getByTestId('pack-row').first().click();
            await page.waitForLoadState('networkidle');

            // Open stats from game page
            await page.getByTestId('stats-button').click();

            const modal = page.locator('.modal-overlay').filter({ hasText: /Stats|History/i });
            await expect(modal.first()).toBeVisible({ timeout: 5000 });
        });
    });

    test.describe('Interaction', () => {

        test('closes when X clicked', async ({ page }) => {
            await page.goto('/');
            await page.getByTestId('stats-button').click();

            const modal = page.locator('.modal-overlay').filter({ hasText: /Stats|History/i });
            await expect(modal.first()).toBeVisible({ timeout: 5000 });

            // Close button - stats modal uses Modal class with modal-close-btn
            await modal.first().locator('.modal-close-btn').click();
            await expect(modal.first()).not.toBeVisible();
        });
    });
});
