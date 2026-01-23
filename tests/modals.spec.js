import { test, expect } from '@playwright/test';

test.describe('Modal Theming', () => {

    test('Help modal uses main theme on Home Page', async ({ page }) => {
        await page.goto('/');

        // Open Help Modal
        await page.locator('.nav-help-btn').click();

        // Check visibility
        const modal = page.locator('#help-modal');
        await expect(modal).toBeVisible();

        // Verify data-theme="main"
        await expect(modal).toHaveAttribute('data-theme', 'main');
    });

    test('Help modal uses main theme on Game Page', async ({ page }) => {
        // Navigate to a game page (assuming 'pixar' pack exists from previous context or standard packs)
        // We'll use the first pack link found on home to be generic
        await page.goto('/');
        await page.locator('.pack-row').first().click();

        // Verify we are on a game page (theme should be pack)
        await expect(page.locator('body')).toHaveAttribute('data-theme', 'pack');

        // Open Help Modal
        await page.locator('.nav-help-btn').click();

        // Check visibility
        const modal = page.locator('#help-modal');
        await expect(modal).toBeVisible();

        // Verify data-theme="main" (CRITICAL CHECK)
        await expect(modal).toHaveAttribute('data-theme', 'main');
    });
});
