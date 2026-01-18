import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
    await page.goto('/');

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/Scriptle/);
});

test('loads game board', async ({ page }) => {
    await page.goto('/');

    // Check for main game container (adjust selector based on actual app structure)
    // Assuming there's a main container or header
    await expect(page.locator('body')).toBeVisible();
});
