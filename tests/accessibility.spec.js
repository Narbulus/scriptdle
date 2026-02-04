import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';


test.describe('Accessibility', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('scriptle:hasVisited', 'true');
    });
    await page.goto('/');
  });

  test.describe('Homepage', () => {

    test('homepage has no critical a11y violations', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const critical = results.violations.filter(v =>
        v.impact === 'critical' || v.impact === 'serious'
      );

      expect(critical).toEqual([]);
    });

    test('pack list is navigable by keyboard', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();

      const packRows = page.getByTestId('pack-row');
      const count = await packRows.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Game Page', () => {

    test('game page has no critical a11y violations', async ({ page }) => {
      await page.getByTestId('pack-row').first().click();
      await page.waitForLoadState('networkidle');
      await expect(page.getByTestId('script-area')).toBeVisible({ timeout: 10000 });

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const critical = results.violations.filter(v =>
        v.impact === 'critical' || v.impact === 'serious'
      );

      expect(critical).toEqual([]);
    });

    test('form controls are labeled', async ({ page }) => {
      await page.getByTestId('pack-row').first().click();
      await page.waitForLoadState('networkidle');

      const movieSelect = page.getByTestId('movie-select');
      await expect(movieSelect).toBeVisible({ timeout: 10000 });

      const movieSelectAriaLabel = await movieSelect.getAttribute('aria-label');
      const movieSelectId = await movieSelect.getAttribute('id');
      const hasLabel = movieSelectAriaLabel ||
        (movieSelectId && await page.locator(`label[for="${movieSelectId}"]`).count() > 0);

      expect(hasLabel).toBeTruthy();
    });

    test('guess button is focusable', async ({ page }) => {
      await page.getByTestId('pack-row').first().click();
      await page.waitForLoadState('networkidle');

      const guessButton = page.getByTestId('guess-button');
      await expect(guessButton).toBeVisible({ timeout: 10000 });

      await guessButton.focus();
      const isFocused = await guessButton.evaluate(el => document.activeElement === el);
      expect(isFocused).toBe(true);
    });
  });

  test.describe('Help Modal', () => {

    test('help modal traps focus', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const helpButton = page.getByTestId('help-button');
      if (await helpButton.isVisible()) {
        await helpButton.click();

        const helpModal = page.locator('#help-modal');
        await expect(helpModal).toBeVisible({ timeout: 5000 });

        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');

        const focusedInModal = await page.evaluate(() => {
          const modal = document.querySelector('#help-modal');
          return modal?.contains(document.activeElement);
        });

        expect(focusedInModal).toBe(true);
      }
    });

    test('help modal can be closed with Escape', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const helpButton = page.getByTestId('help-button');
      if (await helpButton.isVisible()) {
        await helpButton.click();

        const helpModal = page.locator('#help-modal');
        await expect(helpModal).toBeVisible({ timeout: 5000 });

        await page.keyboard.press('Escape');
        await expect(helpModal).toBeHidden({ timeout: 2000 });
      }
    });
  });

  test.describe('Color Contrast', () => {

    test('text has sufficient color contrast', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withRules(['color-contrast'])
        .analyze();

      const serious = results.violations.filter(v =>
        v.impact === 'serious' || v.impact === 'critical'
      );

      expect(serious).toEqual([]);
    });
  });

  test.describe('About Page', () => {

    test('about page has no critical a11y violations', async ({ page }) => {
      await page.goto('/about');
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      const critical = results.violations.filter(v =>
        v.impact === 'critical' || v.impact === 'serious'
      );

      expect(critical).toEqual([]);
    });
  });
});
