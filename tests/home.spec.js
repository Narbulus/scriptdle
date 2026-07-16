import { test, expect } from '@playwright/test';


test.describe('Home Page', () => {

    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('scriptle:hasVisited', 'true');
        });
        await page.goto('/');
    });

    test.describe('Page Load', () => {

        test('has correct title', async ({ page }) => {
            await expect(page).toHaveTitle(/Scriptle/);
        });

        test('displays navigation bar', async ({ page }) => {
            await expect(page.getByTestId('nav-bar')).toBeVisible();
            await expect(page.getByTestId('nav-logo')).toHaveText('Scriptle');
        });

        test('displays menu button', async ({ page }) => {
            await expect(page.getByTestId('menu-button')).toBeVisible();
        });

        test('displays pack rows', async ({ page }) => {
            const packRows = page.getByTestId('pack-row');
            await expect(packRows.first()).toBeVisible();
            // Verify at least one pack exists
            expect(await packRows.count()).toBeGreaterThan(0);
        });

        test('pack rows have name and movie count', async ({ page }) => {
            const firstPack = page.getByTestId('pack-row').first();
            await expect(firstPack.getByTestId('pack-name')).toBeVisible();
            await expect(firstPack.getByTestId('pack-count')).toBeVisible();
        });

        test('uses main theme on home page', async ({ page }) => {
            await expect(page.locator('body')).toHaveAttribute('data-theme', 'main');
        });
    });

    test.describe('Completion Badges', () => {

        test('shows no badge for unplayed pack', async ({ page }) => {
            // Clear localStorage and re-set hasVisited flag
            await page.evaluate(() => {
                localStorage.clear();
                localStorage.setItem('scriptle:hasVisited', 'true');
            });
            await page.reload();
            await page.waitForLoadState('networkidle');

            const firstPack = page.getByTestId('pack-row').first();
            await expect(firstPack.getByTestId('pack-badge')).toHaveCount(0);
        });

        test('shows flower badge for completed pack (win)', async ({ page }) => {

            // Get first pack's ID to test with
            const firstPackId = await page.getByTestId('pack-row').first().getAttribute('data-pack-id');

            // Mock a completed game with success
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

            const pack = page.locator(`[data-testid="pack-row"][data-pack-id="${firstPackId}"]`);
            const badge = pack.getByTestId('pack-badge');
            await expect(badge).toBeVisible();
        });

        test('shows emoji badge for completed pack (loss)', async ({ page }) => {

            // Get first pack's ID to test with
            const firstPackId = await page.getByTestId('pack-row').first().getAttribute('data-pack-id');

            // Mock a completed game with failure
            await page.evaluate((packId) => {
                const now = new Date();
                const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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

    test.describe('Navigation', () => {

        test('help button opens help modal', async ({ page }) => {

            // Click help button
            await page.getByTestId('help-button').click();

            const modal = page.locator('#help-modal');
            await expect(modal).toBeVisible();
            await expect(modal).toHaveAttribute('data-theme', 'main');
        });

        test('stats button opens stats modal', async ({ page }) => {

            // Open menu and click stats
            await page.getByTestId('menu-button').click();
            await page.getByTestId('menu-stats').click();

            // Stats modal is dynamically created - wait for any modal overlay
            const modal = page.locator('.modal-overlay').filter({ has: page.getByText(/Stats|History/i) });
            await expect(modal.first()).toBeVisible({ timeout: 5000 });
        });

        test('clicking pack navigates to game page', async ({ page }) => {

            const firstPack = page.getByTestId('pack-row').first();
            const packId = await firstPack.getAttribute('data-pack-id');

            await firstPack.click();

            await expect(page).toHaveURL(new RegExp(`/play/${packId}`));
            await expect(page.locator('body')).toHaveAttribute('data-theme', 'pack');
        });

        test('returning from pack restores main theme', async ({ page }) => {

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
                const hasContent = await page.getByTestId('script-area').or(page.getByTestId('script-skeleton')).first().isVisible();
                expect(hasContent).toBeTruthy();
            }
        });
    });
});
