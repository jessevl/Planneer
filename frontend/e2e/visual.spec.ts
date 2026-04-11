import { test, expect } from '@playwright/test';
import { login } from './test-config';

test.describe('Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('home page matches snapshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // Wait for animations

    await expect(page).toHaveScreenshot('home-page.png', {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
    });
  });

  test('tasks inbox matches snapshot', async ({ page }) => {
    await page.goto('/tasks/inbox');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('tasks-inbox.png', {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
    });
  });

  test('tasks today matches snapshot', async ({ page }) => {
    await page.goto('/tasks/today');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('tasks-today.png', {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
    });
  });

  test('notes page matches snapshot', async ({ page }) => {
    await page.goto('/pages');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('notes-page.png', {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
    });
  });

  test('dark mode matches snapshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Toggle dark mode - look for theme toggle button
    const themeButton = page.getByRole('button', { name: /theme|dark|light|mode/i }).or(
      page.locator('[data-testid="theme-toggle"]')
    );

    if (await themeButton.isVisible()) {
      await themeButton.click();
      
      // Wait for theme change
      await page.waitForTimeout(500);

      // Click dark option if dropdown
      const darkOption = page.getByText(/dark/i);
      if (await darkOption.isVisible()) {
        await darkOption.click();
      }
    } else {
      // Try setting dark mode via class/attribute directly for testing
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });
    }

    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('home-dark-mode.png', {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
    });
  });

  test('mobile layout matches snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('home-mobile.png', {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
    });
  });

  test('tablet layout matches snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('home-tablet.png', {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
    });
  });
});
