import { test, expect } from '@playwright/test';

test.describe('Game Play', () => {

    test.describe('Game Load', () => {

        test('displays pack header', async ({ page }) => {
            await page.goto('/');

            const firstPack = page.getByTestId('pack-row').first();
            await firstPack.click();
            await page.waitForLoadState('networkidle');

            // Pack name appears in header row
            await expect(page.getByTestId('pack-header')).toBeVisible({ timeout: 10000 });
        });

        test('displays script area with quote', async ({ page }) => {
            await page.goto('/');
            await page.getByTestId('pack-row').first().click();
            await page.waitForLoadState('networkidle');

            await expect(page.getByTestId('script-area')).toBeVisible({ timeout: 10000 });
            await expect(page.getByTestId('script-display').locator('.script-line').first()).toBeVisible();
        });

        test('displays movie selector', async ({ page }) => {
            await page.goto('/');
            await page.getByTestId('pack-row').first().click();
            await page.waitForLoadState('networkidle');

            await expect(page.getByTestId('movie-select')).toBeVisible({ timeout: 10000 });
        });

        test('displays character selector', async ({ page }) => {
            await page.goto('/');
            await page.getByTestId('pack-row').first().click();
            await page.waitForLoadState('networkidle');

            await expect(page.getByTestId('char-select')).toBeVisible({ timeout: 10000 });
        });

        test('displays guess button', async ({ page }) => {
            await page.goto('/');
            await page.getByTestId('pack-row').first().click();
            await page.waitForLoadState('networkidle');

            await expect(page.getByTestId('guess-button')).toBeVisible({ timeout: 10000 });
        });

        test('displays attempts counter', async ({ page }) => {
            await page.goto('/');
            await page.getByTestId('pack-row').first().click();
            await page.waitForLoadState('networkidle');

            await expect(page.getByTestId('attempts-counter')).toBeVisible({ timeout: 10000 });
        });
    });

    test.describe('Theme Application', () => {

        test('applies pack theme', async ({ page }) => {
            await page.goto('/');
            await page.getByTestId('pack-row').first().click();
            await page.waitForLoadState('networkidle');

            await expect(page.locator('body')).toHaveAttribute('data-theme', 'pack');
        });

        test('script area has script theme', async ({ page }) => {
            await page.goto('/');
            await page.getByTestId('pack-row').first().click();
            await page.waitForLoadState('networkidle');

            await expect(page.getByTestId('script-area')).toHaveAttribute('data-theme', 'script');
        });
    });

    test.describe('Guessing Flow', () => {

        test('shows error when submitting without selections', async ({ page }) => {
            await page.goto('/');
            await page.getByTestId('pack-row').first().click();
            await page.waitForLoadState('networkidle');

            // Wait for game controls
            await expect(page.getByTestId('guess-button')).toBeVisible({ timeout: 10000 });

            await page.getByTestId('guess-button').click();

            // Should show error
            const movieError = page.getByTestId('movie-error');
            await expect(movieError).toContainText(/select/i);
        });

        test('movie selector enables character selector', async ({ page }) => {
            await page.goto('/');
            await page.getByTestId('pack-row').first().click();
            await page.waitForLoadState('networkidle');

            // Character selector should be disabled initially
            await expect(page.getByTestId('char-select')).toBeDisabled();

            // Select a movie
            await page.getByTestId('movie-select').selectOption({ index: 1 });

            // Character selector should now be enabled
            await expect(page.getByTestId('char-select')).toBeEnabled();
        });

        test('submitting guess updates game state', async ({ page }) => {
            await page.goto('/');
            await page.getByTestId('pack-row').first().click();
            await page.waitForLoadState('networkidle');

            // Wait for game controls
            await expect(page.getByTestId('guess-button')).toBeVisible({ timeout: 10000 });

            // Select first movie and character options
            await page.getByTestId('movie-select').selectOption({ index: 1 });
            await page.getByTestId('char-select').selectOption({ index: 1 });
            await page.getByTestId('guess-button').click();

            // Wait for response
            await page.waitForTimeout(1000);

            // Either we won (share visible), or got a message
            const shareVisible = await page.getByTestId('share-container').isVisible();
            const messageVisible = await page.getByTestId('game-message').isVisible();

            expect(shareVisible || messageVisible).toBeTruthy();
        });
    });

    test.describe('Win State', () => {

        test('shows share UI on win', async ({ page }) => {
            await page.goto('/');

            // Get the first pack ID
            const firstPackId = await page.getByTestId('pack-row').first().getAttribute('data-pack-id');

            // Set up a pre-won game in localStorage
            await page.evaluate((packId) => {
                const now = new Date();
                const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                localStorage.setItem(`scriptle:${packId}:${today}`, JSON.stringify({
                    version: 2,
                    attempts: 2,
                    movieLocked: true,
                    characterLocked: false,
                    guessStats: [
                        { movie: true, char: false },
                        { movie: true, char: true }
                    ],
                    gameOver: true,
                    success: true,
                    completedAt: new Date().toISOString()
                }));
            }, firstPackId);

            // Navigate to the game
            await page.goto(`/play/${firstPackId}`);
            await page.waitForLoadState('networkidle');

            // Should show completion state - share container visible
            await expect(page.getByTestId('share-container')).toBeVisible({ timeout: 10000 });
        });
    });

    test.describe('Lose State', () => {

        test('shows game over after 5 attempts', async ({ page }) => {
            await page.goto('/');

            // Get the first pack ID
            const firstPackId = await page.getByTestId('pack-row').first().getAttribute('data-pack-id');

            // Set up a lost game
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

            // Share container should be visible (game over state)
            await expect(page.getByTestId('share-container')).toBeVisible({ timeout: 10000 });
        });
    });

    test.describe('Completed Game Reload', () => {

        test('navigating to completed game shows completion state', async ({ page }) => {
            await page.goto('/');

            // Get the first pack ID
            const firstPackId = await page.getByTestId('pack-row').first().getAttribute('data-pack-id');

            // Mock completed game
            await page.evaluate((packId) => {
                const now = new Date();
                const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                localStorage.setItem(`scriptle:${packId}:${today}`, JSON.stringify({
                    version: 2,
                    attempts: 3,
                    movieLocked: true,
                    characterLocked: false,
                    gameOver: true,
                    success: true,
                    guessStats: [
                        { movie: false, char: false },
                        { movie: true, char: false },
                        { movie: true, char: true }
                    ],
                    completedAt: new Date().toISOString()
                }));
            }, firstPackId);

            await page.goto(`/play/${firstPackId}`);
            await page.waitForLoadState('networkidle');

            // Game controls should be hidden
            await expect(page.getByTestId('game-controls')).toBeHidden({ timeout: 10000 });

            // Share container should be visible
            await expect(page.getByTestId('share-container')).toBeVisible();
        });
    });

    test.describe('Share Functionality', () => {

        test('share button present in completion state', async ({ page }) => {
            await page.goto('/');

            const firstPackId = await page.getByTestId('pack-row').first().getAttribute('data-pack-id');

            await page.evaluate((packId) => {
                const now = new Date();
                const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                localStorage.setItem(`scriptle:${packId}:${today}`, JSON.stringify({
                    version: 2,
                    attempts: 2,
                    movieLocked: true,
                    characterLocked: false,
                    gameOver: true,
                    success: true,
                    guessStats: [
                        { movie: true, char: false },
                        { movie: true, char: true }
                    ],
                    completedAt: new Date().toISOString()
                }));
            }, firstPackId);

            await page.goto(`/play/${firstPackId}`);
            await page.waitForLoadState('networkidle');

            await expect(page.getByTestId('share-button')).toBeVisible({ timeout: 10000 });
        });
    });

    test.describe('Movies Modal', () => {

        test('clicking movie count opens movies modal', async ({ page }) => {
            await page.goto('/');
            await page.getByTestId('pack-row').first().click();
            await page.waitForLoadState('networkidle');

            // Find and click the movies count link
            const moviesLink = page.getByTestId('movies-link');

            if (await moviesLink.isVisible()) {
                await moviesLink.click();

                // Movies modal should appear
                const moviesModal = page.locator('#movies-modal');
                await expect(moviesModal).toBeVisible({ timeout: 5000 });
            }
        });
    });

    test.describe('Script Area', () => {

        test('script area visible after game loaded', async ({ page }) => {
            await page.goto('/');
            await page.getByTestId('pack-row').first().click();
            await page.waitForLoadState('networkidle');

            await expect(page.getByTestId('script-area')).toBeVisible({ timeout: 10000 });
        });

        test('script display contains lines', async ({ page }) => {
            await page.goto('/');
            await page.getByTestId('pack-row').first().click();
            await page.waitForLoadState('networkidle');

            // Should have at least one script line
            const scriptLines = page.getByTestId('script-display').locator('.script-line');
            await expect(scriptLines.first()).toBeVisible({ timeout: 10000 });
            expect(await scriptLines.count()).toBeGreaterThanOrEqual(1);
        });
    });
});
