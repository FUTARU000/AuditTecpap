import { test, expect } from '@playwright/test';

/**
 * Smoke spec — verifies the Next.js app boots and the shell renders.
 * Expanded after business screens land.
 */
test('home page renders with brand title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/TECPAP Audit Platform/i);
});

test('dashboard shell renders placeholders', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Certificates expiring')).toBeVisible();
});
