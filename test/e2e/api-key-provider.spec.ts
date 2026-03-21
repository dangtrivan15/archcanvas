import { test, expect } from '@playwright/test';
import { gotoApp } from './e2e-helpers';

test.describe('API Key Provider', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    // Open chat panel
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__archcanvas_uiStore__.getState().toggleChat();
    });
    await page.waitForTimeout(200);
  });

  test('shows Claude (API Key) in provider selector', async ({ page }) => {
    // Open provider selector dropdown
    const providerButton = page.getByRole('button', { name: /AI provider/i });
    await providerButton.click();

    // Verify "Claude (API Key)" appears in dropdown
    await expect(page.getByText('Claude (API Key)')).toBeVisible();
  });

  test('clicking unconfigured provider opens AI Settings dialog', async ({ page }) => {
    // Open provider selector dropdown
    const providerButton = page.getByRole('button', { name: /AI provider/i });
    await providerButton.click();

    // Click "Claude (API Key)" — should open dialog since key is not configured
    await page.getByText('Claude (API Key)').click();
    await page.waitForTimeout(200);

    // Verify AI Settings dialog opens
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('AI Settings')).toBeVisible();
    await expect(page.getByLabel(/API Key/i)).toBeVisible();
    await expect(page.getByLabel(/Model/i)).toBeVisible();
    await expect(page.getByText('Test Connection')).toBeVisible();
    await expect(page.getByText(/local storage/i)).toBeVisible();
  });

  test('gear icon opens AI Settings dialog', async ({ page }) => {
    // Click gear icon in chat header
    const gearButton = page.getByRole('button', { name: /AI settings/i });
    await gearButton.click();
    await page.waitForTimeout(200);

    // Verify dialog opens
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('AI Settings')).toBeVisible();
  });

  test('model dropdown shows all options', async ({ page }) => {
    // Select the API key provider first (dialog is provider-aware)
    const providerButton = page.getByRole('button', { name: /AI provider/i });
    await providerButton.click();
    await page.getByText('Claude (API Key)').click();
    await page.waitForTimeout(200);

    // The dialog should have opened since the provider is unconfigured
    // If not already open, open it via gear icon
    if (!(await page.getByRole('dialog').isVisible().catch(() => false))) {
      await page.getByRole('button', { name: /AI settings/i }).click();
      await page.waitForTimeout(200);
    }

    const select = page.getByLabel(/Model/i);
    const options = select.locator('option');
    await expect(options).toHaveCount(3);
    await expect(options.nth(0)).toHaveText('Claude Opus 4.6');
    await expect(options.nth(1)).toHaveText('Claude Sonnet 4.6');
    await expect(options.nth(2)).toHaveText('Claude Haiku 4.5');
  });
});
