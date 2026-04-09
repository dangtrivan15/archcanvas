import { test, expect } from "@playwright/test";
import { gotoApp } from "../e2e/e2e-helpers";

/**
 * Visual regression tests for node hover states.
 *
 * Covers all 9 shapes in default, hover, and selected states.
 * Uses toHaveScreenshot() for pixel-level comparison against baselines.
 *
 * All nodes are added via the store with explicit positions for deterministic rendering.
 *
 * Baseline management:
 *   npm run test:visual-update   — regenerate snapshots
 *   npm run test:visual          — compare against baselines
 */

// Shape → node type mapping. Each node is placed at a fixed position.
const SHAPE_NODES: Array<{
  shape: string;
  type: string;
  displayName: string;
}> = [
  { shape: "rectangle", type: "compute/service", displayName: "Service" },
  { shape: "cylinder", type: "data/database", displayName: "Database" },
  { shape: "hexagon", type: "messaging/stream-processor", displayName: "Stream Processor" },
  { shape: "parallelogram", type: "messaging/message-queue", displayName: "Message Queue" },
  { shape: "cloud", type: "network/cdn", displayName: "CDN" },
  { shape: "stadium", type: "network/api-gateway", displayName: "API Gateway" },
  { shape: "document", type: "observability/logging", displayName: "Logging" },
  { shape: "diamond", type: "compute/function", displayName: "Transform" },
];

/**
 * Add a single node to the canvas via the store with a fixed position.
 */
async function addNodeViaStore(
  page: import("@playwright/test").Page,
  nodeId: string,
  type: string,
  displayName: string,
  position: { x: number; y: number } = { x: 200, y: 200 },
) {
  await page.evaluate(
    ({ nodeId, type, displayName, position }) => {
      const graphStore = (window as any).__archcanvas_graphStore__;
      graphStore.getState().addNode("__root__", {
        id: nodeId,
        type,
        displayName,
        position,
      });
    },
    { nodeId, type, displayName, position },
  );
  await page.waitForTimeout(300);
}

/**
 * Get the ReactFlow node element for a given node shape.
 */
function nodeLocator(page: import("@playwright/test").Page, shape: string) {
  return page.locator(`.react-flow__node .node-shape-${shape}`);
}

test.describe("Node hover states — visual regression", () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  // -----------------------------------------------------------------------
  // All shapes: default, hover, selected states
  // -----------------------------------------------------------------------

  for (const { shape, type, displayName } of SHAPE_NODES) {
    test(`${shape}: default state`, async ({ page }) => {
      await addNodeViaStore(page, `test-${shape}`, type, displayName);
      const node = nodeLocator(page, shape);
      await expect(node).toBeVisible();
      await expect(node).toHaveScreenshot(`${shape}-default.png`);
    });

    test(`${shape}: hover state`, async ({ page }) => {
      await addNodeViaStore(page, `test-${shape}`, type, displayName);
      const node = nodeLocator(page, shape);
      await expect(node).toBeVisible();
      await node.hover({ force: true });
      // Allow transition to complete (150ms + buffer)
      await page.waitForTimeout(250);
      await expect(node).toHaveScreenshot(`${shape}-hover.png`);
    });

    test(`${shape}: selected state (hover suppressed)`, async ({ page }) => {
      await addNodeViaStore(page, `test-${shape}`, type, displayName);
      const node = nodeLocator(page, shape);
      await expect(node).toBeVisible();

      // Click to select, then hover over it
      await node.click();
      await page.waitForTimeout(100);
      await node.hover({ force: true });
      await page.waitForTimeout(250);

      // Should show selected style, not hover style
      await expect(node).toHaveScreenshot(`${shape}-selected.png`);
    });
  }

  // -----------------------------------------------------------------------
  // Container shape — uses shape: container
  // -----------------------------------------------------------------------

  test("container: default state", async ({ page }) => {
    await addNodeViaStore(page, "test-container", "compute/container", "Test Container");
    const node = nodeLocator(page, "container");
    await expect(node).toBeVisible();
    await expect(node).toHaveScreenshot("container-default.png");
  });

  test("container: hover state", async ({ page }) => {
    await addNodeViaStore(page, "test-container", "compute/container", "Test Container");
    const node = nodeLocator(page, "container");
    await expect(node).toBeVisible();
    await node.hover({ force: true });
    await page.waitForTimeout(250);
    await expect(node).toHaveScreenshot("container-hover.png");
  });

  test("container: selected state (hover suppressed)", async ({ page }) => {
    await addNodeViaStore(page, "test-container", "compute/container", "Test Container");
    const node = nodeLocator(page, "container");
    await expect(node).toBeVisible();
    await node.click();
    await page.waitForTimeout(100);
    await node.hover({ force: true });
    await page.waitForTimeout(250);
    await expect(node).toHaveScreenshot("container-selected.png");
  });

  // -----------------------------------------------------------------------
  // Multi-node canvas: verify hover on one node doesn't affect others
  // -----------------------------------------------------------------------

  test("multi-node: hover isolation", async ({ page }) => {
    // Add two nodes with explicit positions so they don't overlap
    await addNodeViaStore(page, "svc-1", "compute/service", "Service A", { x: 50, y: 50 });
    await addNodeViaStore(page, "db-1", "data/database", "Database B", { x: 350, y: 50 });

    const rectangle = nodeLocator(page, "rectangle");
    const cylinder = nodeLocator(page, "cylinder");

    await expect(rectangle).toBeVisible();
    await expect(cylinder).toBeVisible();

    // Hover over rectangle — cylinder should stay in default state
    await rectangle.hover({ force: true });
    await page.waitForTimeout(250);

    await expect(rectangle).toHaveScreenshot("multi-rectangle-hover.png");
    await expect(cylinder).toHaveScreenshot("multi-cylinder-default.png");
  });
});
