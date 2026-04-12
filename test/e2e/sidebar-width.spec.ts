import { test, expect } from '@playwright/test';
import { gotoApp } from './e2e-helpers';

test.describe('Sidebar Width Presets', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await gotoApp(page);
  });

  test('default sidebar width preset is standard', async ({ page }) => {
    const stored = await page.evaluate(() =>
      localStorage.getItem('archcanvas:sidebar-width')
    );
    // Not persisted until changed — default is read at module level
    expect(stored).toBeNull();

    // Verify the store default via exposed store
    const preset = await page.evaluate(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__archcanvas_uiStore__.getState().sidebarWidthPreset
    );
    expect(preset).toBe('standard');
  });

  test('Appearance dialog shows sidebar width controls', async ({ page }) => {
    await page.click('text=View');
    await page.click('text=Appearance');
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // All three presets should be visible
    await expect(page.locator('[data-sidebar-width="narrow"]')).toBeVisible();
    await expect(page.locator('[data-sidebar-width="standard"]')).toBeVisible();
    await expect(page.locator('[data-sidebar-width="wide"]')).toBeVisible();
  });

  test('clicking a sidebar width preset changes the store and persists', async ({ page }) => {
    await page.click('text=View');
    await page.click('text=Appearance');

    // Click "Wide" preset
    await page.click('[data-sidebar-width="wide"]');

    // Verify store updated
    const preset = await page.evaluate(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__archcanvas_uiStore__.getState().sidebarWidthPreset
    );
    expect(preset).toBe('wide');

    // Verify persisted to localStorage
    const stored = await page.evaluate(() =>
      localStorage.getItem('archcanvas:sidebar-width')
    );
    expect(stored).toBe('wide');
  });

  test('sidebar width preference persists across reload', async ({ page }) => {
    // Set to narrow via dialog
    await page.click('text=View');
    await page.click('text=Appearance');
    await page.click('[data-sidebar-width="narrow"]');
    await page.keyboard.press('Escape');

    // Reload and verify
    await page.reload();
    await page.waitForTimeout(200);

    const stored = await page.evaluate(() =>
      localStorage.getItem('archcanvas:sidebar-width')
    );
    expect(stored).toBe('narrow');

    // Re-initialize app and verify store loaded the persisted value
    await gotoApp(page);
    const preset = await page.evaluate(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__archcanvas_uiStore__.getState().sidebarWidthPreset
    );
    expect(preset).toBe('narrow');
  });

  test('keyboard shortcut Cmd+Shift+] cycles sidebar width forward', async ({ page }) => {
    // Start at standard (default)
    const initial = await page.evaluate(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__archcanvas_uiStore__.getState().sidebarWidthPreset
    );
    expect(initial).toBe('standard');

    // Cmd+Shift+] → wide
    await page.keyboard.press('Meta+Shift+]');
    const after1 = await page.evaluate(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__archcanvas_uiStore__.getState().sidebarWidthPreset
    );
    expect(after1).toBe('wide');

    // Cmd+Shift+] → narrow (wraps)
    await page.keyboard.press('Meta+Shift+]');
    const after2 = await page.evaluate(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__archcanvas_uiStore__.getState().sidebarWidthPreset
    );
    expect(after2).toBe('narrow');
  });

  test('keyboard shortcut Cmd+Shift+[ cycles sidebar width backward', async ({ page }) => {
    const initial = await page.evaluate(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__archcanvas_uiStore__.getState().sidebarWidthPreset
    );
    expect(initial).toBe('standard');

    // Cmd+Shift+[ → narrow (backward wraps to previous)
    await page.keyboard.press('Meta+Shift+[');
    const after = await page.evaluate(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__archcanvas_uiStore__.getState().sidebarWidthPreset
    );
    expect(after).toBe('narrow');
  });
});
