import { test, expect } from '@playwright/test';
import { gotoApp } from './e2e-helpers';

test.describe('registry discoverability', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the stats endpoint so it doesn't make real network calls
    await page.route('https://registry.archcanvas.dev/api/v1/stats', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ totalNodeDefs: 150, totalNamespaces: 12, totalDownloads: 5000 }),
      });
    });
    // Mock other registry endpoints that might be called
    await page.route('https://registry.archcanvas.dev/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0, namespaces: [], tags: [], updates: [] }),
      });
    });
    await gotoApp(page);
  });

  test('Registry menu is visible in TopMenubar', async ({ page }) => {
    await expect(page.getByRole('menubar').getByText('Registry')).toBeVisible();
  });

  test('Left Toolbar has registry button with correct aria-label', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Open Registry/ })).toBeVisible();
  });

  test('Status Bar registry indicator is present', async ({ page }) => {
    await expect(page.getByTestId('registry-indicator')).toBeVisible();
  });

  test('clicking Browse Community Registry opens registry panel', async ({ page }) => {
    await page.getByRole('menubar').getByText('Registry').click();
    await page.getByRole('menuitem', { name: 'Browse Community Registry' }).click();
    // The right panel should open in registry mode showing the community tab
    await expect(page.getByTestId('tab-community')).toBeVisible();
  });

  test('clicking Left Toolbar registry button opens registry panel', async ({ page }) => {
    await page.getByRole('button', { name: /Open Registry/ }).first().click();
    await expect(page.getByTestId('tab-installed')).toBeVisible();
  });
});
