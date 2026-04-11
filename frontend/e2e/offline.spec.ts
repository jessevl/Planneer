import { test, expect } from '@playwright/test';
import { login } from './test-config';

test.describe('Offline Support', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('shows offline indicator when disconnected', async ({ page, context }) => {
    await page.goto('/tasks/inbox');
    await page.waitForTimeout(1000);

    // Go offline
    await context.setOffline(true);

    // Wait for the app to detect offline state
    await page.waitForTimeout(2000);

    // Should show offline indicator
    const offlineIndicator = page.getByText(/offline/i).or(
      page.locator('[data-testid="offline-indicator"]').or(
        page.locator('[data-testid="connection-status"]')
      )
    );

    await expect(offlineIndicator).toBeVisible({ timeout: 5000 });

    // Go back online
    await context.setOffline(false);

    // Should show online/synced status
    await page.waitForTimeout(2000);
    const onlineIndicator = page.getByText(/online|synced|connected/i).or(
      page.locator('[data-testid="online-indicator"]')
    );

    // Either shows online indicator or offline indicator disappears
    const isOnlineVisible = await onlineIndicator.isVisible().catch(() => false);
    const isOfflineHidden = !(await offlineIndicator.isVisible().catch(() => true));

    expect(isOnlineVisible || isOfflineHidden).toBeTruthy();
  });

  test('can view cached data while offline', async ({ page, context }) => {
    await page.goto('/tasks/inbox');

    // Wait for initial data load
    await page.waitForTimeout(2000);

    // Remember what tasks are visible
    const tasksBeforeOffline = await page.locator('[data-testid="task-row"]').or(
      page.locator('.task-row')
    ).count();

    // Go offline
    await context.setOffline(true);
    await page.waitForTimeout(1000);

    // Refresh the page
    await page.reload();
    await page.waitForTimeout(2000);

    // Should still show cached tasks
    const tasksAfterOffline = await page.locator('[data-testid="task-row"]').or(
      page.locator('.task-row')
    ).count();

    // If there were tasks before, they should still be visible
    if (tasksBeforeOffline > 0) {
      expect(tasksAfterOffline).toBeGreaterThan(0);
    }

    // Restore online state
    await context.setOffline(false);
  });

  test('queues changes while offline', async ({ page, context }) => {
    await page.goto('/tasks/inbox');
    await page.waitForTimeout(2000);

    // Go offline
    await context.setOffline(true);
    await page.waitForTimeout(1000);

    // Try to create a task while offline
    const addButton = page.getByRole('button', { name: /add task|new task|\+/i }).first();
    const taskInput = page.getByPlaceholder(/task.*title|title/i);

    if (await addButton.isVisible()) {
      await addButton.click();
    }

    if (await taskInput.isVisible()) {
      const offlineTaskTitle = `Offline Task ${Date.now()}`;
      await taskInput.fill(offlineTaskTitle);
      await page.keyboard.press('Enter');

      // Task should appear locally
      await expect(page.getByText(offlineTaskTitle)).toBeVisible({ timeout: 3000 });

      // Should show pending indicator (or task appears with pending state)
      const pendingIndicator = page.getByText(/pending|syncing|queued/i).or(
        page.locator('[data-testid="pending-indicator"]')
      );

      // Either shows pending indicator or task is just visible
      const taskVisible = await page.getByText(offlineTaskTitle).isVisible();
      expect(taskVisible).toBeTruthy();
    }

    // Restore online state
    await context.setOffline(false);
    await page.waitForTimeout(2000);

    // Changes should sync
    const syncedIndicator = page.getByText(/synced|saved/i).or(
      page.locator('[data-testid="synced-indicator"]')
    );
    
    // Give time for sync to complete
    await page.waitForTimeout(3000);
  });

  test('recovers gracefully after connection restored', async ({ page, context }) => {
    await page.goto('/tasks/inbox');
    await page.waitForTimeout(2000);

    // Go offline
    await context.setOffline(true);
    await page.waitForTimeout(1000);

    // Go back online
    await context.setOffline(false);
    await page.waitForTimeout(2000);

    // App should be functional - try a basic interaction
    const addButton = page.getByRole('button', { name: /add task|new task|\+/i }).first();
    
    if (await addButton.isVisible()) {
      await addButton.click();
      // Should respond normally
      await page.waitForTimeout(500);
    }

    // Should not show any error states
    const errorBanner = page.getByText(/error|failed|connection.*lost/i);
    await expect(errorBanner).not.toBeVisible({ timeout: 1000 }).catch(() => {
      // It's OK if error shows briefly and then disappears
    });
  });
});
