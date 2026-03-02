/**
 * Additional verification for Feature #129: Test the Dismiss button.
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

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    console.log('Step 1: Loading page...');
    await page.goto(`${BASE_URL}/?load=ecommerce.archc`, { waitUntil: 'networkidle' });
    await sleep(2000);

    console.log('Step 2: Selecting a node...');
    await page.locator('[data-testid="node-display-name"]').first().click();
    await sleep(500);

    console.log('Step 3: Opening AI Chat tab and creating suggestion...');
    await page.locator('[data-testid="tab-aichat"]').click();
    await sleep(300);
    await page.locator('[data-testid="ai-chat-input"]').fill('Test dismiss functionality');
    await page.locator('[data-testid="ai-send-button"]').click();
    await sleep(1500);

    console.log('Step 4: Opening Notes tab...');
    await page.locator('[data-testid="tab-notes"]').click();
    await sleep(500);

    // Verify suggestion actions present
    const actionsCount = await page.locator('[data-testid="suggestion-actions"]').count();
    console.log(`  Suggestion actions: ${actionsCount}`);
    if (actionsCount === 0) throw new Error('No suggestion actions found');

    console.log('Step 5: Clicking Dismiss button...');
    const dismissButton = page.locator('[data-testid="dismiss-suggestion"]').first();
    const dismissVisible = await dismissButton.isVisible();
    console.log(`  Dismiss button visible: ${dismissVisible}`);
    await dismissButton.click();
    await sleep(500);

    // Verify buttons disappeared
    const actionsAfterDismiss = await page.locator('[data-testid="suggestion-actions"]').count();
    console.log(`  Suggestion actions after dismiss: ${actionsAfterDismiss}`);
    if (actionsAfterDismiss > 0) throw new Error('Buttons should disappear after dismiss');

    // Verify status changed to dismissed
    const statuses = page.locator('[data-testid="note-status"]');
    const statusCount = await statuses.count();
    let hasDismissed = false;
    for (let i = 0; i < statusCount; i++) {
      const text = await statuses.nth(i).textContent();
      console.log(`  Note ${i}: ${text}`);
      if (text.includes('dismissed')) hasDismissed = true;
    }
    if (!hasDismissed) throw new Error('No note with status "dismissed" found');

    console.log(`\nConsole errors: ${consoleErrors.length}`);
    console.log('\n✅ DISMISS VERIFICATION PASSED');
    console.log('  ✓ Dismiss button visible and clickable');
    console.log('  ✓ Clicking Dismiss removes Accept/Dismiss buttons');
    console.log('  ✓ Note status changes to "dismissed"');

  } catch (error) {
    console.error(`\n❌ DISMISS TEST FAILED: ${error.message}`);
    await page.screenshot({ path: '.playwright-cli/feature-129-dismiss-failure.png' });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
