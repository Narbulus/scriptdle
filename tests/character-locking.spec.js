import { test, expect } from '@playwright/test';

test.describe('Character Locking', () => {

    test('character locks when guessed correctly with wrong movie', async ({ page }) => {
        await page.goto('/');

        const firstPackId = await page.getByTestId('pack-row').first().getAttribute('data-pack-id');

        // Set up a game where character is locked but movie is not
        await page.evaluate((packId) => {
            const now = new Date();
            const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            localStorage.setItem(`scriptle:${packId}:${today}`, JSON.stringify({
                version: 2,
                attempts: 1,
                movieLocked: false,
                characterLocked: true,
                guessStats: [
                    { movie: false, char: true }
                ],
                gameOver: false,
                success: false
            }));
        }, firstPackId);

        await page.goto(`/play/${firstPackId}`);
        await page.waitForLoadState('networkidle');

        // Character selector should be disabled and show locked state
        const charSelect = page.getByTestId('char-select');
        await expect(charSelect).toBeDisabled();

        // Check for .correct class on the wrapper
        const charWrapper = page.locator('.select-wrapper').nth(1);
        await expect(charWrapper).toHaveClass(/correct/);
    });

    test('character lock persists across page reload', async ({ page }) => {
        await page.goto('/');

        const firstPackId = await page.getByTestId('pack-row').first().getAttribute('data-pack-id');

        // Set up a game with character locked
        await page.evaluate((packId) => {
            const now = new Date();
            const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            localStorage.setItem(`scriptle:${packId}:${today}`, JSON.stringify({
                version: 2,
                attempts: 1,
                movieLocked: false,
                characterLocked: true,
                guessStats: [
                    { movie: false, char: true }
                ],
                gameOver: false,
                success: false
            }));
        }, firstPackId);

        await page.goto(`/play/${firstPackId}`);
        await page.waitForLoadState('networkidle');

        // Verify character is locked
        await expect(page.getByTestId('char-select')).toBeDisabled();

        // Reload page
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Character should still be locked
        await expect(page.getByTestId('char-select')).toBeDisabled();
        const charWrapper = page.locator('.select-wrapper').nth(1);
        await expect(charWrapper).toHaveClass(/correct/);
    });

    test('both movie and character can be locked independently', async ({ page }) => {
        await page.goto('/');

        const firstPackId = await page.getByTestId('pack-row').first().getAttribute('data-pack-id');

        // Set up a game where both are locked
        await page.evaluate((packId) => {
            const now = new Date();
            const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            localStorage.setItem(`scriptle:${packId}:${today}`, JSON.stringify({
                version: 2,
                attempts: 2,
                movieLocked: true,
                characterLocked: true,
                guessStats: [
                    { movie: false, char: true },
                    { movie: true, char: false }
                ],
                gameOver: false,
                success: false
            }));
        }, firstPackId);

        await page.goto(`/play/${firstPackId}`);
        await page.waitForLoadState('networkidle');

        // Both selectors should be disabled
        await expect(page.getByTestId('movie-select')).toBeDisabled();
        await expect(page.getByTestId('char-select')).toBeDisabled();

        // Both should have .correct class
        const movieWrapper = page.locator('.select-wrapper').nth(0);
        const charWrapper = page.locator('.select-wrapper').nth(1);
        await expect(movieWrapper).toHaveClass(/correct/);
        await expect(charWrapper).toHaveClass(/correct/);
    });

    test('character locked on first attempt, movie on second, win on third', async ({ page }) => {
        await page.goto('/');

        const firstPackId = await page.getByTestId('pack-row').first().getAttribute('data-pack-id');

        // Simulate a progression: char locked -> both locked -> win
        await page.evaluate((packId) => {
            const now = new Date();
            const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            localStorage.setItem(`scriptle:${packId}:${today}`, JSON.stringify({
                version: 2,
                attempts: 3,
                movieLocked: true,
                characterLocked: true,
                guessStats: [
                    { movie: false, char: true },
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

        // Should be in win state
        await expect(page.getByTestId('share-container')).toBeVisible({ timeout: 10000 });

        // Attempts should show 3
        const shareText = await page.getByTestId('share-container').textContent();
        expect(shareText).toContain('3/');
    });
});
