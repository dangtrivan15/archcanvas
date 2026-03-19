import { test, expect, type Page } from "@playwright/test";
import { gotoApp } from "./e2e-helpers";

/**
 * E2E mock bridge tests — verify the full AI relay pipeline:
 * chat UI → WebSocket → bridge → mockSession → relay → WebSocket →
 * browser → storeActionDispatcher → Zustand → canvas.
 *
 * Each test sends a scenario key as the chat message. The mock session
 * factory routes it to a deterministic scenario that calls relay actions.
 *
 * Requires MOCK_BRIDGE=1 (set via playwright.config.bridge.ts).
 */

// ---------------------------------------------------------------------------
// Shared setup: open app, set projectPath, open chat, wait for connection
// ---------------------------------------------------------------------------

async function setupBridgeTest(page: Page) {
  await gotoApp(page);

  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = (window as any).__archcanvas_fileStore__;
    store.setState({ projectPath: '/tmp/test-project' });
  });

  await page.getByRole("button", { name: "AI Chat (⌘⇧I)" }).click();
  await expect(page.getByRole("heading", { name: "AI Chat" })).toBeVisible();

  // Wait for WebSocket provider to connect
  await expect(page.getByLabel("AI provider")).toHaveAttribute("data-connected", "true", {
    timeout: 5000,
  });
}

async function sendScenario(page: Page, scenarioKey: string) {
  const textarea = page.getByLabel("Chat input");
  await textarea.fill(scenarioKey);
  await page.getByRole("button", { name: "Send message" }).click();
}

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

test.describe("mock bridge — connection", () => {
  test("provider shows connected status", async ({ page }) => {
    await gotoApp(page);
    await page.getByRole("button", { name: "AI Chat (⌘⇧I)" }).click();
    await expect(page.getByLabel("AI provider")).toHaveAttribute("data-connected", "true", {
      timeout: 5000,
    });
  });
});

// ---------------------------------------------------------------------------
// add-node: single node creation
// ---------------------------------------------------------------------------

test.describe("mock bridge — add-node", () => {
  test("adds a single node to the canvas", async ({ page }) => {
    await setupBridgeTest(page);
    await sendScenario(page, "add-node");

    await expect(page.locator(".react-flow__node")).toHaveCount(1, {
      timeout: 5000,
    });
    await expect(page.getByText("addNode: ok")).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// add-edge: two nodes + edge
// ---------------------------------------------------------------------------

test.describe("mock bridge — add-edge", () => {
  test("adds two nodes and connects them with an edge", async ({ page }) => {
    await setupBridgeTest(page);
    await sendScenario(page, "add-edge");

    // 2 nodes
    await expect(page.locator(".react-flow__node")).toHaveCount(2, {
      timeout: 5000,
    });

    // 1 edge
    await expect(page.locator(".react-flow__edge")).toHaveCount(1, {
      timeout: 5000,
    });

    // All relay calls succeeded
    await expect(page.getByText("addEdge: ok")).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// remove-node: add then remove
// ---------------------------------------------------------------------------

test.describe("mock bridge — remove-node", () => {
  test("adds a node then removes it", async ({ page }) => {
    await setupBridgeTest(page);
    await sendScenario(page, "remove-node");

    // Node was added then removed — canvas should be empty
    await expect(page.locator(".react-flow__node")).toHaveCount(0, {
      timeout: 5000,
    });
    await expect(page.getByText("removeNode: ok")).toBeVisible({
      timeout: 5000,
    });
  });
});

// ---------------------------------------------------------------------------
// list-nodes: add nodes then list
// ---------------------------------------------------------------------------

test.describe("mock bridge — list-nodes", () => {
  test("adds nodes and returns their IDs via list relay", async ({ page }) => {
    await setupBridgeTest(page);
    await sendScenario(page, "list-nodes");

    // 2 nodes on canvas
    await expect(page.locator(".react-flow__node")).toHaveCount(2, {
      timeout: 5000,
    });

    // Chat shows the list result with both node IDs
    await expect(page.getByText("db-1")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("cache-1")).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// import-batch: bulk import
// ---------------------------------------------------------------------------

test.describe("mock bridge — import-batch", () => {
  test("imports multiple nodes and edges in one operation", async ({
    page,
  }) => {
    await setupBridgeTest(page);
    await sendScenario(page, "import-batch");

    // 3 nodes
    await expect(page.locator(".react-flow__node")).toHaveCount(3, {
      timeout: 5000,
    });

    // 2 edges
    await expect(page.locator(".react-flow__edge")).toHaveCount(2, {
      timeout: 5000,
    });

    // Chat confirms the import counts
    await expect(
      page.getByText("imported: 3 nodes, 2 edges"),
    ).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// full-arch: multi-step architecture build
// ---------------------------------------------------------------------------

test.describe("mock bridge — full-arch", () => {
  test("builds a 3-node architecture with edges", async ({ page }) => {
    await setupBridgeTest(page);
    await sendScenario(page, "full-arch");

    // 3 nodes
    await expect(page.locator(".react-flow__node")).toHaveCount(3, {
      timeout: 5000,
    });

    // 2 edges
    await expect(page.locator(".react-flow__edge")).toHaveCount(2, {
      timeout: 5000,
    });

    await expect(
      page.getByText("Built architecture: 3 nodes, 2 edges"),
    ).toBeVisible({ timeout: 5000 });
  });
});
