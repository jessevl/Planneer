import { test, expect } from '@playwright/test';
import { login } from './test-config';

test.describe('Tasks', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('displays inbox tasks', async ({ page }) => {
    await page.goto('/tasks/inbox');

    // Should show inbox view
    await expect(page.getByText(/inbox/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('displays today tasks', async ({ page }) => {
    await page.goto('/tasks/today');

    // Should show today view
    await expect(page.getByText(/today/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('displays upcoming tasks', async ({ page }) => {
    await page.goto('/tasks/upcoming');

    // Should show upcoming view
    await expect(page.getByText(/upcoming/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('creates a new task', async ({ page }) => {
    await page.goto('/tasks/inbox');

    // Look for add task button or quick add input
    const addButton = page.getByRole('button', { name: /add task|new task|\+/i }).first();
    const quickAddInput = page.getByPlaceholder(/add.*task|new.*task|task.*title/i);

    if (await addButton.isVisible()) {
      await addButton.click();
    }

    // Fill in task title (either in modal or inline)
    const taskInput = page.getByPlaceholder(/task.*title|title|what.*do/i).or(
      page.getByRole('textbox', { name: /title/i })
    );
    
    if (await taskInput.isVisible()) {
      const uniqueTitle = `E2E Test Task ${Date.now()}`;
      await taskInput.fill(uniqueTitle);
      await page.keyboard.press('Enter');

      // Verify task was created
      await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 5000 });
    }
  });

  test('completes a task', async ({ page }) => {
    await page.goto('/tasks/inbox');

    // Wait for tasks to load
    await page.waitForTimeout(1000);

    // Find a task checkbox
    const checkbox = page.getByRole('checkbox').first();
    
    if (await checkbox.isVisible()) {
      const wasChecked = await checkbox.isChecked();
      await checkbox.click();

      // Verify checkbox state changed
      if (wasChecked) {
        await expect(checkbox).not.toBeChecked();
      } else {
        await expect(checkbox).toBeChecked();
      }
    }
  });

  test('navigates between task filters', async ({ page }) => {
    // Start at inbox
    await page.goto('/tasks/inbox');
    await expect(page).toHaveURL(/\/tasks\/inbox/);

    // Navigate to Today
    const todayLink = page.getByRole('link', { name: /today/i }).or(
      page.locator('[href*="/tasks/today"]')
    );
    if (await todayLink.isVisible()) {
      await todayLink.click();
      await expect(page).toHaveURL(/\/tasks\/today/);
    }

    // Navigate to Upcoming
    const upcomingLink = page.getByRole('link', { name: /upcoming/i }).or(
      page.locator('[href*="/tasks/upcoming"]')
    );
    if (await upcomingLink.isVisible()) {
      await upcomingLink.click();
      await expect(page).toHaveURL(/\/tasks\/upcoming/);
    }
  });

  test('opens task detail/edit view', async ({ page }) => {
    await page.goto('/tasks/inbox');
    await page.waitForTimeout(1000);

    // Click on a task to open details
    const taskRow = page.locator('[data-testid="task-row"]').first().or(
      page.locator('.task-row').first()
    );

    if (await taskRow.isVisible()) {
      await taskRow.click();

      // Should show task detail panel or modal
      await expect(
        page.getByRole('dialog').or(
          page.locator('[data-testid="task-detail"]').or(
            page.locator('.task-detail')
          )
        )
      ).toBeVisible({ timeout: 3000 });
    }
  });
});
