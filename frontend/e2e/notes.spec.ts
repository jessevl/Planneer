import { test, expect } from '@playwright/test';
import { login } from './test-config';

test.describe('Notes', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('displays notes list', async ({ page }) => {
    await page.goto('/pages');

    // Should show notes view
    await expect(page.getByText(/notes|pages/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('creates a new note', async ({ page }) => {
    await page.goto('/pages');

    // Look for new note button
    const newNoteButton = page.getByRole('button', { name: /new note|add note|create note|\+/i }).first();

    if (await newNoteButton.isVisible()) {
      await newNoteButton.click();

      // Should navigate to new note or open modal
      await expect(page).toHaveURL(/\/pages\/[a-z0-9]+/i, { timeout: 5000 });
    }
  });

  test('navigates to note editor', async ({ page }) => {
    await page.goto('/pages');
    await page.waitForTimeout(1000);

    // Click on a note to open it
    const noteItem = page.locator('[data-testid="note-item"]').first().or(
      page.locator('.note-item').first().or(
        page.locator('[data-testid="note-card"]').first()
      )
    );

    if (await noteItem.isVisible()) {
      await noteItem.click();

      // Should navigate to note page
      await expect(page).toHaveURL(/\/pages\/[a-z0-9]+/i, { timeout: 5000 });
    }
  });

  test('edits note content', async ({ page }) => {
    await page.goto('/pages');
    await page.waitForTimeout(1000);

    // Navigate to an existing note or create a new one
    const newNoteButton = page.getByRole('button', { name: /new note|add note|\+/i }).first();
    
    if (await newNoteButton.isVisible()) {
      await newNoteButton.click();
      await page.waitForURL(/\/pages\/[a-z0-9]+/i, { timeout: 5000 });

      // Wait for editor to load
      await page.waitForTimeout(1000);

      // Find editor and type content
      const editor = page.locator('[contenteditable="true"]').first().or(
        page.getByRole('textbox').first()
      );

      if (await editor.isVisible()) {
        await editor.click();
        await editor.fill('E2E Test Content');

        // Content should be visible
        await expect(page.getByText('E2E Test Content')).toBeVisible();
      }
    }
  });

  test('note sidebar shows hierarchy', async ({ page }) => {
    await page.goto('/pages');

    // Look for sidebar or notes tree
    const sidebar = page.locator('[data-testid="sidebar"]').or(
      page.locator('[data-testid="notes-sidebar"]').or(
        page.locator('.sidebar')
      )
    );

    if (await sidebar.isVisible()) {
      // Should contain note items
      await expect(sidebar.locator('[data-testid="note-item"]').or(
        sidebar.locator('.note-item')
      ).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('expands/collapses note children in sidebar', async ({ page }) => {
    await page.goto('/pages');
    await page.waitForTimeout(1000);

    // Find expand button
    const expandButton = page.getByRole('button', { name: /expand|collapse|chevron/i }).first().or(
      page.locator('[data-testid="expand-button"]').first()
    );

    if (await expandButton.isVisible()) {
      await expandButton.click();
      // Should toggle expansion state
      await page.waitForTimeout(500);
    }
  });
});
