import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {

    test.describe('Page Load', () => {

        test('has correct title', async ({ page }) => {
            await page.goto('/');
            await expect(page).toHaveTitle(/Scriptle/);
        });

        test('displays navigation bar', async ({ page }) => {
            await page.goto('/');
            await expect(page.getByTestId('nav-bar')).toBeVisible();
            await expect(page.getByTestId('nav-logo')).toHaveText('Scriptle');
        });

        test('displays footer', async ({ page }) => {
            await page.goto('/');
            await expect(page.getByTestId('footer-bar')).toBeVisible();
        });

        test('displays pack rows', async ({ page }) => {
            await page.goto('/');
            const packRows = page.getByTestId('pack-row');
            await expect(packRows.first()).toBeVisible();
            // Verify at least one pack exists
            expect(await packRows.count()).toBeGreaterThan(0);
        });

        test('pack rows have name and movie count', async ({ page }) => {
            await page.goto('/');
            const firstPack = page.getByTestId('pack-row').first();
            await expect(firstPack.getByTestId('pack-name')).toBeVisible();
            await expect(firstPack.getByTestId('pack-count')).toBeVisible();
        });

        test('uses main theme on home page', async ({ page }) => {
            await page.goto('/');
            await expect(page.locator('body')).toHaveAttribute('data-theme', 'main');
        });
    });

    test.describe('Completion Badges', () => {

        test('shows no badge for unplayed pack', async ({ page }) => {
            // Clear localStorage before navigating
            await page.goto('/');
            await page.evaluate(() => localStorage.clear());
            await page.reload();
            await page.waitForLoadState('networkidle');

            const firstPack = page.getByTestId('pack-row').first();
            await expect(firstPack.getByTestId('pack-badge')).toHaveCount(0);
        });

        test('shows flower badge for completed pack (win)', async ({ page }) => {
            await page.goto('/');

            // Get first pack's ID to test with
            const firstPackId = await page.getByTestId('pack-row').first().getAttribute('data-pack-id');

            // Mock a completed game with success
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

            const pack = page.locator(`[data-testid="pack-row"][data-pack-id="${firstPackId}"]`);
            const badge = pack.getByTestId('pack-badge');
            await expect(badge).toBeVisible();
        });

        test('shows emoji badge for completed pack (loss)', async ({ page }) => {
            await page.goto('/');

            // Get first pack's ID to test with
            const firstPackId = await page.getByTestId('pack-row').first().getAttribute('data-pack-id');

            // Mock a completed game with failure
            await page.evaluate((packId) => {
                const today = new Date().toISOString().split('T')[0];
                localStorage.setItem(`scriptle:${packId}:${today}`, JSON.stringify({
                    gameOver: true,
                    success: false,
                    attempts: 5,
                    completedAt: new Date().toISOString()
                }));
            }, firstPackId);

            await page.reload();
            await page.waitForLoadState('networkidle');

            const pack = page.locator(`[data-testid="pack-row"][data-pack-id="${firstPackId}"]`);
            const badge = pack.getByTestId('pack-badge');
            await expect(badge).toBeVisible();
        });
    });

    test.describe('Recently Played Section', () => {

        test('shows recently played section when packs played', async ({ page }) => {
            await page.goto('/');

            // Get first pack's ID to test with
            const firstPackId = await page.getByTestId('pack-row').first().getAttribute('data-pack-id');

            // Mock a recent game
            await page.evaluate((packId) => {
                const today = new Date().toISOString().split('T')[0];
                localStorage.setItem(`scriptle:${packId}:${today}`, JSON.stringify({
                    gameOver: true,
                    success: true,
                    attempts: 2
                }));
            }, firstPackId);

            await page.reload();
            await page.waitForLoadState('networkidle');

            // Look for the heading text
            const recentlyPlayed = page.getByText(/Recently Played/i);
            await expect(recentlyPlayed).toBeVisible();
        });

        test('hides recently played section with no games', async ({ page }) => {
            await page.goto('/');
            await page.evaluate(() => localStorage.clear());
            await page.reload();
            await page.waitForLoadState('networkidle');

            // Should not have recently played section
            const recentlyPlayed = page.getByText(/Recently Played/i);
            await expect(recentlyPlayed).not.toBeVisible();
        });
    });

    test.describe('Navigation', () => {

        test('help button opens help modal', async ({ page }) => {
            await page.goto('/');
            await page.getByTestId('help-button').click();

            const modal = page.locator('#help-modal');
            await expect(modal).toBeVisible();
            await expect(modal).toHaveAttribute('data-theme', 'main');
        });

        test('stats button opens stats modal', async ({ page }) => {
            await page.goto('/');
            await page.getByTestId('stats-button').click();

            // Stats modal is dynamically created - wait for any modal overlay
            const modal = page.locator('.modal-overlay').filter({ has: page.getByText(/Stats|History/i) });
            await expect(modal.first()).toBeVisible({ timeout: 5000 });
        });

        test('clicking pack navigates to game page', async ({ page }) => {
            await page.goto('/');

            const firstPack = page.getByTestId('pack-row').first();
            const packId = await firstPack.getAttribute('data-pack-id');

            await firstPack.click();

            await expect(page).toHaveURL(new RegExp(`/play/${packId}`));
            await expect(page.locator('body')).toHaveAttribute('data-theme', 'pack');
        });

        test('returning from pack restores main theme', async ({ page }) => {
            await page.goto('/');

            // Navigate to pack
            await page.getByTestId('pack-row').first().click();
            await expect(page.locator('body')).toHaveAttribute('data-theme', 'pack');

            // Go back to home
            await page.goBack();
            await expect(page.locator('body')).toHaveAttribute('data-theme', 'main');
        });
    });

    test.describe('All Packs Load', () => {

        test('first three packs navigate without errors', async ({ page }) => {
            await page.goto('/');

            const packRows = page.getByTestId('pack-row');
            const count = await packRows.count();

            // Test first 3 packs (or all if fewer)
            const testCount = Math.min(count, 3);
            const packIds = [];
            for (let i = 0; i < testCount; i++) {
                const packId = await packRows.nth(i).getAttribute('data-pack-id');
                if (packId) packIds.push(packId);
            }

            // Test each pack loads
            for (const packId of packIds) {
                await page.goto(`/play/${packId}`);
                await page.waitForTimeout(3000);

                // Check if script area or loading is visible
                const hasContent = await page.getByTestId('script-area').or(page.locator('#loading')).first().isVisible();
                expect(hasContent).toBeTruthy();
            }
        });
    });
});
