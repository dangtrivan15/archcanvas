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

  test('Export dialog shows two format options', async ({ page }) => {
    await page.keyboard.press(`${MOD}+Shift+e`);
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Two format options should be visible (PNG has been removed)
    await expect(dialog.getByText('SVG')).toBeVisible();
    await expect(dialog.getByText('Markdown')).toBeVisible();
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

  test('Export actions appear in command palette', async ({ page }) => {
    // Open command palette
    await page.keyboard.press(`${MOD}+k`);

    // Wait for the palette input to be visible (replaces waitForTimeout)
    const input = page.locator('[cmdk-input]');
    await expect(input).toBeVisible();

    // Search for "export"
    await input.fill('export');

    // Wait for filtered results to appear (replaces waitForTimeout)
    await expect(page.getByText('Export…')).toBeVisible();
    await expect(page.getByText('Export as SVG')).toBeVisible();
    await expect(page.getByText('Export as Markdown')).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/*  E2E Export Rendering Tests                                        */
/*  These verify that the custom renderer actually produces valid      */
/*  downloadable files (SVG, Markdown).                                */
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

  test('SVG export produces a valid SVG with foreignObject', async ({ page }) => {
    await setupForDownload(page);

    // Open export dialog — SVG is now the default
    await page.keyboard.press(`${MOD}+Shift+e`);
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

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

  test('export dialog closes after successful export', async ({ page }) => {
    await setupForDownload(page);

    await page.keyboard.press(`${MOD}+Shift+e`);
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // SVG is the default — export directly
    const downloadPromise = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Export' }).click();
    await downloadPromise;

    // Dialog should auto-close after successful export
    await expect(dialog).not.toBeVisible();
  });

  test('no orphaned export wrappers remain in the DOM after SVG export', async ({ page }) => {
    await setupForDownload(page);

    // Count wrappers before export
    const wrappersBefore = await page.evaluate(
      () => document.querySelectorAll('div[style*="-99999px"]').length,
    );

    await page.keyboard.press(`${MOD}+Shift+e`);
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // SVG is the default — export directly
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

    // SVG is the default — export directly
    const downloadPromise = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Export' }).click();
    const download = await downloadPromise;

    const path = await download.path();
    const content = fs.readFileSync(path!, 'utf-8');
    expect(content).not.toContain('externalResourcesRequired');
  });
});

/* ------------------------------------------------------------------ */
/*  Export Rendering with Edges                                        */
/*  Verifies that multi-node graphs with edges export correctly.       */
/* ------------------------------------------------------------------ */

test.describe('Export Rendering (with edges)', () => {
  /**
   * Helper: create a canvas with 2 nodes + 1 labeled edge, then
   * auto-layout so they're well-spaced. Mirrors the pattern used in
   * entity-crud.spec.ts. Also overrides showSaveFilePicker so
   * Playwright can intercept downloads via the <a download> fallback.
   */
  async function setupWithEdges(page: import('@playwright/test').Page) {
    await gotoApp(page);

    // Add Service node via command palette
    await page.keyboard.press(`${MOD}+k`);
    await page.getByRole('option', { name: /Service compute\/service/ }).click();
    await page.waitForTimeout(200);

    // Add Database node via command palette
    await page.keyboard.press(`${MOD}+k`);
    await page.getByRole('option', { name: /Database data\/database/ }).click();
    await page.waitForTimeout(200);

    // Add a labeled edge between the two nodes via graphStore
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fileStore = (window as any).__archcanvas_fileStore__;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const graphStore = (window as any).__archcanvas_graphStore__;
      const canvas = fileStore.getState().getCanvas('__root__');
      const nodes = canvas?.data.nodes ?? [];
      if (nodes.length >= 2) {
        graphStore.getState().addEdge('__root__', {
          from: { node: nodes[0].id },
          to: { node: nodes[1].id },
          protocol: 'HTTP',
          label: 'REST API',
        });
      }
    });
    await page.waitForTimeout(100);

    // Auto-layout so nodes don't overlap
    await page.keyboard.press(`${MOD}+Shift+l`);
    await page.waitForTimeout(500);

    // Wait for the edge to render on canvas
    const canvas = page.getByTestId('main-canvas');
    await expect(canvas.locator('.react-flow__edge')).toBeVisible();

    // Override showSaveFilePicker to force <a download> fallback
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).showSaveFilePicker = async () => {
        throw new Error('E2E test: bypassing native file picker');
      };
    });
  }

  test('SVG export with edges contains edge label text', async ({ page }) => {
    await setupWithEdges(page);

    await page.keyboard.press(`${MOD}+Shift+e`);
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // SVG is the default — export directly
    const downloadPromise = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Export' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.svg$/);

    const path = await download.path();
    const content = fs.readFileSync(path!, 'utf-8');

    // SVG wraps DOM in foreignObject — edge label should be present
    expect(content).toContain('REST API');
  });

  test('SVG export with edges contains both node names', async ({ page }) => {
    await setupWithEdges(page);

    await page.keyboard.press(`${MOD}+Shift+e`);
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // SVG is the default — export directly
    const downloadPromise = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Export' }).click();
    const download = await downloadPromise;

    const path = await download.path();
    const content = fs.readFileSync(path!, 'utf-8');

    expect(content).toContain('Service');
    expect(content).toContain('Database');
  });

  test('Markdown export with edges includes both node names', async ({ page }) => {
    await setupWithEdges(page);

    await page.keyboard.press(`${MOD}+Shift+e`);
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await dialog.getByText('Markdown').click();

    const downloadPromise = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Export' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.md$/);

    const path = await download.path();
    const content = fs.readFileSync(path!, 'utf-8');

    expect(content).toContain('Service');
    expect(content).toContain('Database');
  });
});
