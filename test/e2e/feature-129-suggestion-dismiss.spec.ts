/**
 * E2E verification for Feature #129:
 * Tests the Dismiss flow: trigger AI suggestion, click Dismiss,
 * verify buttons disappear and status changes to "dismissed".
 *
 * Uses Playwright route interception to mock the Anthropic API response,
 * so the test works without a real API key.
 */

import { test, expect } from '@playwright/test';

/** Mock a streaming SSE response from the Anthropic messages API */
function mockAnthropicStreamResponse(text: string): string {
  const events = [
    'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_mock","type":"message","role":"assistant","content":[],"model":"claude-3-haiku-20240307","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":10,"output_tokens":1}}}\n\n',
    'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
    `event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":${JSON.stringify(text)}}}\n\n`,
    'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
    'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":20}}\n\n',
    'event: message_stop\ndata: {"type":"message_stop"}\n\n',
  ];
  return events.join('');
}

test.describe('Feature #129 - Suggestion Dismiss', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept Anthropic API calls with a mock response
    await page.route('**/v1/messages', async (route) => {
      const body = mockAnthropicStreamResponse(
        'Consider adding error handling middleware for robustness.',
      );
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body,
      });
    });

    await page.goto('/?load=ecommerce.archc', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
  });

  test('dismissing a suggestion removes buttons and changes status to dismissed', async ({
    page,
  }) => {
    // Select a node
    await page.locator('[data-testid="node-display-name"]').first().click();
    await page.waitForTimeout(500);

    // Open AI Chat tab and create a suggestion
    await page.locator('[data-testid="tab-aichat"]').click();
    await page.waitForTimeout(300);
    await page.locator('[data-testid="ai-chat-input"]').fill('Test dismiss functionality');
    await page.locator('[data-testid="ai-send-button"]').click();
    await page.waitForTimeout(2000);

    // Click "Apply" on the AI response to create a pending suggestion note
    const applyButton = page.locator('[data-testid="ai-apply-suggestion"]').first();
    await expect(applyButton).toBeVisible({ timeout: 5000 });
    await applyButton.click();
    await page.waitForTimeout(500);

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
    const actionsAfterDismiss = await page
      .locator('[data-testid="suggestion-actions"]')
      .count();
    expect(actionsAfterDismiss).toBe(0);

    // Verify status changed to dismissed
    const statuses = page.locator('[data-testid="note-status"]');
    const statusCount = await statuses.count();
    const statusTexts: string[] = [];
    for (let i = 0; i < statusCount; i++) {
      const text = await statuses.nth(i).textContent();
      statusTexts.push(text ?? '');
    }
    expect(statusTexts.some((t) => t.includes('dismissed'))).toBe(true);
  });
});
