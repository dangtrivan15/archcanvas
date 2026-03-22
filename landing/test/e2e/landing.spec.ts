import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test('renders all sections', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('nav')).toBeVisible();
    await expect(page.getByText('ArchCanvas').first()).toBeVisible();
    await expect(page.getByText('You design the')).toBeVisible();
    await expect(page.getByText('AI writes the code.')).toBeVisible();
    await expect(page.getByText('Download for Mac').first()).toBeVisible();
    await expect(page.getByText('Why ArchCanvas')).toBeVisible();
    await expect(page.getByText('AI reads your architecture').first()).toBeVisible();
    await expect(page.getByText('How it works')).toBeVisible();
    await expect(page.getByText('Design').first()).toBeVisible();
    await expect(page.getByText('Built with')).toBeVisible();
    await expect(page.getByText('Ready to design your')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
  });

  test('mobile menu opens and closes', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    const hamburger = page.getByLabel('Open menu');
    await expect(hamburger).toBeVisible();

    await hamburger.click();
    await expect(page.getByLabel('Close menu')).toBeVisible();
    await expect(page.getByText('Features').last()).toBeVisible();

    await page.getByLabel('Close menu').click();
    await expect(page.getByLabel('Open menu')).toBeVisible();
  });

  test('hero diagram hidden on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    await expect(page.locator('svg[aria-label*="Architecture diagram"]')).not.toBeVisible();
    await expect(page.getByText('You design the')).toBeVisible();
  });
});
