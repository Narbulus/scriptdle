import { test, expect } from '@playwright/test';

test.describe('Help Modal', () => {

    test.describe('From Home Page', () => {

        test('opens when help button clicked', async ({ page }) => {
            await page.goto('/');

            // Click help button directly
            await page.getByTestId('help-button').click();

            const modal = page.locator('#help-modal');
            await expect(modal).toBeVisible();
        });

        test('uses main theme', async ({ page }) => {
            await page.goto('/');

            // Click help button
            await page.getByTestId('help-button').click();

            const modal = page.locator('#help-modal');
            await expect(modal).toHaveAttribute('data-theme', 'main');
        });

        test('example animation loads', async ({ page }) => {
            await page.goto('/');

            // Click help button
            await page.getByTestId('help-button').click();

            // Wait for demo script container to be visible
            const demoContainer = page.locator('#demo-script-container');
            await expect(demoContainer).toBeVisible();

            // Verify example content is present (script lines)
            await expect(demoContainer.locator('.script-line').first()).toBeVisible();
        });

        test('closes when X clicked', async ({ page }) => {
            await page.goto('/');

            // Click help button
            await page.getByTestId('help-button').click();

            const modal = page.locator('#help-modal');
            await expect(modal).toBeVisible();

            // Close button has data-testid
            await modal.getByTestId('modal-close').click();
            await expect(modal).not.toBeVisible();
        });

        test('closes when clicking outside modal', async ({ page }) => {
            await page.goto('/');

            // Click help button
            await page.getByTestId('help-button').click();

            const modal = page.locator('#help-modal');
            await expect(modal).toBeVisible();

            // Click on overlay (modal itself, not the container)
            await modal.click({ position: { x: 10, y: 10 } });
            await expect(modal).not.toBeVisible();
        });
    });

    test.describe('From Game Page', () => {

        test('uses main theme even when on pack-themed page', async ({ page }) => {
            await page.goto('/');

            // Navigate to a pack
            await page.getByTestId('pack-row').first().click();
            await expect(page.locator('body')).toHaveAttribute('data-theme', 'pack');

            // Click help button
            await page.getByTestId('help-button').click();

            const modal = page.locator('#help-modal');
            await expect(modal).toBeVisible();
            await expect(modal).toHaveAttribute('data-theme', 'main');
        });
    });
});
