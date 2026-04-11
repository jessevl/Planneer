import { test, expect } from '@playwright/test';
import { TEST_USER } from './test-config';

test.describe('Authentication', () => {
  test('shows choice screen on unauthenticated visit', async ({ page }) => {
    await page.goto('/');

    // Should show welcome heading and auth options
    await expect(page.getByRole('heading', { name: /welcome to planneer/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with email/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in with password/i })).toBeVisible();
  });

  test('logs in with valid credentials', async ({ page }) => {
    await page.goto('/');

    // Click "Sign in with Password" to show email/password form
    await page.getByRole('button', { name: /sign in with password/i }).click();

    // Fill in credentials from centralized config
    await page.getByLabel(/email address/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);
    await page.getByRole('button', { name: /^sign in$/i }).click();

    // Should show authenticated content (Home dashboard greeting or sidebar)
    await expect(page.getByText(/Good (morning|afternoon|evening)|home/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/');

    // Click "Sign in with Password" to show email/password form
    await page.getByRole('button', { name: /sign in with password/i }).click();

    // Fill in bad credentials
    await page.getByLabel(/email address/i).fill('wrong@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /^sign in$/i }).click();

    // Should show error message
    await expect(page.getByText(/invalid|incorrect|failed|error/i)).toBeVisible({ timeout: 5000 });
  });

  test('password field is masked', async ({ page }) => {
    await page.goto('/');

    // Click "Sign in with Password" to show email/password form
    await page.getByRole('button', { name: /sign in with password/i }).click();

    const passwordInput = page.getByLabel(/password/i);
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('can go back from password form to choice screen', async ({ page }) => {
    await page.goto('/');

    // Go to password form
    await page.getByRole('button', { name: /sign in with password/i }).click();
    await expect(page.getByRole('heading', { name: /sign in with password/i })).toBeVisible();

    // Click back
    await page.getByRole('button', { name: /back/i }).click();
    
    // Should be back at choice screen
    await expect(page.getByRole('heading', { name: /welcome to planneer/i })).toBeVisible();
  });
});
