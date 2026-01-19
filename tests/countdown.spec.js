import { test, expect } from '@playwright/test';

test('countdown timer renders on home page', async ({ page }) => {
    await page.goto('/');

    // Check that the countdown container exists
    const countdown = page.locator('#home-countdown .countdown-container');
    await expect(countdown).toBeVisible();

    // Check that it contains the label
    await expect(countdown).toContainText('NEXT PUZZLE');

    // Check that the timer is displaying time (format HH:MM:SS)
    const timerDisplay = page.locator('#home-countdown .timer-display');
    await expect(timerDisplay).toBeVisible();
    await expect(timerDisplay).toHaveText(/\d{2}:\d{2}:\d{2}/);
});
