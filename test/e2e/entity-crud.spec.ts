import { test, expect } from '@playwright/test';
import { gotoApp } from './e2e-helpers';

test.describe('Entity CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);

    // Add two nodes and an edge
    await page.keyboard.press('Meta+k');
    await page.getByRole('option', { name: /Service compute\/service/ }).click();
    await page.waitForTimeout(200);

    await page.keyboard.press('Meta+k');
    await page.getByRole('option', { name: /Database data\/database/ }).click();
    await page.waitForTimeout(200);

    // Add edge between the two nodes via graphStore
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
          label: 'query',
        });
      }
    });
    await page.waitForTimeout(100);

    // Auto-layout so nodes are well-spaced (viewport-center placement may overlap)
    await page.keyboard.press('Meta+Shift+l');
    await page.waitForTimeout(500);
  });

  test('create entity in EntityPanel', async ({ page }) => {
    // Switch to entity panel via uiStore
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uiStore = (window as any).__archcanvas_uiStore__;
      uiStore.setState({ rightPanelMode: 'entities', rightPanelCollapsed: false });
    });
    await page.waitForTimeout(200);

    // Click "New Entity"
    await page.getByRole('button', { name: /new entity/i }).click();

    // Fill form
    await page.getByPlaceholder(/entity name/i).fill('Order');
    await page.getByPlaceholder(/description/i).fill('A purchase order');

    // Click Create
    await page.getByRole('button', { name: /^create$/i }).click();
    await page.waitForTimeout(100);

    // Verify entity appears in the panel list (use specific selector to avoid ambiguity)
    await expect(page.locator('.text-sm.font-medium', { hasText: 'Order' })).toBeVisible();
  });

  test('assign entity via edge autocomplete', async ({ page }) => {
    // Create an entity programmatically
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const graphStore = (window as any).__archcanvas_graphStore__;
      graphStore.getState().addEntity('__root__', { name: 'Order', description: 'A purchase order' });
    });

    // Select the edge by clicking its label (edge paths intercept clicks)
    await page.locator('.edge-label', { hasText: 'query' }).click({ force: true });
    await page.waitForTimeout(300);

    // Verify EdgeDetailPanel opens with "+ Add Entity" link
    await expect(page.getByText('+ Add Entity')).toBeVisible();

    // Open autocomplete
    await page.getByText('+ Add Entity').click();

    // Type to filter
    await page.getByPlaceholder(/search or create entity/i).fill('Ord');
    await page.waitForTimeout(100);

    // Verify "Order" appears in dropdown
    await expect(page.getByRole('option', { name: 'Order' })).toBeVisible();

    // Click to assign
    await page.getByRole('option', { name: 'Order' }).click();
    await page.waitForTimeout(100);

    // Verify entity pill appears
    await expect(page.locator('.bg-purple-50', { hasText: 'Order' })).toBeVisible();
  });

  test('entity delete blocked when in use', async ({ page }) => {
    // Create entity and assign to edge
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fileStore = (window as any).__archcanvas_fileStore__;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const graphStore = (window as any).__archcanvas_graphStore__;
      graphStore.getState().addEntity('__root__', { name: 'Order', description: 'A purchase order' });
      const canvas = fileStore.getState().getCanvas('__root__');
      const edges = canvas?.data.edges ?? [];
      if (edges.length > 0) {
        graphStore.getState().updateEdge('__root__', edges[0].from.node, edges[0].to.node, {
          entities: ['Order'],
        });
      }
    });
    await page.waitForTimeout(100);

    // Switch to entity panel via uiStore
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uiStore = (window as any).__archcanvas_uiStore__;
      uiStore.setState({ rightPanelMode: 'entities', rightPanelCollapsed: false });
    });
    await page.waitForTimeout(200);

    // Expand entity — use the entity row button specifically
    await page.getByRole('button', { name: /Order.*purchase order/i }).click();
    await page.waitForTimeout(100);

    // Click delete
    await page.getByRole('button', { name: /delete/i }).click();

    // Confirm
    await page.getByRole('button', { name: /confirm/i }).click();
    await page.waitForTimeout(100);

    // Verify "referenced by" warning appears
    await expect(page.getByText(/referenced by/i)).toBeVisible();
  });
});
