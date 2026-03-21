import { test, expect } from '@playwright/test';
import { gotoApp } from './e2e-helpers';

test.describe('Project File Tools', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('gear icon opens provider-aware settings dialog', async ({ page }) => {
    // Open chat panel
    await page.evaluate(() => {
      (window as any).__archcanvas_uiStore__.getState().toggleChat();
    });
    await page.waitForTimeout(200);

    // Click gear icon
    await page.getByRole('button', { name: /AI settings/i }).click();
    await page.waitForTimeout(200);

    // Verify dialog opens
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('AI Settings')).toBeVisible();
  });

  test('chat panel does not show inline path input', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__archcanvas_uiStore__.getState().toggleChat();
    });
    await page.waitForTimeout(200);

    // Verify no path input bar in chat footer
    await expect(page.locator('[data-testid="path-input-bar"]')).not.toBeVisible();
  });
});
