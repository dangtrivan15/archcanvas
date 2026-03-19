import { test, expect } from '@playwright/test';
import { gotoApp } from './e2e-helpers';

test.describe('Node Type Overlay', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('hover Add Node button shows overlay, hover away hides it', async ({ page }) => {
    const addNodeBtn = page.getByRole('button', { name: /Add Node/ });
    await addNodeBtn.hover();
    const overlay = page.getByTestId('node-type-overlay');
    await expect(overlay).toBeVisible();

    // Move mouse away from toolbar entirely
    await page.mouse.move(0, 0);
    await expect(overlay).not.toBeVisible();
  });

  test('click Add Node pins overlay, click again unpins', async ({ page }) => {
    const addNodeBtn = page.getByRole('button', { name: /Add Node/ });
    await addNodeBtn.click();
    const overlay = page.getByTestId('node-type-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveAttribute('data-pinned', 'true');

    await addNodeBtn.click();
    await expect(overlay).not.toBeVisible();
  });

  test('click type in overlay creates node on canvas', async ({ page }) => {
    const addNodeBtn = page.getByRole('button', { name: /Add Node/ });
    await addNodeBtn.click();

    const serviceItem = page.getByTestId('node-type-item').filter({ hasText: 'Service' }).first();
    await serviceItem.click();

    // Verify node appears on canvas
    const canvas = page.getByTestId('main-canvas');
    await expect(canvas.locator('.react-flow__node').filter({ hasText: 'Service' })).toBeVisible();
  });

  test('drag type from overlay to canvas creates node at drop position', async ({ page }) => {
    const addNodeBtn = page.getByRole('button', { name: /Add Node/ });
    await addNodeBtn.click();

    const serviceItem = page.getByTestId('node-type-item').filter({ hasText: 'Service' }).first();
    const canvas = page.getByTestId('main-canvas');

    // Drag from overlay to canvas center
    await serviceItem.dragTo(canvas, { targetPosition: { x: 400, y: 300 } });

    await expect(canvas.locator('.react-flow__node').filter({ hasText: 'Service' })).toBeVisible();
  });

  test('filter input narrows types shown', async ({ page }) => {
    const addNodeBtn = page.getByRole('button', { name: /Add Node/ });
    await addNodeBtn.click();

    const overlay = page.getByTestId('node-type-overlay');
    const filterInput = overlay.getByPlaceholder('Filter types...');
    await filterInput.fill('database');

    // Should show Database but not Service
    await expect(overlay.getByText('Database')).toBeVisible();
    await expect(overlay.getByText('Service')).not.toBeVisible();
  });

  test('Escape closes pinned overlay', async ({ page }) => {
    const addNodeBtn = page.getByRole('button', { name: /Add Node/ });
    await addNodeBtn.click();

    const overlay = page.getByTestId('node-type-overlay');
    await expect(overlay).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(overlay).not.toBeVisible();
  });

  test('N key opens palette with + prefix showing node types', async ({ page }) => {
    // Click on the canvas area first to ensure focus is not in an input
    await page.locator('.react-flow__pane').click();
    await page.keyboard.press('n');

    const paletteInput = page.getByPlaceholder(/Type a command/);
    await expect(paletteInput).toBeVisible();
    await expect(paletteInput).toHaveValue('+');
  });
});
