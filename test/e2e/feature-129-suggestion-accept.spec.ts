/**
 * E2E verification for Feature #129:
 * AI suggestion notes show Accept and Dismiss buttons.
 * Tests the Accept flow: add regular note (no buttons), trigger AI suggestion
 * (shows Accept/Dismiss buttons), click Accept (buttons disappear, status changes).
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

test.describe('Feature #129 - Suggestion Accept', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept Anthropic API calls with a mock response
    await page.route('**/v1/messages', async (route) => {
      const body = mockAnthropicStreamResponse(
        'I suggest adding a caching layer to improve performance.',
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

  test('regular note has no Accept/Dismiss buttons and accepting suggestion changes status', async ({
    page,
  }) => {
    // Verify nodes are loaded
    const nodeCards = page.locator('[data-testid^="node-"]');
    await expect(nodeCards.first()).toBeVisible();
    const nodeCount = await nodeCards.count();
    expect(nodeCount).toBeGreaterThan(0);

    // Select a node to open the right panel
    const firstNode = page.locator('[data-testid="node-display-name"]').first();
    await firstNode.click();
    await page.waitForTimeout(500);

    // Verify right panel opened
    const rightPanel = page.locator('[data-testid="node-detail-panel"]');
    await expect(rightPanel).toBeVisible();

    // Open Notes tab
    const notesTab = page.locator('[data-testid="tab-notes"]');
    await notesTab.click();
    await page.waitForTimeout(300);

    // Click "Add Note" button to open the inline editor
    const addNoteButton = page.locator('[data-testid="add-note-button"]');
    await addNoteButton.click();
    await page.waitForTimeout(300);

    // Fill in the note form (editor is now visible)
    const authorInput = page.locator('[data-testid="note-author-input"]');
    const contentInput = page.locator('[data-testid="note-content-input"]');
    await authorInput.clear();
    await authorInput.fill('developer');
    await contentInput.fill('TEST_REGULAR_NOTE_129 - This is a regular note');

    // Submit the note
    const saveNoteButton = page.locator('[data-testid="save-note-button"]');
    await saveNoteButton.click();
    await page.waitForTimeout(500);

    // Verify regular note appears
    const notesList = page.locator('[data-testid="notes-list"]');
    await expect(notesList).toContainText('TEST_REGULAR_NOTE_129');

    // Verify regular note does NOT have Accept/Dismiss buttons
    const suggestionActionsBeforeAI = await page
      .locator('[data-testid="suggestion-actions"]')
      .count();
    expect(suggestionActionsBeforeAI).toBe(0);

    // Switch to AI Chat tab and send a message to trigger suggestion
    const aiChatTab = page.locator('[data-testid="tab-aichat"]');
    await aiChatTab.click();
    await page.waitForTimeout(300);

    const chatInput = page.locator('[data-testid="ai-chat-input"]');
    await chatInput.fill('Suggest an improvement for this node');
    const sendButton = page.locator('[data-testid="ai-send-button"]');
    await sendButton.click();
    await page.waitForTimeout(2000);

    // Click "Apply" on the AI response to create a pending suggestion note
    const applyButton = page.locator('[data-testid="ai-apply-suggestion"]').first();
    await expect(applyButton).toBeVisible({ timeout: 5000 });
    await applyButton.click();
    await page.waitForTimeout(500);

    // Switch back to Notes tab
    await notesTab.click();
    await page.waitForTimeout(500);

    // Verify pending suggestion note has Accept/Dismiss buttons
    const suggestionActionsAfterAI = await page
      .locator('[data-testid="suggestion-actions"]')
      .count();
    expect(suggestionActionsAfterAI).toBeGreaterThan(0);

    // Verify Accept button
    const acceptButton = page.locator('[data-testid="accept-suggestion"]').first();
    await expect(acceptButton).toBeVisible();
    await expect(acceptButton).toContainText('Accept');

    // Verify Dismiss button
    const dismissButton = page.locator('[data-testid="dismiss-suggestion"]').first();
    await expect(dismissButton).toBeVisible();
    await expect(dismissButton).toContainText('Dismiss');

    // Verify note statuses - should have both pending and none
    const noteStatuses = page.locator('[data-testid="note-status"]');
    const statusCount = await noteStatuses.count();
    const statusTexts: string[] = [];
    for (let i = 0; i < statusCount; i++) {
      const text = await noteStatuses.nth(i).textContent();
      statusTexts.push(text ?? '');
    }
    expect(statusTexts.some((t) => t.includes('pending'))).toBe(true);
    expect(statusTexts.some((t) => t.includes('none'))).toBe(true);

    // Click Accept and verify
    await acceptButton.click();
    await page.waitForTimeout(500);

    // Buttons should disappear after accepting
    const actionsAfterAccept = await page
      .locator('[data-testid="suggestion-actions"]')
      .count();
    expect(actionsAfterAccept).toBe(0);

    // Verify status changed to 'accepted'
    const statusesAfterAccept = page.locator('[data-testid="note-status"]');
    const afterCount = await statusesAfterAccept.count();
    const afterTexts: string[] = [];
    for (let i = 0; i < afterCount; i++) {
      const text = await statusesAfterAccept.nth(i).textContent();
      afterTexts.push(text ?? '');
    }
    expect(afterTexts.some((t) => t.includes('accepted'))).toBe(true);
  });
});
