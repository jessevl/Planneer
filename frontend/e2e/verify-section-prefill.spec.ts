/**
 * Regression test: clicking a second section + button must not clear parent/section.
 * Bug: AddTaskForm reset effect clears parentPageId when defaultSection prop changes.
 * Fix: AddTaskForm reset effect now uses selectedTaskPageId as fallback.
 */
import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:3000';
const EMAIL = 'demo@planneer.app';
const PASSWORD = 'PlanneerDemo2024!Dev';
const PRODUCT_LAUNCH_ID = '501i6jrix3thpqe';

async function login(page: Page) {
  await page.goto(BASE + '/');
  await page.getByRole('button', { name: /sign in with password/i }).click();
  await page.getByLabel(/email address/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL(/\//, { timeout: 15000 });
  await page.waitForTimeout(1500);
}

async function dismissBanner(page: Page) {
  const btn = page.getByRole('button', { name: /not now/i });
  if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(200);
  }
}

async function getFormContent(page: Page): Promise<string> {
  // The task create form renders as a <form> element (no role="dialog")
  const form = page.locator('form').first();
  await expect(form).toBeVisible({ timeout: 4000 });
  return (await form.textContent()) ?? '';
}

test('first section + click: parent and section are prefilled', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/pages/' + PRODUCT_LAUNCH_ID);
  await page.waitForTimeout(2500);
  await dismissBanner(page);

  await page.getByRole('button', { name: /Add item to Backlog/i }).click({ force: true });
  const text = await getFormContent(page);
  await page.screenshot({ path: '/tmp/ver-1-backlog.png' });

  console.log('Form text (first click):', text.substring(0, 300));
  expect(text).toContain('Product Launch');
  expect(text.toLowerCase()).toContain('backlog');
});

test('second section + click: parent and section still prefilled (regression fix)', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/pages/' + PRODUCT_LAUNCH_ID);
  await page.waitForTimeout(2500);
  await dismissBanner(page);

  // First click: Backlog
  await page.getByRole('button', { name: /Add item to Backlog/i }).click({ force: true });
  const text1 = await getFormContent(page);
  await page.screenshot({ path: '/tmp/ver-2a-backlog.png' });
  console.log('First click form text:', text1.substring(0, 300));

  expect(text1).toContain('Product Launch');
  expect(text1.toLowerCase()).toContain('backlog');

  // Close form
  await page.getByRole('button', { name: /cancel/i }).click();
  await page.waitForTimeout(600);

  // Second click: In Progress
  await page.getByRole('button', { name: /Add item to In Progress/i }).click({ force: true });
  const text2 = await getFormContent(page);
  await page.screenshot({ path: '/tmp/ver-2b-inprogress.png' });
  console.log('Second click form text:', text2.substring(0, 300));

  // Before fix: 'Product Launch' was gone, section was also gone
  expect(text2, 'Parent must still be prefilled after second + click').toContain('Product Launch');
  expect(text2.toLowerCase(), 'Section must show In Progress').toContain('in progress');
});
