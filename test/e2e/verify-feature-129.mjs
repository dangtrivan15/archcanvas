/**
 * E2E verification for Feature #129:
 * AI suggestion notes show Accept and Dismiss buttons.
 *
 * Steps:
 * 1. Load the ecommerce test architecture
 * 2. Select a node → opens right panel
 * 3. Go to Notes tab → add a regular note (no Accept/Dismiss buttons)
 * 4. Go to AI Chat tab → send a message → AI creates pending suggestion
 * 5. Go back to Notes tab → verify pending suggestion shows Accept & Dismiss buttons
 * 6. Verify the regular note does NOT show Accept/Dismiss buttons
 * 7. Click Accept → verify button disappears and status changes
 */

import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5174';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // Collect console errors
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    // Step 1: Load page with test file
    console.log('Step 1: Loading page with ecommerce test architecture...');
    await page.goto(`${BASE_URL}/?load=ecommerce.archc`, { waitUntil: 'networkidle' });
    await sleep(2000);

    // Verify nodes are loaded - testids are node-{archNodeId}
    const nodeCards = await page.locator('[data-testid^="node-"]').count();
    console.log(`  Found ${nodeCards} node cards`);
    if (nodeCards === 0) {
      throw new Error('No nodes found on canvas - architecture not loaded');
    }

    // Step 2: Click on a node to select it (click the node display name to be precise)
    console.log('Step 2: Selecting a node...');
    const firstNode = page.locator('[data-testid="node-display-name"]').first();
    await firstNode.click();
    await sleep(500);

    // Verify right panel opened
    const rightPanel = page.locator('[data-testid="node-detail-panel"]');
    const panelVisible = await rightPanel.isVisible();
    console.log(`  Right panel visible: ${panelVisible}`);
    if (!panelVisible) {
      throw new Error('Right panel did not open after selecting node');
    }

    // Step 3: Click Notes tab
    console.log('Step 3: Opening Notes tab...');
    const notesTab = page.locator('[data-testid="tab-notes"]');
    await notesTab.click();
    await sleep(300);

    // Check for empty state or existing notes
    const notesTabContent = page.locator('[data-testid="notes-tab"]');
    const notesTabVisible = await notesTabContent.isVisible();
    console.log(`  Notes tab content visible: ${notesTabVisible}`);

    // Step 4: Add a regular note (status='none')
    console.log('Step 4: Adding a regular note...');
    const authorInput = page.locator('[data-testid="note-author-input"]');
    const contentInput = page.locator('[data-testid="note-content-input"]');
    const addNoteButton = page.locator('[data-testid="add-note-button"]');

    await authorInput.clear();
    await authorInput.fill('developer');
    await contentInput.fill('TEST_REGULAR_NOTE_129 - This is a regular note');
    await addNoteButton.click();
    await sleep(500);

    // Verify regular note appears
    const notesList = page.locator('[data-testid="notes-list"]');
    const regularNoteText = await notesList.textContent();
    console.log(`  Notes list contains regular note: ${regularNoteText.includes('TEST_REGULAR_NOTE_129')}`);
    if (!regularNoteText.includes('TEST_REGULAR_NOTE_129')) {
      throw new Error('Regular note was not added');
    }

    // Step 5: Verify regular note does NOT have Accept/Dismiss buttons
    console.log('Step 5: Verifying regular note has no Accept/Dismiss buttons...');
    // Find all suggestion-actions containers
    const suggestionActionsBeforeAI = await page.locator('[data-testid="suggestion-actions"]').count();
    console.log(`  Suggestion action containers before AI: ${suggestionActionsBeforeAI}`);
    if (suggestionActionsBeforeAI > 0) {
      throw new Error('Regular note should NOT have Accept/Dismiss buttons!');
    }

    // Step 6: Switch to AI Chat tab and send a message to trigger suggestion
    console.log('Step 6: Switching to AI Chat tab and sending a message...');
    const aiChatTab = page.locator('[data-testid="tab-aichat"]');
    await aiChatTab.click();
    await sleep(300);

    const chatInput = page.locator('[data-testid="ai-chat-input"]');
    await chatInput.fill('Suggest an improvement for this node');
    const sendButton = page.locator('[data-testid="ai-send-button"]');
    await sendButton.click();
    await sleep(1500); // Wait for placeholder AI response + suggestion creation

    // Step 7: Switch back to Notes tab
    console.log('Step 7: Switching back to Notes tab...');
    await notesTab.click();
    await sleep(500);

    // Verify we now have a pending suggestion note with Accept/Dismiss buttons
    const suggestionActionsAfterAI = await page.locator('[data-testid="suggestion-actions"]').count();
    console.log(`  Suggestion action containers after AI: ${suggestionActionsAfterAI}`);
    if (suggestionActionsAfterAI === 0) {
      throw new Error('AI suggestion note should show Accept/Dismiss buttons!');
    }

    // Step 8: Verify Accept button exists
    console.log('Step 8: Verifying Accept button...');
    const acceptButton = page.locator('[data-testid="accept-suggestion"]').first();
    const acceptVisible = await acceptButton.isVisible();
    const acceptText = await acceptButton.textContent();
    console.log(`  Accept button visible: ${acceptVisible}, text: "${acceptText}"`);
    if (!acceptVisible || !acceptText.includes('Accept')) {
      throw new Error('Accept button not found or has wrong text');
    }

    // Step 9: Verify Dismiss button exists
    console.log('Step 9: Verifying Dismiss button...');
    const dismissButton = page.locator('[data-testid="dismiss-suggestion"]').first();
    const dismissVisible = await dismissButton.isVisible();
    const dismissText = await dismissButton.textContent();
    console.log(`  Dismiss button visible: ${dismissVisible}, text: "${dismissText}"`);
    if (!dismissVisible || !dismissText.includes('Dismiss')) {
      throw new Error('Dismiss button not found or has wrong text');
    }

    // Step 10: Verify the pending note status
    console.log('Step 10: Verifying note statuses...');
    const noteStatuses = page.locator('[data-testid="note-status"]');
    const statusCount = await noteStatuses.count();
    let hasPending = false;
    let hasNone = false;
    for (let i = 0; i < statusCount; i++) {
      const statusText = await noteStatuses.nth(i).textContent();
      console.log(`  Note ${i}: ${statusText}`);
      if (statusText.includes('pending')) hasPending = true;
      if (statusText.includes('none')) hasNone = true;
    }
    if (!hasPending) throw new Error('No note with status "pending" found');
    if (!hasNone) throw new Error('No note with status "none" found');

    // Step 11: Click Accept on the suggestion and verify it works
    console.log('Step 11: Clicking Accept button...');
    await acceptButton.click();
    await sleep(500);

    // After accepting, the buttons should disappear
    const suggestionActionsAfterAccept = await page.locator('[data-testid="suggestion-actions"]').count();
    console.log(`  Suggestion action containers after Accept: ${suggestionActionsAfterAccept}`);
    if (suggestionActionsAfterAccept > 0) {
      throw new Error('Accept/Dismiss buttons should disappear after accepting');
    }

    // Verify the note status changed to 'accepted'
    const statusesAfterAccept = page.locator('[data-testid="note-status"]');
    const statusAfterCount = await statusesAfterAccept.count();
    let hasAccepted = false;
    for (let i = 0; i < statusAfterCount; i++) {
      const statusText = await statusesAfterAccept.nth(i).textContent();
      console.log(`  Note ${i} after accept: ${statusText}`);
      if (statusText.includes('accepted')) hasAccepted = true;
    }
    if (!hasAccepted) throw new Error('No note with status "accepted" found after clicking Accept');

    // Check console errors
    console.log('\nConsole errors:', consoleErrors.length);
    consoleErrors.forEach((err) => console.log(`  ERROR: ${err}`));

    console.log('\n✅ ALL VERIFICATIONS PASSED for Feature #129');
    console.log('  ✓ Regular note does NOT show Accept/Dismiss buttons');
    console.log('  ✓ AI suggestion note shows Accept button');
    console.log('  ✓ AI suggestion note shows Dismiss button');
    console.log('  ✓ Clicking Accept removes buttons and changes status to accepted');
    console.log('  ✓ Non-suggestion notes remain unaffected');

  } catch (error) {
    console.error(`\n❌ VERIFICATION FAILED: ${error.message}`);
    // Take a screenshot for debugging
    await page.screenshot({ path: '.playwright-cli/feature-129-failure.png' });
    console.log('  Screenshot saved to .playwright-cli/feature-129-failure.png');
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
