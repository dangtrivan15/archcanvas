/**
 * E2E test: Feature #371 - Inter-App Drag & Drop for Files
 * Tests: drop zone overlay, .archc file drop, unsupported file handling, image drop
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Feature #371 - Drag & Drop', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('drop zone overlay appears on file drag', async ({ page }) => {
    const overlayResult = await page.evaluate(() => {
      const canvasEl = document.querySelector('[data-testid="canvas"]');
      if (!canvasEl) return { overlayVisible: false, overlayText: '', error: 'Canvas not found' };

      const dt = new DataTransfer();
      dt.items.add(new File(['x'], 'test.archc'));

      canvasEl.dispatchEvent(new DragEvent('dragenter', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
      }));

      canvasEl.dispatchEvent(new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
      }));

      return new Promise<{ overlayVisible: boolean; overlayText: string }>(resolve => {
        setTimeout(() => {
          const overlay = document.querySelector('[data-testid="drop-zone-overlay"]');
          resolve({
            overlayVisible: overlay !== null,
            overlayText: overlay?.textContent || '',
          });
        }, 200);
      });
    });

    expect(overlayResult.overlayVisible).toBe(true);
  });

  test('dropping .archc file loads architecture', async ({ page }) => {
    const archcPath = path.resolve('public/ecommerce.archc');
    const archcData = fs.readFileSync(archcPath);
    const archcBase64 = archcData.toString('base64');

    const dropResult = await page.evaluate(async (base64: string) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const file = new File([bytes], 'ecommerce.archc', { type: 'application/octet-stream' });
      const dt = new DataTransfer();
      dt.items.add(file);

      const rfWrapper = document.querySelector('.react-flow__renderer') ||
                        document.querySelector('.react-flow') ||
                        document.querySelector('[data-testid="canvas"]');
      if (!rfWrapper) return { nodeCount: 0, success: false, error: 'No target element found' };

      rfWrapper.dispatchEvent(new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
      }));

      rfWrapper.dispatchEvent(new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
      }));

      await new Promise(r => setTimeout(r, 3000));

      const nodes = document.querySelectorAll('.react-flow__node');
      return {
        nodeCount: nodes.length,
        success: nodes.length > 0,
      };
    }, archcBase64);

    expect(dropResult.success).toBe(true);
    expect(dropResult.nodeCount).toBeGreaterThan(0);
  });

  test('dropping unsupported file type shows message', async ({ page }) => {
    const toastResult = await page.evaluate(async () => {
      const file = new File(['hello'], 'readme.txt', { type: 'text/plain' });
      const dt = new DataTransfer();
      dt.items.add(file);

      const rfWrapper = document.querySelector('.react-flow') || document.querySelector('[data-testid="canvas"]');
      if (!rfWrapper) return { hasUnsupportedMsg: false, error: 'No target found' };

      rfWrapper.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
      await new Promise(r => setTimeout(r, 500));

      const allText = document.body.innerText;
      return {
        hasUnsupportedMsg: allText.includes('Unsupported') || allText.includes('.archc files'),
      };
    });

    expect(toastResult.hasUnsupportedMsg).toBe(true);
  });

  test('dropping image file shows message', async ({ page }) => {
    const imageResult = await page.evaluate(async () => {
      const file = new File(['PNG'], 'diagram.png', { type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);

      const rfWrapper = document.querySelector('.react-flow') || document.querySelector('[data-testid="canvas"]');
      if (!rfWrapper) return { hasImageMsg: false, error: 'No target found' };

      rfWrapper.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
      await new Promise(r => setTimeout(r, 500));

      return {
        hasImageMsg: document.body.innerText.includes('image') || document.body.innerText.includes('Image'),
      };
    });

    expect(imageResult.hasImageMsg).toBe(true);
  });
});
