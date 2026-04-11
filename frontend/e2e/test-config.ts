/**
 * E2E Test Configuration
 * 
 * Centralized configuration for E2E tests to ensure consistency.
 * Credentials can be overridden via environment variables.
 */

// Test user credentials
// These should match the demo user created by the backend in development mode.
// Set PLANNEER_DEMO_PASSWORD in both backend/.env and when running E2E tests.
export const TEST_USER = {
  email: process.env.E2E_TEST_EMAIL || 'demo@planneer.app',
  password: process.env.E2E_TEST_PASSWORD || 'PlanneerDemo2024!Dev',
};

// Timeouts
export const TIMEOUTS = {
  login: 15000,
  navigation: 10000,
  animation: 500,
};

/**
 * Helper to login before tests
 */
export async function login(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  
  // Click "Sign in with Password" to show email/password form
  await page.getByRole('button', { name: /sign in with password/i }).click();
  
  // Fill in credentials from centralized config
  await page.getByLabel(/email address/i).fill(TEST_USER.email);
  await page.getByLabel(/password/i).fill(TEST_USER.password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  
  // Wait for authenticated content to appear
  await page.waitForSelector('text=/inbox|today|tasks/i', { timeout: TIMEOUTS.login });
}