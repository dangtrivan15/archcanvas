import { test, expect, type Page } from '@playwright/test';
import { gotoApp } from './e2e-helpers';

/**
 * Multi-provider AI Settings UI flow (no-bridge). Extends
 * api-key-provider.spec.ts's pattern (same gotoApp/toggleChat bootstrap, same
 * provider-selector -> dialog navigation) to the three Phase 2 providers:
 * OpenAI, Ollama, Gemini.
 *
 * api-key-provider.spec.ts never actually exercises a real "Test connection"
 * network call (its tests stop at dialog/field assertions), so there's no
 * existing HTTP-mocking layer in this repo to reuse verbatim. This file adds
 * one: Playwright's `page.route()` request interception, applied to the
 * provider's real API host, so "Test connection" resolves deterministically
 * without ever hitting a real network endpoint from CI.
 */

async function openProviderSelector(page: Page): Promise<void> {
  await page.getByRole('button', { name: /AI provider/i }).click();
}

async function selectProvider(page: Page, displayName: string): Promise<void> {
  await openProviderSelector(page);
  await page.getByText(displayName, { exact: true }).click();
  await page.waitForTimeout(200);
  if (!(await page.getByRole('dialog').isVisible().catch(() => false))) {
    await page.getByRole('button', { name: /AI settings/i }).click();
    await page.waitForTimeout(200);
  }
}

test.describe('Multi-provider AI Settings', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__archcanvas_uiStore__.getState().toggleChat();
    });
    await page.waitForTimeout(200);
  });

  test('provider selector lists Claude, OpenAI, Ollama, and Gemini', async ({ page }) => {
    await openProviderSelector(page);

    await expect(page.getByText('Claude (API Key)')).toBeVisible();
    await expect(page.getByText('OpenAI', { exact: true })).toBeVisible();
    await expect(page.getByText('Ollama', { exact: true })).toBeVisible();
    await expect(page.getByText('Gemini', { exact: true })).toBeVisible();
  });

  test('OpenAI settings form shows key input, model dropdown, and Test connection', async ({ page }) => {
    await selectProvider(page, 'OpenAI');

    await expect(page.getByLabel(/API Key/i)).toBeVisible();
    await expect(page.getByLabel(/Model/i)).toBeVisible();
    await expect(page.getByText('Test Connection')).toBeVisible();
    await expect(page.getByText(/local storage/i)).toBeVisible();
  });

  test('Ollama settings form shows a host field instead of a key field', async ({ page }) => {
    await selectProvider(page, 'Ollama');

    await expect(page.getByLabel(/Ollama Host/i)).toBeVisible();
    await expect(page.getByLabel(/Model/i)).toBeVisible();
    await expect(page.getByText('Test Connection')).toBeVisible();
    // No API key field for Ollama — no key required for a local server.
    await expect(page.getByLabel(/^API Key$/i)).not.toBeVisible();
  });

  test('Gemini settings form shows key input, model dropdown, and Test connection', async ({ page }) => {
    await selectProvider(page, 'Gemini');

    await expect(page.getByLabel(/API Key/i)).toBeVisible();
    await expect(page.getByLabel(/Model/i)).toBeVisible();
    await expect(page.getByText('Test Connection')).toBeVisible();
  });

  test('a mocked successful OpenAI connection marks the provider available and updates the header', async ({
    page,
  }) => {
    // Deterministic mock of OpenAI's models endpoint — never hits the real
    // network. Response shape matches the `openai` SDK's models.list() page.
    await page.route('https://api.openai.com/v1/models', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          object: 'list',
          data: [{ id: 'gpt-4o-mini', object: 'model', created: 0, owned_by: 'openai' }],
        }),
      });
    });

    await selectProvider(page, 'OpenAI');

    // Enter a (fake) API key and save it.
    const keyInput = page.getByLabel(/API Key/i);
    await keyInput.fill('sk-test-fake-key');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(100);

    // Test connection.
    await page.getByRole('button', { name: 'Test connection' }).click();
    await expect(page.getByText('Connected')).toBeVisible();

    // Capability badge reflects the effective (tool-capable) capabilities.
    // Scoped to the settings dialog: the same badge also renders in the chat
    // header (ChatPanel), which stays mounted behind the dialog overlay, so
    // an unscoped getByTestId resolves to both and violates strict mode.
    await expect(
      page.getByRole('dialog').getByTestId('capability-badge').getByText('Tools'),
    ).toBeVisible();

    // Chat header now shows OpenAI as the active, available provider.
    const providerTrigger = page.getByLabel('AI provider');
    await expect(providerTrigger).toHaveAttribute('data-connected', 'true');
    await expect(providerTrigger).toContainText('OpenAI');
  });
});
