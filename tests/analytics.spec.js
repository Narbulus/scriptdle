import { test, expect } from '@playwright/test';


test.describe('Analytics Events', () => {

    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('scriptle:hasVisited', 'true');
        });
        await page.goto('/');
        await page.evaluate(() => {
            if (window.__analyticsEventLog) {
                window.__analyticsEventLog.length = 0;
            }
        });
    });

    test.describe('Game Start Events', () => {

        test('game_start fires for new games', async ({ page }) => {
            const firstPackId = await page.getByTestId('pack-row').first().getAttribute('data-pack-id');
            await page.getByTestId('pack-row').first().click();
            await page.waitForLoadState('networkidle');

            const events = await page.evaluate(() => window.__analyticsEventLog || []);
            const gameStart = events.find(e => e.event === 'game_start');

            expect(gameStart).toBeTruthy();
            expect(gameStart.params.pack_id).toBe(firstPackId);
            expect(gameStart.params.puzzle_date).toBeDefined();
        });

        test('game_start does not fire for returning games', async ({ page }) => {
            const firstPackId = await page.getByTestId('pack-row').first().getAttribute('data-pack-id');

            // Set up in-progress game with 1 attempt
            await page.evaluate((packId) => {
                const now = new Date();
                const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                localStorage.setItem(`scriptle:${packId}:${today}`, JSON.stringify({
                    version: 2,
                    attempts: 1,
                    movieLocked: false,
                    characterLocked: false,
                    guessStats: [{ movie: false, char: false }],
                    gameOver: false,
                    success: false
                }));
            }, firstPackId);

            await page.goto(`/play/${firstPackId}`);
            await page.waitForLoadState('networkidle');

            const events = await page.evaluate(() => window.__analyticsEventLog || []);
            const gameStart = events.find(e => e.event === 'game_start');

            expect(gameStart).toBeFalsy();
        });
    });

    test.describe('Game Resume Events', () => {

        test('game_resume fires for in-progress games', async ({ page }) => {
            const firstPackId = await page.getByTestId('pack-row').first().getAttribute('data-pack-id');

            // Set up in-progress game
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
                        { movie: true, char: false }
                    ],
                    gameOver: false,
                    success: false
                }));
            }, firstPackId);

            await page.goto(`/play/${firstPackId}`);
            await page.waitForLoadState('networkidle');

            const events = await page.evaluate(() => window.__analyticsEventLog || []);
            const gameResume = events.find(e => e.event === 'game_resume');

            expect(gameResume).toBeTruthy();
            expect(gameResume.params.pack_id).toBe(firstPackId);
            expect(gameResume.params.existing_attempts).toBe(2);
            expect(gameResume.params.movie_locked).toBe(true);
            expect(gameResume.params.character_locked).toBe(false);
        });

        test('game_resume includes correct lock states', async ({ page }) => {
            const firstPackId = await page.getByTestId('pack-row').first().getAttribute('data-pack-id');

            // Set up game with character locked
            await page.evaluate((packId) => {
                const now = new Date();
                const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                localStorage.setItem(`scriptle:${packId}:${today}`, JSON.stringify({
                    version: 2,
                    attempts: 3,
                    movieLocked: false,
                    characterLocked: true,
                    guessStats: [
                        { movie: false, char: true },
                        { movie: false, char: true },
                        { movie: false, char: true }
                    ],
                    gameOver: false,
                    success: false
                }));
            }, firstPackId);

            await page.goto(`/play/${firstPackId}`);
            await page.waitForLoadState('networkidle');

            const events = await page.evaluate(() => window.__analyticsEventLog || []);
            const gameResume = events.find(e => e.event === 'game_resume');

            expect(gameResume.params.movie_locked).toBe(false);
            expect(gameResume.params.character_locked).toBe(true);
        });
    });

    test.describe('Game Revisit Events', () => {

        test('game_revisit fires for completed won games', async ({ page }) => {
            const firstPackId = await page.getByTestId('pack-row').first().getAttribute('data-pack-id');

            // Set up completed (won) game
            await page.evaluate((packId) => {
                const now = new Date();
                const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                localStorage.setItem(`scriptle:${packId}:${today}`, JSON.stringify({
                    version: 2,
                    attempts: 2,
                    movieLocked: true,
                    characterLocked: true,
                    guessStats: [
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

            const events = await page.evaluate(() => window.__analyticsEventLog || []);
            const gameRevisit = events.find(e => e.event === 'game_revisit');

            expect(gameRevisit).toBeTruthy();
            expect(gameRevisit.params.pack_id).toBe(firstPackId);
            expect(gameRevisit.params.result).toBe('win');
        });

        test('game_revisit fires for completed lost games', async ({ page }) => {
            const firstPackId = await page.getByTestId('pack-row').first().getAttribute('data-pack-id');

            // Set up completed (lost) game
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

            const events = await page.evaluate(() => window.__analyticsEventLog || []);
            const gameRevisit = events.find(e => e.event === 'game_revisit');

            expect(gameRevisit).toBeTruthy();
            expect(gameRevisit.params.result).toBe('loss');
        });
    });

    test.describe('Guess Events', () => {

        test('guess_made fires on guess submission', async ({ page }) => {
            await page.getByTestId('pack-row').first().click();
            await page.waitForLoadState('networkidle');

            // Make a guess
            await page.getByTestId('movie-select').selectOption({ index: 1 });
            await page.getByTestId('char-select').selectOption({ index: 1 });
            await page.getByTestId('guess-button').click();

            await page.waitForTimeout(500);

            const events = await page.evaluate(() => window.__analyticsEventLog || []);
            const guessMade = events.find(e => e.event === 'guess_made');

            expect(guessMade).toBeTruthy();
            expect(guessMade.params.attempt).toBe(1);
            expect(typeof guessMade.params.movie_correct).toBe('boolean');
            expect(typeof guessMade.params.char_correct).toBe('boolean');
        });
    });

    test.describe('Page View Events', () => {

        test('page_view fires on navigation', async ({ page }) => {
            // Navigate to a different page to trigger a new page_view event
            await page.goto('/about');
            await page.waitForLoadState('networkidle');

            const events = await page.evaluate(() => window.__analyticsEventLog || []);
            const pageView = events.find(e => e.event === 'page_view');

            expect(pageView).toBeTruthy();
            expect(pageView.params.page_path).toBe('/about');
        });
    });
});
