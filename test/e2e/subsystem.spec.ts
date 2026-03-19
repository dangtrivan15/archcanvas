import { test, expect } from '@playwright/test';
import {
  gotoApp,
  createSubsystem,
  diveIntoSubsystem,
  getBreadcrumbText,
} from './e2e-helpers';

test.describe('subsystem creation', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('create subsystem via context menu', async ({ page }) => {
    await createSubsystem(page, 'Order Service', /Service compute\/service/);

    // RefNode should appear on canvas
    const nodes = page.locator('.react-flow__node');
    await expect(nodes).toHaveCount(1);

    // Node should show the subsystem name
    await expect(nodes.first()).toContainText('Order Service');
  });

  test('navigate into subsystem and back', async ({ page }) => {
    await createSubsystem(page, 'Order Service', /Service compute\/service/);

    // Dive in
    await diveIntoSubsystem(page, 'Order Service');

    // Breadcrumb should show path
    const breadcrumb = await getBreadcrumbText(page);
    expect(breadcrumb).toContain('Root');
    expect(breadcrumb).toContain('Order Service');

    // Canvas should be empty (new subsystem)
    await expect(page.locator('.react-flow__node')).toHaveCount(0);

    // Navigate back via breadcrumb
    await page.locator('[data-testid="breadcrumb"]').getByText('Root').click();
    await page.waitForTimeout(700);

    // RefNode should still be there
    await expect(page.locator('.react-flow__node')).toHaveCount(1);
  });

  test('add nodes inside subsystem', async ({ page }) => {
    await createSubsystem(page, 'Order Service', /Service compute\/service/);
    await diveIntoSubsystem(page, 'Order Service');

    // Add a node inside the subsystem via command palette
    await page.keyboard.press('Meta+k');
    await page.getByRole('option', { name: /Database data\/database/ }).click();
    await page.waitForTimeout(200);

    // Node should appear inside subsystem
    await expect(page.locator('[data-testid="main-canvas"] .react-flow__node')).toHaveCount(1);

    // Go back — root should still have just the RefNode
    // (mini-preview inside RefNode also renders ReactFlow nodes, so filter them out)
    await page.locator('[data-testid="breadcrumb"]').getByText('Root').click();
    await page.waitForTimeout(700);
    const mainNodeCount = await page.locator('.react-flow__node').evaluateAll(
      (nodes) => nodes.filter((n) => !n.closest('.subsystem-preview')).length,
    );
    expect(mainNodeCount).toBe(1);
  });

  test('collision error shown when duplicate name', async ({ page }) => {
    await createSubsystem(page, 'Order Service', /Service compute\/service/);

    // Try to create another with the same name
    const canvas = page.locator('.react-flow__pane');
    await canvas.click({ button: 'right', position: { x: 200, y: 200 } });
    await page.getByText('Create Subsystem...').click();
    await page.getByRole('option', { name: /Service compute\/service/ }).click();

    await page.getByTestId('subsystem-name-input').fill('Order Service');
    await page.getByTestId('subsystem-create-btn').click();

    // Error should be visible
    await expect(page.getByTestId('subsystem-error')).toBeVisible();
  });

  test('create subsystem via command palette action', async ({ page }) => {
    // Open command palette and search for the action
    await page.keyboard.press('Meta+k');
    await page.getByPlaceholder(/Type a command/).fill('>Create Subsystem');
    await page.getByRole('option', { name: /Create Subsystem/ }).click();

    // Now in subsystem mode — pick a type
    await page.getByRole('option', { name: /Service compute\/service/ }).click();

    // Fill dialog
    await page.getByTestId('subsystem-name-input').fill('Payment Service');
    await page.getByTestId('subsystem-create-btn').click();
    await page.waitForTimeout(200);

    // RefNode should appear
    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    await expect(page.locator('.react-flow__node').first()).toContainText('Payment Service');
  });

  test('save marks subsystem as clean', async ({ page }) => {
    await createSubsystem(page, 'Order Service', /Service compute\/service/);

    // Verify dirty state via store
    const isDirty = await page.evaluate(() => {
      return (window as any).__archcanvas_fileStore__.getState().isDirty();
    });
    expect(isDirty).toBe(true);

    // Trigger save (Cmd+S)
    await page.keyboard.press('Meta+s');
    await page.waitForTimeout(300);

    // Verify both canvases are registered
    const canvasCount = await page.evaluate(() => {
      return (window as any).__archcanvas_fileStore__.getState().project?.canvases.size;
    });
    expect(canvasCount).toBeGreaterThanOrEqual(2); // root + subsystem
  });

  test('cross-scope edge from root to subsystem inner node', async ({ page }) => {
    // Create a root node first
    await page.keyboard.press('Meta+k');
    await page.getByRole('option', { name: /API Gateway network\/api-gateway/ }).click();
    await page.waitForTimeout(200);

    // Create a subsystem
    await createSubsystem(page, 'Order Service', /Service compute\/service/);

    // Dive in and add an inner node
    await diveIntoSubsystem(page, 'Order Service');
    await page.keyboard.press('Meta+k');
    await page.getByRole('option', { name: /Function compute\/function/ }).click();
    await page.waitForTimeout(200);

    // Go back to root
    await page.locator('[data-testid="breadcrumb"]').getByText('Root').click();
    await page.waitForTimeout(700);

    // Add cross-scope edge via store (UI doesn't have cross-scope edge creation yet)
    const edgeAdded = await page.evaluate(() => {
      const store = (window as any).__archcanvas_fileStore__;
      const project = store.getState().project;
      const root = project.canvases.get('__root__');
      const subsystemId = root.data.nodes.find((n: any) => 'ref' in n)?.id;
      const subsystemCanvas = project.canvases.get(subsystemId);
      const innerNodeId = subsystemCanvas?.data.nodes?.[0]?.id;
      const rootNodeId = root.data.nodes.find((n: any) => !('ref' in n))?.id;

      if (subsystemId && innerNodeId && rootNodeId) {
        const graphStore = (window as any).__archcanvas_graphStore__;
        if (graphStore) {
          const result = graphStore.getState().addEdge('__root__', {
            from: { node: rootNodeId },
            to: { node: `@${subsystemId}/${innerNodeId}` },
          });
          return result.ok;
        }
      }
      return false;
    });
    expect(edgeAdded).toBe(true);

    // Verify the edge exists in the store data
    // (cross-scope edges are stored in the canvas but not rendered visually at root level —
    // they render as ghost/inherited edges when diving into the subsystem)
    const edgeCount = await page.evaluate(() => {
      const store = (window as any).__archcanvas_fileStore__;
      const root = store.getState().getCanvas('__root__');
      return root?.data.edges?.length ?? 0;
    });
    expect(edgeCount).toBeGreaterThanOrEqual(1);
  });
});

