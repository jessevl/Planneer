/**
 * Screenshot Capture Script for Landing Page
 * 
 * Captures screenshots of app views for the landing page showcase.
 * Generates both dark and light mode variants for each view.
 * 
 * =============================================================================
 * HOW TO GENERATE NEW SCREENSHOTS
 * =============================================================================
 * 
 * Prerequisites:
 * 1. Backend running: cd backend && go run .
 * 2. Frontend running: cd frontend && npm run dev
 * 3. Demo user exists with sample content (created automatically in dev mode)
 * 
 * Environment Variables:
 * - E2E_TEST_EMAIL: Demo user email (default: demo@planneer.app)
 * - E2E_TEST_PASSWORD: Demo user password (default: PlanneerDemo2024!Dev)
 * 
 * Run screenshot capture:
 *   cd frontend
 *   npx playwright test e2e/screenshots.spec.ts --project=chromium
 * 
 * Or use the npm script:
 *   npm run screenshots
 * 
 * Output location:
 *   frontend/public/landing/screenshots/
 *   ├── dark/
 *   │   ├── home.png           (Home dashboard)
 *   │   ├── tasks-inbox.png    (Task list - upcoming view)
 *   │   ├── notes.png          (Note editor)
 *   │   ├── kanban.png         (Kanban board)
 *   │   ├── whiteboard.png     (Excalidraw whiteboard)
 *   │   └── collection.png     (Collection gallery)
 *   └── light/
 *       └── (same files as dark/)
 * 
 * Notes:
 * - Screenshots are 1440x900 at 2x device scale (Retina quality)
 * - Demo user must have the default workspace content from templates
 * - If screenshots look different, reset demo user data and re-register
 * - All screenshots captured in a SINGLE test run to avoid auth rate limiting
 * 
 * =============================================================================
 */

import { test, expect, Page } from '@playwright/test';
import { TEST_USER } from './test-config';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.join(__dirname, '../public/landing/screenshots');

// Configure for screenshot capture
test.use({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2, // Retina quality
});

// Set timeout to 2 minutes for all the screenshots
test.setTimeout(120000);

/**
 * Ensure screenshot directories exist
 */
function ensureDirectories() {
  const dirs = [SCREENSHOTS_DIR, path.join(SCREENSHOTS_DIR, 'dark'), path.join(SCREENSHOTS_DIR, 'light')];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

/**
 * Login to the app - only runs once per test
 */
async function performLogin(page: Page): Promise<void> {
  // Navigate to login page
  await page.goto('/?login=true');
  await page.waitForTimeout(1500);
  
  // Check if already logged in by looking for sidebar search button (unique to app)
  const searchButton = page.locator('button:has-text("Search...")');
  const isLoggedIn = await searchButton.isVisible().catch(() => false);
  
  if (isLoggedIn) {
    console.log('Already logged in');
    return;
  }
  
  // Click "Sign in with Password" to show email/password form
  const passwordBtn = page.getByRole('button', { name: /sign in with password/i });
  await expect(passwordBtn).toBeVisible({ timeout: 10000 });
  console.log('Clicking Sign in with Password...');
  await passwordBtn.click();
  await page.waitForTimeout(1000);
  
  // Fill credentials from centralized config
  const emailInput = page.getByLabel(/email address/i);
  await expect(emailInput).toBeVisible({ timeout: 5000 });
  await emailInput.fill(TEST_USER.email);
  await page.getByLabel(/password/i).fill(TEST_USER.password);
  
  // Click Sign In
  const signInBtn = page.getByRole('button', { name: /^sign in$/i });
  await expect(signInBtn).toBeVisible({ timeout: 5000 });
  console.log('Clicking Sign In...');
  await signInBtn.click();
  
  // Wait for app to fully load (search button indicates sidebar is ready)
  console.log('Waiting for app to load...');
  await expect(page.locator('button:has-text("Search...")')).toBeVisible({ timeout: 20000 });
  console.log('Login successful');
  await page.waitForTimeout(2000);
}

/**
 * Navigate to a page using the command palette search
 */
async function searchAndNavigate(page: Page, searchTerm: string) {
  // Open command palette with Cmd+K
  await page.keyboard.press('Meta+k');
  await page.waitForTimeout(500);
  
  // Type search term in the command palette input
  const input = page.locator('input[placeholder*="Search"]').first();
  await expect(input).toBeVisible({ timeout: 5000 });
  await input.fill(searchTerm);
  await page.waitForTimeout(1000);
  
  // Click first result (uses data-index attribute)
  const firstResult = page.locator('button[data-index="0"]').first();
  await expect(firstResult).toBeVisible({ timeout: 5000 });
  await firstResult.click();
  await page.waitForTimeout(1500);
}

/**
 * Click a sidebar navigation item
 */
async function clickSidebarItem(page: Page, itemName: RegExp | string) {
  const button = page.getByRole('button', { name: itemName }).first();
  await expect(button).toBeVisible({ timeout: 10000 });
  await button.click();
  await page.waitForTimeout(1500);
}

/**
 * Hide UI elements that shouldn't appear in screenshots
 */
async function cleanupUI(page: Page) {
  await page.evaluate(() => {
    // Hide tooltips, toasts, PWA install prompt, and devtools
    const selectorsToHide = [
      '[role="tooltip"]',
      '[class*="Toast"]',
      '[class*="Devtools"]',
      '[class*="TanStackRouter"]',
      '[class*="InstallPrompt"]',
    ];
    selectorsToHide.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });
    });
    // Hide Dismiss buttons (for toasts/notifications)
    document.querySelectorAll('button[aria-label="Dismiss"]').forEach(el => {
      const parent = el.closest('[class*="fixed"]');
      if (parent) {
        (parent as HTMLElement).style.display = 'none';
      }
    });
    // Hide floating notifications
    document.querySelectorAll('[class*="fixed"]').forEach(el => {
      const text = el.textContent || '';
      if (text.includes('Install') || text.includes('signed in') || text.includes('Synced')) {
        (el as HTMLElement).style.display = 'none';
      }
    });
  });
  await page.waitForTimeout(300);
}

