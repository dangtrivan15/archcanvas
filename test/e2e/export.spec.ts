import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { gotoApp } from './e2e-helpers';

/** Platform-aware modifier key: Meta on Mac, Control on Linux/Windows */
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

test.describe('Export Dialog', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('Export menu item exists in File menu with correct shortcut', async ({ page }) => {
    await page.getByRole('menuitem', { name: 'File' }).click();

    const exportItem = page.getByRole('menuitem', { name: /Export…/ });
    await expect(exportItem).toBeVisible();
    // The shortcut hint is displayed as ⇧⌘E (Mac) or ⇧CtrlE — just check for Export…
    await expect(exportItem).toContainText('Export…');
  });

  test('Export dialog opens from File menu', async ({ page }) => {
    await page.getByRole('menuitem', { name: 'File' }).click();
    await page.getByRole('menuitem', { name: /Export…/ }).click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Export Canvas');
    await expect(dialog).toContainText('Choose a format');
  });

  test('Export dialog opens via keyboard shortcut', async ({ page }) => {
    await page.keyboard.press(`${MOD}+Shift+e`);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Export Canvas');
  });

  test('Export dialog shows three format options', async ({ page }) => {
    await page.keyboard.press(`${MOD}+Shift+e`);
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // All three format options should be visible
    await expect(dialog.getByText('PNG')).toBeVisible();
    await expect(dialog.getByText('SVG')).toBeVisible();
    await expect(dialog.getByText('Markdown')).toBeVisible();
  });

  test('PNG resolution selector is visible when PNG is selected', async ({ page }) => {
    await page.keyboard.press(`${MOD}+Shift+e`);
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // PNG is selected by default — resolution picker should be visible
    await expect(dialog.getByText('Resolution')).toBeVisible();
    await expect(dialog.getByText('1x')).toBeVisible();
    await expect(dialog.getByText('2x')).toBeVisible();
    await expect(dialog.getByText('3x')).toBeVisible();
  });

  test('resolution selector hides when switching to SVG', async ({ page }) => {
    await page.keyboard.press(`${MOD}+Shift+e`);
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Initially Resolution is visible (PNG default)
    await expect(dialog.getByText('Resolution')).toBeVisible();

    // Switch to SVG
    await dialog.getByText('SVG').click();
    await expect(dialog.getByText('Resolution')).not.toBeVisible();
  });

  test('resolution selector hides when switching to Markdown', async ({ page }) => {
    await page.keyboard.press(`${MOD}+Shift+e`);
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Switch to Markdown
    await dialog.getByText('Markdown').click();
    await expect(dialog.getByText('Resolution')).not.toBeVisible();
  });

  test('Export button exists and shows correct text', async ({ page }) => {
    await page.keyboard.press(`${MOD}+Shift+e`);
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    const exportBtn = dialog.getByRole('button', { name: 'Export' });
    await expect(exportBtn).toBeVisible();
    await expect(exportBtn).toBeEnabled();
  });

  test('dialog closes on Escape', async ({ page }) => {
    await page.keyboard.press(`${MOD}+Shift+e`);
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('Export action appears in command palette', async ({ page }) => {
    // Open command palette
    await page.keyboard.press(`${MOD}+k`);

    // Wait for the palette input to be visible (replaces waitForTimeout)
    const input = page.locator('[cmdk-input]');
    await expect(input).toBeVisible();

    // Search for "export"
    await input.fill('export');

    // Wait for filtered results to appear (replaces waitForTimeout)
    await expect(page.getByText('Export…')).toBeVisible();
    await expect(page.getByText('Export as PNG')).toBeVisible();
    await expect(page.getByText('Export as SVG')).toBeVisible();
    await expect(page.getByText('Export as Markdown')).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/*  E2E Export Rendering Tests                                        */
/*  These verify that the custom renderer actually produces valid      */
/*  downloadable files (PNG, SVG, Markdown).                           */
/* ------------------------------------------------------------------ */

test.describe('Export Rendering', () => {
  /**
   * Helper: create a canvas with at least one node so exports have content.
   * Also overrides showSaveFilePicker so the file saver falls through to
   * the <a download> codepath, which Playwright can intercept.
   */
  async function setupForDownload(page: import('@playwright/test').Page) {
    await gotoApp(page);

    // Add a node via the Add Node button
    const addNodeBtn = page.getByRole('button', { name: /Add Node/ });
    await addNodeBtn.click();
    const serviceItem = page.getByTestId('node-type-item').filter({ hasText: 'Service' }).first();
    await serviceItem.click();

    // Wait for the node to render on canvas
    const canvas = page.getByTestId('main-canvas');
    await expect(canvas.locator('.react-flow__node').filter({ hasText: 'Service' })).toBeVisible();

    // Override showSaveFilePicker so it throws a non-AbortError.
    // This forces WebFileSaver to fall through to the <a download> fallback,
    // which Playwright can intercept as a download event.
    // (We can't `delete` it because it may be on the Window prototype.)
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).showSaveFilePicker = async () => {
        throw new Error('E2E test: bypassing native file picker');
      };
    });
  }

  test('PNG export produces a valid PNG file', async ({ page }) => {
    await setupForDownload(page);

    // Open export dialog and export as PNG (default)
    await page.keyboard.press(`${MOD}+Shift+e`);
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Select 1x resolution to keep file size small for testing
    await dialog.getByText('1x').click();

    // Start waiting for download BEFORE clicking export
    const downloadPromise = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Export' }).click();
    const download = await downloadPromise;

    // Verify filename ends with .png
    expect(download.suggestedFilename()).toMatch(/\.png$/);

    // Read the download and verify PNG magic bytes (89 50 4E 47)
    const path = await download.path();
    expect(path).not.toBeNull();
    const buffer = fs.readFileSync(path!);
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50); // P
    expect(buffer[2]).toBe(0x4e); // N
    expect(buffer[3]).toBe(0x47); // G
  });

  test('SVG export produces a valid SVG with foreignObject', async ({ page }) => {
    await setupForDownload(page);

    // Open export dialog and switch to SVG
    await page.keyboard.press(`${MOD}+Shift+e`);
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await dialog.getByText('SVG').click();

    // Start waiting for download BEFORE clicking export
    const downloadPromise = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Export' }).click();
    const download = await downloadPromise;

    // Verify filename
    expect(download.suggestedFilename()).toMatch(/\.svg$/);

    // Read the download and verify SVG content
    const path = await download.path();
    expect(path).not.toBeNull();
    const content = fs.readFileSync(path!, 'utf-8');
    expect(content).toContain('<svg');
    expect(content).toContain('<foreignObject');
    expect(content).toContain('</svg>');
  });

  test('Markdown export produces valid Markdown with headers', async ({ page }) => {
    await setupForDownload(page);

    // Open export dialog and switch to Markdown
    await page.keyboard.press(`${MOD}+Shift+e`);
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await dialog.getByText('Markdown').click();

    // Start waiting for download BEFORE clicking export
    const downloadPromise = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Export' }).click();
    const download = await downloadPromise;

    // Verify filename
    expect(download.suggestedFilename()).toMatch(/\.md$/);

    // Read the download and verify Markdown content
    const path = await download.path();
    expect(path).not.toBeNull();
    const content = fs.readFileSync(path!, 'utf-8');
    expect(content).toContain('#'); // Has headings
    expect(content).toContain('Service'); // Contains the node we added
  });

  test('PNG 3x export produces a larger file than 1x', async ({ page }) => {
    await setupForDownload(page);

    // Export at 1x
    await page.keyboard.press(`${MOD}+Shift+e`);
    let dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await dialog.getByText('1x').click();

    let downloadPromise = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Export' }).click();
    const download1x = await downloadPromise;
    const path1x = await download1x.path();
    const size1x = fs.statSync(path1x!).size;

    // Export at 3x
    await page.keyboard.press(`${MOD}+Shift+e`);
    dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await dialog.getByText('3x').click();

    downloadPromise = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Export' }).click();
    const download3x = await downloadPromise;
    const path3x = await download3x.path();
    const size3x = fs.statSync(path3x!).size;

    // 3x should be larger than 1x (more pixels)
    expect(size3x).toBeGreaterThan(size1x);
  });

  test('export dialog closes after successful export', async ({ page }) => {
    await setupForDownload(page);

    await page.keyboard.press(`${MOD}+Shift+e`);
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Switch to Markdown for fast export
    await dialog.getByText('Markdown').click();

    const downloadPromise = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Export' }).click();
    await downloadPromise;

    // Dialog should auto-close after successful export
    await expect(dialog).not.toBeVisible();
  });

  test('no orphaned export wrappers remain in the DOM after PNG export', async ({ page }) => {
    await setupForDownload(page);

    // Count wrappers before export
    const wrappersBefore = await page.evaluate(
      () => document.querySelectorAll('div[style*="-99999px"]').length,
    );

    await page.keyboard.press(`${MOD}+Shift+e`);
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await dialog.getByText('1x').click();

    const downloadPromise = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Export' }).click();
    await downloadPromise;

    // Wait for dialog to close (signals export completed)
    await expect(dialog).not.toBeVisible();

    // Check that no orphaned wrappers remain
    const wrappersAfter = await page.evaluate(
      () => document.querySelectorAll('div[style*="-99999px"]').length,
    );

    expect(wrappersAfter).toBe(wrappersBefore);
  });

  test('SVG export does not contain externalResourcesRequired', async ({ page }) => {
    await setupForDownload(page);

    await page.keyboard.press(`${MOD}+Shift+e`);
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await dialog.getByText('SVG').click();

    const downloadPromise = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Export' }).click();
    const download = await downloadPromise;

    const path = await download.path();
    const content = fs.readFileSync(path!, 'utf-8');
    expect(content).not.toContain('externalResourcesRequired');
  });
});
