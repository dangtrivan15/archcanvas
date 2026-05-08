import { test, expect } from '@playwright/test';
import { gotoApp } from './e2e-helpers';

test.describe('registry discoverability', () => {
  test.beforeEach(async ({ page }) => {
    // Register wildcard FIRST — Playwright uses LIFO, so this is checked last.
    await page.route('https://registry.archcanvas.dev/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0, namespaces: [], tags: [], updates: [] }),
      });
    });
    // Register specific stats route SECOND — checked first by Playwright (LIFO).
    await page.route('https://registry.archcanvas.dev/api/v1/stats', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ totalNodeDefs: 150, totalNamespaces: 12, totalDownloads: 5000 }),
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
    // First open the panel via toolbar so it's mounted (smart default = community with no installs)
    await page.getByRole('button', { name: /Open Registry/ }).first().click();
    // Switch to installed tab manually to prove the panel is not already on community
    await page.getByTestId('tab-installed').click();
    await expect(page.getByTestId('tab-installed')).toHaveAttribute('aria-selected', 'true');
    // Now click "Browse Community Registry" from the menu
    await page.getByRole('menubar').getByText('Registry').click();
    await page.getByRole('menuitem', { name: 'Browse Community Registry' }).click();
    // The community tab should now be active
    await expect(page.getByTestId('tab-community')).toHaveAttribute('aria-selected', 'true');
  });

  test('clicking Left Toolbar registry button opens registry panel', async ({ page }) => {
    await page.getByRole('button', { name: /Open Registry/ }).first().click();
    // Smart default with no installs = community tab
    await expect(page.getByTestId('tab-community')).toHaveAttribute('aria-selected', 'true');
  });
});