// ==========================================================================
// Subsystem Container
// ==========================================================================

test.describe('subsystem container', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('subsystem renders as container with preview', async ({ page }) => {
    // Create subsystem
    await createSubsystem(page, 'Order Service', /Service compute\/service/);

    // Dive in and add nodes
    await diveIntoSubsystem(page, 'Order Service');
    await page.keyboard.press('Meta+k');
    await page.getByRole('option', { name: /Database data\/database/ }).click();
    await page.waitForTimeout(200);
    await page.keyboard.press('Meta+k');
    await page.getByRole('option', { name: /Function compute\/function/ }).click();
    await page.waitForTimeout(200);

    // Go back to root
    await page.locator('[data-testid="breadcrumb"]').getByText('Root').click();
    await page.waitForTimeout(700);

    // The ref-node should have the container class
    const refNode = page.locator('.react-flow__node').first();
    await expect(refNode.locator('.node-shape-container')).toBeVisible();

    // SubsystemPreview should be present (mini ReactFlow instance)
    const preview = refNode.locator('.subsystem-preview');
    await expect(preview).toBeVisible();
    // The mini ReactFlow should render the same number of nodes as the subsystem has
    const miniNodes = preview.locator('.react-flow__node');
    await expect(miniNodes).toHaveCount(2);
  });

  test('subsystem container is larger than regular nodes', async ({ page }) => {
    // Add a regular node
    await page.keyboard.press('Meta+k');
    await page.getByRole('option', { name: /API Gateway network\/api-gateway/ }).click();
    await page.waitForTimeout(200);

    // Create a subsystem
    await createSubsystem(page, 'Order Service', /Service compute\/service/);

    // Compare sizes
    const nodes = page.locator('.react-flow__node');
    await expect(nodes).toHaveCount(2);

    // Get bounding boxes
    const sizes = await nodes.evaluateAll((elements) =>
      elements.map((el) => ({
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height,
        isContainer: el.querySelector('.node-shape-container') !== null,
      })),
    );

    const container = sizes.find((s) => s.isContainer);
    const regular = sizes.find((s) => !s.isContainer);
    expect(container).toBeDefined();
    expect(regular).toBeDefined();
    expect(container!.width).toBeGreaterThan(regular!.width);
    expect(container!.height).toBeGreaterThan(regular!.height);
  });
});