// ============================================================================
// SINGLE TEST - CAPTURES ALL SCREENSHOTS IN ONE RUN
// ============================================================================
// This avoids rate limiting by logging in only once

test('Capture all screenshots', async ({ page, context }) => {
  ensureDirectories();
  
  // Login once at the start
  await performLogin(page);
  
  // ========== DARK MODE SCREENSHOTS ==========
  console.log('\n=== Starting dark mode screenshots ===');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(500);
  
  // 1. Home
  console.log('Capturing: dark/home.png');
  await page.goto('/');
  await page.waitForTimeout(2000);
  await cleanupUI(page);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'dark/home.png'), fullPage: false });
  
  // 2. Tasks
  console.log('Capturing: dark/tasks-inbox.png');
  await clickSidebarItem(page, /tasks/i);
  await page.waitForTimeout(1000);
  await cleanupUI(page);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'dark/tasks-inbox.png'), fullPage: false });
  
  // 3. Note Editor - use search to find "Project Notes"
  console.log('Capturing: dark/notes.png');
  await searchAndNavigate(page, 'Project Notes');
  await page.waitForTimeout(1000);
  await cleanupUI(page);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'dark/notes.png'), fullPage: false });
  
  // 4. Kanban Board - use search to find "Product Launch"
  console.log('Capturing: dark/kanban.png');
  await searchAndNavigate(page, 'Product Launch');
  await page.waitForTimeout(1000);
  await cleanupUI(page);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'dark/kanban.png'), fullPage: false });
  
  // 5. Whiteboard - use search to find "Design Inspiration"
  console.log('Capturing: dark/whiteboard.png');
  await searchAndNavigate(page, 'Design Inspiration');
  await expect(page.locator('.excalidraw')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(2000);
  await cleanupUI(page);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'dark/whiteboard.png'), fullPage: false });
  
  // 6. Collection View - use search to find "Work" collection
  console.log('Capturing: dark/collection.png');
  await searchAndNavigate(page, 'Work');
  await page.waitForTimeout(1000);
  await cleanupUI(page);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'dark/collection.png'), fullPage: false });
  
  // ========== LIGHT MODE SCREENSHOTS ==========
  console.log('\n=== Starting light mode screenshots ===');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForTimeout(500);
  
  // 1. Home
  console.log('Capturing: light/home.png');
  await page.goto('/');
  await page.waitForTimeout(2000);
  await cleanupUI(page);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'light/home.png'), fullPage: false });
  
  // 2. Tasks
  console.log('Capturing: light/tasks-inbox.png');
  await clickSidebarItem(page, /tasks/i);
  await page.waitForTimeout(1000);
  await cleanupUI(page);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'light/tasks-inbox.png'), fullPage: false });
  
  // 3. Note Editor
  console.log('Capturing: light/notes.png');
  await searchAndNavigate(page, 'Project Notes');
  await page.waitForTimeout(1000);
  await cleanupUI(page);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'light/notes.png'), fullPage: false });
  
  // 4. Kanban Board
  console.log('Capturing: light/kanban.png');
  await searchAndNavigate(page, 'Product Launch');
  await page.waitForTimeout(1000);
  await cleanupUI(page);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'light/kanban.png'), fullPage: false });
  
  // 5. Whiteboard
  console.log('Capturing: light/whiteboard.png');
  await searchAndNavigate(page, 'Design Inspiration');
  await expect(page.locator('.excalidraw')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(2000);
  await cleanupUI(page);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'light/whiteboard.png'), fullPage: false });
  
  // 6. Collection View
  console.log('Capturing: light/collection.png');
  await searchAndNavigate(page, 'Work');
  await page.waitForTimeout(1000);
  await cleanupUI(page);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'light/collection.png'), fullPage: false });
  
  console.log('\n=== All screenshots captured successfully! ===');
});
