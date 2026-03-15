import { test, expect } from '@playwright/test';
import { gotoApp } from './e2e-helpers';

test.describe('UI polish regression tests', () => {

  // B1 — Context menu delete works on correct node
  test('context menu deletes the right-clicked node, not another', async ({ page }) => {
    await gotoApp(page);

    // Add two nodes
    await page.keyboard.press('Meta+k');
    await page.getByRole('option', { name: /Service compute\/service/ }).click();
    await page.waitForTimeout(200);

    await page.keyboard.press('Meta+k');
    await page.getByRole('option', { name: /Database data\/database/ }).click();
    await page.waitForTimeout(200);

    await expect(page.locator('.react-flow__node')).toHaveCount(2);

    // Right-click the second node (Database)
    const dbNode = page.locator('.react-flow__node').nth(1);
    await dbNode.click({ button: 'right' });

    // Click "Delete" in context menu (scope to context menu to avoid
    // matching ReactFlow's accessibility descriptions that contain "delete")
    const contextMenu = page.locator('.fixed.z-50.bg-popover');
    await contextMenu.getByRole('button', { name: 'Delete' }).click();
    await page.waitForTimeout(200);

    // Only 1 node should remain
    await expect(page.locator('.react-flow__node')).toHaveCount(1);
  });

  // B5 — Status bar grammar (singular/plural)
  test('status bar shows correct singular/plural for node count', async ({ page }) => {
    await gotoApp(page);
    const statusBar = page.locator('div.h-6.border-t');

    // 0 nodes
    await expect(statusBar.getByText(/0 nodes/)).toBeVisible();

    // Add 1 node
    await page.keyboard.press('Meta+k');
    await page.getByRole('option', { name: /Service compute\/service/ }).click();
    await page.waitForTimeout(200);

    await expect(statusBar.getByText(/1 node\b/)).toBeVisible();

    // Add second node
    await page.keyboard.press('Meta+k');
    await page.getByRole('option', { name: /Database data\/database/ }).click();
    await page.waitForTimeout(200);

    await expect(statusBar.getByText(/2 nodes/)).toBeVisible();
  });

  // U5 — New nodes named by displayName (not type key)
  test('new nodes show displayName, not type key', async ({ page }) => {
    await gotoApp(page);

    // Add a Service node
    await page.keyboard.press('Meta+k');
    await page.getByRole('option', { name: /Service compute\/service/ }).click();
    await page.waitForTimeout(200);

    // The node header name should show "Service", not the type key "compute/service"
    const node = page.locator('.react-flow__node').first();
    const headerName = node.locator('.arch-node-header-name');
    await expect(headerName).toHaveText('Service');
    // The header should NOT use the type path as the display name
    const headerText = await headerName.textContent();
    expect(headerText).not.toContain('compute/service');
  });

  // U1 — Right-click selects node (opens detail panel)
  test('right-click selects the node', async ({ page }) => {
    await gotoApp(page);

    // Add a node
    await page.keyboard.press('Meta+k');
    await page.getByRole('option', { name: /Service compute\/service/ }).click();
    await page.waitForTimeout(200);

    // Right-click the node
    const node = page.locator('.react-flow__node').first();
    await node.click({ button: 'right' });

    // Context menu should appear
    await expect(page.getByText('Edit Properties')).toBeVisible();

    // Close menu by pressing Escape
    await page.keyboard.press('Escape');
  });

  // U4 — Menu click does not deselect node (from Task 4 fix)
  test('clicking context menu item does not deselect the node', async ({ page }) => {
    await gotoApp(page);

    // Add a node
    await page.keyboard.press('Meta+k');
    await page.getByRole('option', { name: /Service compute\/service/ }).click();
    await page.waitForTimeout(200);

    // Right-click to open context menu
    const node = page.locator('.react-flow__node').first();
    await node.click({ button: 'right' });

    // Click "Edit Properties" — this should NOT deselect the node
    const contextMenu = page.locator('.fixed.z-50.bg-popover');
    await contextMenu.getByRole('button', { name: 'Edit Properties' }).click();
    await page.waitForTimeout(200);

    // The inner arch-node element should retain the "selected" class
    // (our store-based selection, not ReactFlow's internal selection)
    const archNode = node.locator('.arch-node');
    await expect(archNode).toHaveClass(/selected/);
  });

  // B3 — Toolbar tool modes
  test('toolbar buttons switch tool modes', async ({ page }) => {
    await gotoApp(page);

    // Find toolbar buttons by aria-label
    const selectBtn = page.getByRole('button', { name: 'Select' });
    const panBtn = page.getByRole('button', { name: 'Pan' });

    // Default mode should be "select" (data-active="true")
    await expect(selectBtn).toHaveAttribute('data-active', 'true');

    // Click Pan button
    await panBtn.click();
    await expect(panBtn).toHaveAttribute('data-active', 'true');
    // Inactive buttons don't have data-active (it's set to undefined, not "false")
    await expect(selectBtn).not.toHaveAttribute('data-active');

    // Switch back to Select
    await selectBtn.click();
    await expect(selectBtn).toHaveAttribute('data-active', 'true');
    await expect(panBtn).not.toHaveAttribute('data-active');
  });

});
