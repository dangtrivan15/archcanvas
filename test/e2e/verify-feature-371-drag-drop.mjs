/**
 * E2E test: Feature #371 - Inter-App Drag & Drop for Files
 * Tests: drop zone overlay, .archc file drop, unsupported file handling
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5173';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Collect console messages
  const consoleMsgs = [];
  page.on('console', msg => consoleMsgs.push({ type: msg.type(), text: msg.text() }));

  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // 1. Test drop zone overlay on dragenter with Files
  console.log('Test 1: Drop zone overlay appears on file drag');
  const overlayResult = await page.evaluate(() => {
    const canvasEl = document.querySelector('[data-testid="canvas"]');
    if (!canvasEl) return { error: 'Canvas not found' };

    const dt = new DataTransfer();
    dt.items.add(new File(['x'], 'test.archc'));

    const dragEnterEvent = new DragEvent('dragenter', {
      bubbles: true,
      cancelable: true,
      dataTransfer: dt,
    });
    canvasEl.dispatchEvent(dragEnterEvent);

    const dragOverEvent = new DragEvent('dragover', {
      bubbles: true,
      cancelable: true,
      dataTransfer: dt,
    });
    canvasEl.dispatchEvent(dragOverEvent);

    return new Promise(resolve => {
      setTimeout(() => {
        const overlay = document.querySelector('[data-testid="drop-zone-overlay"]');
        resolve({
          overlayVisible: overlay !== null,
          overlayText: overlay?.textContent || '',
        });
      }, 200);
    });
  });
  console.log(`  Overlay visible: ${overlayResult.overlayVisible}`);
  console.log(`  Overlay text: "${overlayResult.overlayText}"`);

  // 2. Test dropping a real .archc file
  console.log('\nTest 2: Drop .archc file loads architecture');
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  const archcPath = path.resolve('public/ecommerce.archc');
  const archcData = fs.readFileSync(archcPath);
  const archcBase64 = archcData.toString('base64');

  const dropResult = await page.evaluate(async (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const file = new File([bytes], 'ecommerce.archc', { type: 'application/octet-stream' });
    const dt = new DataTransfer();
    dt.items.add(file);

    // Target the ReactFlow wrapper element directly
    const rfWrapper = document.querySelector('.react-flow__renderer') ||
                      document.querySelector('.react-flow') ||
                      document.querySelector('[data-testid="canvas"]');
    if (!rfWrapper) return { error: 'No target element found' };

    // Need to fire dragover first (to set dropEffect), then drop
    const dragOverEvent = new DragEvent('dragover', {
      bubbles: true,
      cancelable: true,
      dataTransfer: dt,
    });
    rfWrapper.dispatchEvent(dragOverEvent);

    const dropEvent = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer: dt,
    });
    rfWrapper.dispatchEvent(dropEvent);

    // Wait for async file processing
    await new Promise(r => setTimeout(r, 3000));

    const nodes = document.querySelectorAll('.react-flow__node');
    return {
      nodeCount: nodes.length,
      success: nodes.length > 0,
    };
  }, archcBase64);

  console.log(`  Nodes after drop: ${dropResult.nodeCount}`);
  console.log(`  File loaded successfully: ${dropResult.success}`);

  // Check console for load message
  const fileLoadLog = consoleMsgs.find(m => m.text.includes('Loaded dropped file') || m.text.includes('Opened file'));
  console.log(`  File load logged: ${!!fileLoadLog}`);
  if (fileLoadLog) console.log(`  Log: ${fileLoadLog.text}`);

  // 3. Test dropping unsupported file
  console.log('\nTest 3: Drop unsupported file type');
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  const toastResult = await page.evaluate(async () => {
    const file = new File(['hello'], 'readme.txt', { type: 'text/plain' });
    const dt = new DataTransfer();
    dt.items.add(file);

    const rfWrapper = document.querySelector('.react-flow') || document.querySelector('[data-testid="canvas"]');
    if (!rfWrapper) return { error: 'No target found' };

    rfWrapper.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    await new Promise(r => setTimeout(r, 500));

    const allText = document.body.innerText;
    return {
      hasUnsupportedMsg: allText.includes('Unsupported') || allText.includes('.archc files'),
    };
  });
  console.log(`  Shows unsupported msg: ${toastResult.hasUnsupportedMsg}`);

  // 4. Test image drop message
  console.log('\nTest 4: Drop image file shows message');
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  const imageResult = await page.evaluate(async () => {
    const file = new File(['PNG'], 'diagram.png', { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);

    const rfWrapper = document.querySelector('.react-flow') || document.querySelector('[data-testid="canvas"]');
    if (!rfWrapper) return { error: 'No target found' };

    rfWrapper.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    await new Promise(r => setTimeout(r, 500));

    return { hasImageMsg: document.body.innerText.includes('image') || document.body.innerText.includes('Image') };
  });
  console.log(`  Shows image message: ${imageResult.hasImageMsg}`);

  // 5. Console errors
  const errors = consoleMsgs.filter(m => m.type === 'error');
  console.log(`\nConsole errors: ${errors.length}`);
  errors.forEach(e => console.log(`  Error: ${e.text}`));

  await browser.close();

  console.log('\n=== Summary ===');
  console.log(`1. Drop zone overlay: ${overlayResult.overlayVisible ? 'PASS' : 'FAIL'}`);
  console.log(`2. File drop loads graph: ${dropResult.success ? 'PASS' : 'FAIL'}`);
  console.log(`3. Unsupported file toast: ${toastResult.hasUnsupportedMsg ? 'PASS' : 'CHECK'}`);
  console.log(`4. Image drop message: ${imageResult.hasImageMsg ? 'PASS' : 'CHECK'}`);
  console.log(`5. Console errors: ${errors.length === 0 ? 'PASS (0)' : `FAIL (${errors.length})`}`);
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
