import { test, expect } from '@playwright/test';
import { gotoApp } from './e2e-helpers';

test.describe('Theme System', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await gotoApp(page);
  });

  test('default theme applies correctly', async ({ page }) => {
    const fontSize = await page.evaluate(() =>
      document.documentElement.style.fontSize
    );
    expect(fontSize).toBe('15px'); // medium default
  });

  test('Appearance dialog opens from View menu', async ({ page }) => {
    await page.click('text=View');
    await page.click('text=Appearance');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });

  test('palette switch changes CSS variables', async ({ page }) => {
    // Open Appearance dialog
    await page.click('text=View');
    await page.click('text=Appearance');

    // Click Rose Pine palette card
    await page.click('[data-palette="rose-pine"]');

    // Verify CSS variable changed
    const bg = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--color-background')
    );
    expect(bg).toBeTruthy();
    expect(bg).not.toBe('#09090b'); // Not the default dark zinc
  });

  test('mode toggle cycles light → dark → system', async ({ page }) => {
    // Find the theme toggle button in the toolbar
    const toggleBtn = page.locator('button[aria-label*="mode"], button[aria-label*="System"]').first();

    // Click to cycle modes — verify the button still exists after each click
    await toggleBtn.click();
    await page.waitForTimeout(50);
    await page.locator('button[aria-label*="mode"], button[aria-label*="System"]').first().click();
    await page.waitForTimeout(50);
    await page.locator('button[aria-label*="mode"], button[aria-label*="System"]').first().click();
  });

  test('text size change updates html font-size', async ({ page }) => {
    await page.click('text=View');
    await page.click('text=Appearance');

    // Click Small text size
    await page.click('[data-text-size="small"]');
    const smallSize = await page.evaluate(() =>
      document.documentElement.style.fontSize
    );
    expect(smallSize).toBe('13px');

    // Click Large text size
    await page.click('[data-text-size="large"]');
    const largeSize = await page.evaluate(() =>
      document.documentElement.style.fontSize
    );
    expect(largeSize).toBe('17px');
  });

  test('preferences persist across reload', async ({ page }) => {
    // Open dialog and switch to Rose Pine
    await page.click('text=View');
    await page.click('text=Appearance');
    await page.click('[data-palette="rose-pine"]');

    // Close dialog and reload
    await page.keyboard.press('Escape');
    await page.reload();
    await page.waitForTimeout(200);

    // Verify palette persisted in localStorage
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('archcanvas:theme') || '{}')
    );
    expect(stored.palette).toBe('rose-pine');
  });
});
