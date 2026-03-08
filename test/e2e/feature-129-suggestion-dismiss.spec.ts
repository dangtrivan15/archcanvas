/**
 * E2E verification for Feature #129:
 * Tests the Dismiss flow: trigger AI suggestion, click Dismiss,
 * verify buttons disappear and status changes to "dismissed".
 */

import { test, expect } from '@playwright/test';

test.describe('Feature #129 - Suggestion Dismiss', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?load=ecommerce.archc', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
  });

  test('dismissing a suggestion removes buttons and changes status to dismissed', async ({ page }) => {
    // Select a node
    await page.locator('[data-testid="node-display-name"]').first().click();
    await page.waitForTimeout(500);

    // Open AI Chat tab and create a suggestion
    await page.locator('[data-testid="tab-aichat"]').click();
    await page.waitForTimeout(300);
    await page.locator('[data-testid="ai-chat-input"]').fill('Test dismiss functionality');
    await page.locator('[data-testid="ai-send-button"]').click();
    await page.waitForTimeout(1500);

    // Switch to Notes tab
    await page.locator('[data-testid="tab-notes"]').click();
    await page.waitForTimeout(500);

    // Verify suggestion actions present
    const actionsCount = await page.locator('[data-testid="suggestion-actions"]').count();
    expect(actionsCount).toBeGreaterThan(0);

    // Click Dismiss
    const dismissButton = page.locator('[data-testid="dismiss-suggestion"]').first();
    await expect(dismissButton).toBeVisible();
    await dismissButton.click();
    await page.waitForTimeout(500);

    // Verify buttons disappeared
    const actionsAfterDismiss = await page.locator('[data-testid="suggestion-actions"]').count();
    expect(actionsAfterDismiss).toBe(0);

    // Verify status changed to dismissed
    const statuses = page.locator('[data-testid="note-status"]');
    const statusCount = await statuses.count();
    const statusTexts: string[] = [];
    for (let i = 0; i < statusCount; i++) {
      const text = await statuses.nth(i).textContent();
      statusTexts.push(text ?? '');
    }
    expect(statusTexts.some(t => t.includes('dismissed'))).toBe(true);
  });
});
