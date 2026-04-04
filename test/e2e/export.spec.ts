import { test, expect } from '@playwright/test';
import { gotoApp } from './e2e-helpers';

test.describe('Export Dialog', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('Export menu item exists in File menu with correct shortcut', async ({ page }) => {
    await page.getByRole('menuitem', { name: 'File' }).click();

    const exportItem = page.getByRole('menuitem', { name: /Export…/ });
    await expect(exportItem).toBeVisible();
    await expect(exportItem).toContainText('⇧⌘E');
  });

  test('Export dialog opens from File menu', async ({ page }) => {
    await page.getByRole('menuitem', { name: 'File' }).click();
    await page.getByRole('menuitem', { name: /Export…/ }).click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Export Canvas');
  });

  test('Export dialog opens via Cmd+Shift+E shortcut', async ({ page }) => {
    await page.keyboard.press('Meta+Shift+e');

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Export Canvas');
  });

  test('Export dialog shows three format options', async ({ page }) => {
    await page.keyboard.press('Meta+Shift+e');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // All three format options should be visible
    await expect(dialog.getByText('PNG')).toBeVisible();
    await expect(dialog.getByText('SVG')).toBeVisible();
    await expect(dialog.getByText('Markdown')).toBeVisible();
  });

  test('PNG resolution selector is visible when PNG is selected', async ({ page }) => {
    await page.keyboard.press('Meta+Shift+e');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // PNG is selected by default — resolution picker should be visible
    await expect(dialog.getByText('Resolution')).toBeVisible();
    await expect(dialog.getByText('1x')).toBeVisible();
    await expect(dialog.getByText('2x')).toBeVisible();
    await expect(dialog.getByText('3x')).toBeVisible();
  });

  test('resolution selector hides when switching to SVG', async ({ page }) => {
    await page.keyboard.press('Meta+Shift+e');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Initially Resolution is visible (PNG default)
    await expect(dialog.getByText('Resolution')).toBeVisible();

    // Switch to SVG
    await dialog.getByText('SVG').click();
    await expect(dialog.getByText('Resolution')).not.toBeVisible();
  });

  test('resolution selector hides when switching to Markdown', async ({ page }) => {
    await page.keyboard.press('Meta+Shift+e');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Switch to Markdown
    await dialog.getByText('Markdown').click();
    await expect(dialog.getByText('Resolution')).not.toBeVisible();
  });

  test('Export button exists and shows correct text', async ({ page }) => {
    await page.keyboard.press('Meta+Shift+e');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    const exportBtn = dialog.getByRole('button', { name: 'Export' });
    await expect(exportBtn).toBeVisible();
    await expect(exportBtn).toBeEnabled();
  });

  test('dialog closes on Escape', async ({ page }) => {
    await page.keyboard.press('Meta+Shift+e');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('Export action appears in command palette', async ({ page }) => {
    // Open command palette with Cmd+K
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(100);

    // Search for "export"
    const input = page.locator('[cmdk-input]');
    await input.fill('export');
    await page.waitForTimeout(100);

    // Should show export actions
    await expect(page.getByText('Export…')).toBeVisible();
    await expect(page.getByText('Export as PNG')).toBeVisible();
    await expect(page.getByText('Export as SVG')).toBeVisible();
    await expect(page.getByText('Export as Markdown')).toBeVisible();
  });
});
