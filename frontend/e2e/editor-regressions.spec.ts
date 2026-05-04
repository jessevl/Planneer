import { expect, test } from '@playwright/test';
import { login, TIMEOUTS } from './test-config';

async function createNoteAndOpenEditor(page: import('@playwright/test').Page) {
  await page.goto('/pages');

  const seededNoteButton = page.getByRole('button', {
    name: /getting started with planneer/i,
  }).first();

  await expect(seededNoteButton).toBeVisible({ timeout: 10000 });
  await seededNoteButton.click();
  await page.waitForURL(/\/pages\/[a-z0-9]+/i, { timeout: TIMEOUTS.navigation });

  const editor = page.locator('.yoopta-editor-container [contenteditable="true"]').first();
  await expect(editor).toBeVisible({ timeout: 10000 });

  return editor;
}

test.describe('Editor regressions', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('numbered list fallback shortcut converts on space', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'Mobile Chrome', 'Desktop keyboard regression coverage only.');

    await createNoteAndOpenEditor(page);
    await page.getByTestId('page-editor-trailing-space').click();
    await page.keyboard.press('1');
    await page.keyboard.press('.');
    await page.keyboard.press('Space');
    await page.getByTestId('page-editor-surface').getByRole('textbox').last().pressSequentially('Numbered item');

    await expect(page.getByText('Numbered item')).toBeVisible();
  });

  test('todo list fallback handles dash checkbox syntax', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'Mobile Chrome', 'Desktop keyboard regression coverage only.');

    await createNoteAndOpenEditor(page);
    await page.getByTestId('page-editor-trailing-space').click();
    await page.keyboard.press('-');
    await page.keyboard.press('Space');
    await page.keyboard.type('[ ]');
    await page.keyboard.press('Space');
    await page.getByTestId('page-editor-surface').getByRole('textbox').last().pressSequentially('Todo item');

    await expect(page.getByRole('button', { name: /mark as checked|mark as unchecked/i }).last()).toBeVisible();
    await expect(page.getByText('Todo item')).toBeVisible();
  });

  test('trailing click area creates a block with a working slash menu', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'Mobile Chrome', 'Desktop slash menu regression coverage only.');

    await createNoteAndOpenEditor(page);

    await page.getByTestId('page-editor-trailing-space').click();
    await page.keyboard.type('/');

    await expect(page.getByText('Bulleted list')).toBeVisible();
  });
});