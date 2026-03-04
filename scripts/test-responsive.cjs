const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1200, height: 768 } });
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  let pass = 0;
  let fail = 0;
  function check(label, actual, expected) {
    if (actual === expected) {
      console.log('  PASS: ' + label + ' = ' + actual);
      pass++;
    } else {
      console.log('  FAIL: ' + label + ' = ' + actual + ' (expected ' + expected + ')');
      fail++;
    }
  }

  // ============= Test 1: Wide mode (1200px) =============
  console.log('=== 1200px (wide) ===');
  check('Toolbar visible', await page.locator('[data-testid="toolbar"]').isVisible(), true);
  check('Node count visible', await page.locator('[data-testid="node-count"]').isVisible(), true);
  check('Filename visible', await page.locator('[data-testid="filename-display"]').isVisible(), true);
  check('Dirty indicator visible', await page.locator('[data-testid="dirty-indicator"]').isVisible(), true);
  check('Zoom level visible', await page.locator('[data-testid="zoom-level"]').isVisible(), true);

  // Open left panel
  let expandBtn = page.locator('[data-testid="left-panel-expand"]');
  if (await expandBtn.isVisible()) {
    await expandBtn.click();
    await page.waitForTimeout(300);
  }
  check('Left panel visible', await page.locator('[data-testid="left-panel"]').isVisible(), true);
  check('Search input visible (full mode)', await page.locator('[data-testid="nodedef-search-input"]').isVisible(), true);
  check('Icon rail NOT active', (await page.locator('[data-testid="nodedef-browser"][data-mode="icon-rail"]').count()) === 0, true);

  await page.screenshot({ path: '.playwright-cli/test-1200px.png', fullPage: false });

  // ============= Test 2: Icon rail at 678px =============
  // Must re-open panel at this width since useResponsiveLayout auto-closed it
  await page.setViewportSize({ width: 678, height: 768 });
  await page.waitForTimeout(500);

  // Panel was auto-closed when crossing below 768. Re-open it.
  expandBtn = page.locator('[data-testid="left-panel-expand"]');
  if (await expandBtn.isVisible()) {
    await expandBtn.click();
    await page.waitForTimeout(300);
  }

  console.log('\n=== 678px (iPad 2/3 Split View) ===');
  check('Left panel visible', await page.locator('[data-testid="left-panel"]').isVisible(), true);
  check('Icon rail active', (await page.locator('[data-testid="nodedef-browser"][data-mode="icon-rail"]').count()) > 0, true);
  check('Search input hidden (rail mode)', await page.locator('[data-testid="nodedef-search-input"]').isVisible(), false);
  check('Node count visible (regular)', await page.locator('[data-testid="node-count"]').isVisible(), true);

  await page.screenshot({ path: '.playwright-cli/test-678px.png', fullPage: false });

  // ============= Test 3: Full sidebar at 800px =============
  await page.setViewportSize({ width: 800, height: 768 });
  await page.waitForTimeout(500);

  console.log('\n=== 800px (above icon rail threshold) ===');
  // Panel should still be visible (it was open)
  check('Left panel visible', await page.locator('[data-testid="left-panel"]').isVisible(), true);
  check('Icon rail NOT active', (await page.locator('[data-testid="nodedef-browser"][data-mode="icon-rail"]').count()) === 0, true);
  check('Search input visible (full mode)', await page.locator('[data-testid="nodedef-search-input"]').isVisible(), true);

  await page.screenshot({ path: '.playwright-cli/test-800px.png', fullPage: false });

  // ============= Test 4: Compact at 507px =============
  await page.setViewportSize({ width: 507, height: 768 });
  await page.waitForTimeout(500);
  console.log('\n=== 507px (iPad 1/2 Split View - compact) ===');
  check('Node count hidden (compact)', await page.locator('[data-testid="node-count"]').isVisible(), false);
  check('Dirty indicator visible', await page.locator('[data-testid="dirty-indicator"]').isVisible(), true);
  check('Left panel hidden (compact)', await page.locator('[data-testid="left-panel"]').isVisible(), false);
  check('Zoom level hidden (compact)', await page.locator('[data-testid="zoom-level"]').isVisible(), false);

  await page.screenshot({ path: '.playwright-cli/test-507px.png', fullPage: false });

  // ============= Test 5: Slide Over at 320px =============
  await page.setViewportSize({ width: 320, height: 768 });
  await page.waitForTimeout(500);
  console.log('\n=== 320px (iPad Slide Over) ===');
  check('Toolbar visible', await page.locator('[data-testid="toolbar"]').isVisible(), true);
  check('Node count hidden', await page.locator('[data-testid="node-count"]').isVisible(), false);
  check('Dirty indicator visible', await page.locator('[data-testid="dirty-indicator"]').isVisible(), true);
  check('Zoom level hidden', await page.locator('[data-testid="zoom-level"]').isVisible(), false);
  check('Status bar visible', await page.locator('[data-testid="status-bar"]').isVisible(), true);

  await page.screenshot({ path: '.playwright-cli/test-320px.png', fullPage: false });

  // ============= Test 6: No overflow =============
  console.log('\n=== Overflow check ===');
  const sizes = [320, 507, 600, 678, 768, 1024, 1200];
  for (const w of sizes) {
    await page.setViewportSize({ width: w, height: 768 });
    await page.waitForTimeout(300);
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    if (bodyWidth > w) {
      console.log('  FAIL: OVERFLOW at ' + w + 'px: body scrollWidth=' + bodyWidth);
      fail++;
    } else {
      pass++;
    }
  }
  console.log('  No overflow at any tested width');

  // ============= Test 7: Orientation change =============
  console.log('\n=== Orientation change ===');
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(300);
  check('Landscape toolbar', await page.locator('[data-testid="toolbar"]').isVisible(), true);

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(300);
  check('Portrait toolbar', await page.locator('[data-testid="toolbar"]').isVisible(), true);

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(300);
  check('Back to landscape toolbar', await page.locator('[data-testid="toolbar"]').isVisible(), true);

  // ============= Results =============
  console.log('\n=== RESULTS ===');
  console.log('Console errors: ' + errors.length);
  errors.forEach(e => console.log(' -', e));
  console.log('Checks passed: ' + pass);
  console.log('Checks failed: ' + fail);
  console.log(fail === 0 && errors.length === 0 ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED');

  await browser.close();
  process.exit(fail > 0 || errors.length > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
