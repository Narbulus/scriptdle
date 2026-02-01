import { test, expect } from '@playwright/test';

test.describe('Help Modal', () => {

    test.describe('First Visit', () => {

        test('opens automatically for first-time visitor', async ({ page }) => {
            await page.goto('/');
            await page.evaluate(() => localStorage.clear());
            await page.reload();

            const modal = page.locator('#help-modal');
            await expect(modal).toBeVisible();
        });

        test('sets hasVisited flag after showing', async ({ page }) => {
            await page.goto('/');
            await page.evaluate(() => localStorage.clear());
            await page.reload();

            const hasVisited = await page.evaluate(() => localStorage.getItem('scriptle:hasVisited'));
            expect(hasVisited).toBe('true');
        });

        test('does not open for returning visitor with hasVisited flag', async ({ page }) => {
            await page.goto('/');
            await page.evaluate(() => {
                localStorage.clear();
                localStorage.setItem('scriptle:hasVisited', 'true');
            });
            await page.reload();

            const modal = page.locator('#help-modal');
            await expect(modal).not.toBeVisible();
        });

        test('does not open for returning visitor with existing game data', async ({ page }) => {
            await page.goto('/');
            await page.evaluate(() => {
                localStorage.clear();
                localStorage.setItem('scriptle:test-pack:2026-01-01', JSON.stringify({
                    gameOver: true,
                    success: true
                }));
            });
            await page.reload();

            const modal = page.locator('#help-modal');
            await expect(modal).not.toBeVisible();
        });
    });

    test.describe('From Home Page', () => {

        test.beforeEach(async ({ page }) => {
            await page.goto('/');
            await page.evaluate(() => localStorage.setItem('scriptle:hasVisited', 'true'));
            await page.reload();
        });

        test('opens when help button clicked', async ({ page }) => {
            await page.getByTestId('help-button').click();

            const modal = page.locator('#help-modal');
            await expect(modal).toBeVisible();
        });

        test('uses main theme', async ({ page }) => {
            await page.getByTestId('help-button').click();

            const modal = page.locator('#help-modal');
            await expect(modal).toHaveAttribute('data-theme', 'main');
        });

        test('example animation loads', async ({ page }) => {
            await page.getByTestId('help-button').click();

            const demoContainer = page.locator('#demo-script-container');
            await expect(demoContainer).toBeVisible();

            await expect(demoContainer.locator('.script-line').first()).toBeVisible();
        });

        test('closes when X clicked', async ({ page }) => {
            await page.getByTestId('help-button').click();

            const modal = page.locator('#help-modal');
            await expect(modal).toBeVisible();

            await modal.getByTestId('modal-close').click();
            await expect(modal).not.toBeVisible();
        });

        test('closes when clicking outside modal', async ({ page }) => {
            await page.getByTestId('help-button').click();

            const modal = page.locator('#help-modal');
            await expect(modal).toBeVisible();

            await modal.click({ position: { x: 10, y: 10 } });
            await expect(modal).not.toBeVisible();
        });
    });

    test.describe('From Game Page', () => {

        test('uses main theme even when on pack-themed page', async ({ page }) => {
            await page.goto('/');
            await page.evaluate(() => localStorage.setItem('scriptle:hasVisited', 'true'));
            await page.reload();

            await page.getByTestId('pack-row').first().click();
            await expect(page.locator('body')).toHaveAttribute('data-theme', 'pack');

            await page.getByTestId('help-button').click();

            const modal = page.locator('#help-modal');
            await expect(modal).toBeVisible();
            await expect(modal).toHaveAttribute('data-theme', 'main');
        });
    });
});
